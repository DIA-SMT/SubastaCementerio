// Prepara una base PGlite con las mismas migraciones que Supabase.
// Lo usan el modo local de la app y las pruebas. No importar desde código de producción.
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const RAIZ = process.cwd();
const DIR_SUPABASE = path.join(RAIZ, "supabase");

function leer(...partes: string[]) {
  return fs.readFileSync(path.join(DIR_SUPABASE, ...partes), "utf8");
}

export function listarMigraciones() {
  return fs
    .readdirSync(path.join(DIR_SUPABASE, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

type Opciones = {
  /** Carpeta donde persiste la base. Sin carpeta, la base vive en memoria. */
  carpeta?: string;
  /** Carga supabase/seed.sql y el usuario local del panel. */
  conEjemplos?: boolean;
};

export async function crearBaseLocal({ carpeta, conEjemplos = true }: Opciones = {}) {
  if (carpeta) fs.mkdirSync(carpeta, { recursive: true });
  const db = await PGlite.create({
    dataDir: carpeta,
    extensions: { pgcrypto },
  });

  const { rows } = await db.query<{ existe: boolean }>(
    "select exists (select 1 from pg_namespace where nspname = 'local') as existe",
  );
  const nueva = !rows[0].existe;

  if (nueva) {
    await db.exec(leer("local", "shim.sql"));
    await db.exec(
      "create table local.migraciones (nombre text primary key, aplicada_at timestamptz not null default now())",
    );
  }

  const aplicadas = new Set(
    (await db.query<{ nombre: string }>("select nombre from local.migraciones")).rows.map(
      (r) => r.nombre,
    ),
  );
  for (const archivo of listarMigraciones()) {
    if (aplicadas.has(archivo)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(leer("migrations", archivo));
      await tx.query("insert into local.migraciones (nombre) values ($1)", [archivo]);
    });
  }

  if (nueva && conEjemplos) {
    await db.exec(leer("seed.sql"));
    await db.exec(leer("local", "seed-local.sql"));
  }

  return db;
}
