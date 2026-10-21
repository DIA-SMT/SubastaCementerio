// Aplica en Supabase las migraciones de supabase/migrations/ que falten, en orden de nombre.
// Alternativa a `supabase db push` para cuando la CLI no está disponible. Registra lo aplicado en
// supabase_migrations.schema_migrations, la misma tabla que usa la CLI: se pueden combinar.
//
// Uso:  npm run db:migrar            (aplica lo que falta)
//       npm run db:migrar -- --ver   (solo lista lo pendiente)
//
// Lee DATABASE_URL de .env.local. Las migraciones van por el pooler en modo sesión (puerto 5432):
// el modo transacción (6543), el que usa la app, no es adecuado para cambios de esquema.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const soloVer = process.argv.includes("--ver");
const cadena = process.env.DATABASE_URL;
if (!cadena) {
  console.error("Falta DATABASE_URL (en .env.local). Sin ella la app usa la base local de ejemplo.");
  process.exit(1);
}

const url = new URL(cadena);
if (url.port === "6543") url.port = "5432";

const dir = path.join(process.cwd(), "supabase", "migrations");
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const sql = postgres(url.toString(), { ssl: "require", prepare: false, max: 1, onnotice: () => {} });

try {
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);
  const filas = await sql`select version from supabase_migrations.schema_migrations`;
  const aplicadas = new Set(filas.map((f) => f.version));

  const pendientes = archivos
    .map((archivo) => {
      const [, version, nombre] = /^(\d+)_(.+)\.sql$/.exec(archivo) ?? [];
      return { archivo, version, nombre };
    })
    .filter((m) => m.version && !aplicadas.has(m.version));

  if (pendientes.length === 0) {
    console.log("La base está al día: no hay migraciones pendientes.");
  } else if (soloVer) {
    console.log(`Pendientes (${pendientes.length}):\n${pendientes.map((m) => `  ${m.archivo}`).join("\n")}`);
  } else {
    for (const m of pendientes) {
      const contenido = fs.readFileSync(path.join(dir, m.archivo), "utf8");
      // Cada migración entra entera o no entra.
      await sql.begin(async (tx) => {
        await tx.unsafe(contenido);
        await tx`insert into supabase_migrations.schema_migrations (version, name, statements)
                 values (${m.version}, ${m.nombre}, ${[contenido]})`;
      });
      console.log(`Aplicada: ${m.archivo}`);
    }
    console.log(`Listo: ${pendientes.length} migraciones aplicadas.`);
  }
} catch (e) {
  console.error(`No se pudo migrar: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
