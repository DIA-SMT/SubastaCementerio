// Prepara la base del servidor propio (PostgreSQL en el mismo equipo, sin Supabase): aplica el
// reemplazo de lo que Supabase trae de fábrica (supabase/local/shim.sql: esquema auth,
// auth.uid(), storage) y después las migraciones que falten, en orden. Registra lo aplicado en
// supabase_migrations.schema_migrations, igual que scripts/migrar.mjs: se puede correr de nuevo
// en cada despliegue y solo aplica lo nuevo.
//
// Antes, como postgres: crear la base y el rol de la app, y darle los roles anon,
// authenticated y service_role (si ya existen en el servidor, se reutilizan).
//
// Uso (en el servidor, como el usuario de la app):
//   node --env-file=/srv/subasta/compartido/.env scripts/servidor/preparar-base.mjs [--ver]
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const soloVer = process.argv.includes("--ver");
const cadena = process.env.DATABASE_URL;
if (!cadena) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}
const { hostname } = new URL(cadena);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
  console.error(`Este script es para la base del servidor propio, no para ${hostname}. Para Supabase: npm run db:migrar.`);
  process.exit(1);
}

const raiz = process.cwd();
const dir = path.join(raiz, "supabase", "migrations");
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(cadena, { ssl: false, max: 1, onnotice: () => {} });

try {
  const [{ hayAuth }] = await sql`select exists (select 1 from pg_namespace where nspname = 'auth') as "hayAuth"`;
  if (!hayAuth) {
    if (soloVer) console.log("Pendiente: supabase/local/shim.sql (esquema auth, storage, extensiones).");
    else {
      await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(raiz, "supabase", "local", "shim.sql"), "utf8")));
      console.log("Aplicado: supabase/local/shim.sql");
    }
  }

  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);
  const aplicadas = new Set((await sql`select version from supabase_migrations.schema_migrations`).map((f) => f.version));
  const pendientes = archivos
    .map((archivo) => {
      const [, version, nombre] = /^(\d+)_(.+)\.sql$/.exec(archivo) ?? [];
      return { archivo, version, nombre };
    })
    .filter((m) => m.version && !aplicadas.has(m.version));

  if (pendientes.length === 0) console.log("La base está al día: no hay migraciones pendientes.");
  else if (soloVer) console.log(`Pendientes (${pendientes.length}):\n${pendientes.map((m) => `  ${m.archivo}`).join("\n")}`);
  else {
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
  console.error(`No se pudo preparar la base: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
