// Copia al servidor propio las fotos que hoy están en Supabase Storage (bucket público "obras"):
// todas las rutas de obra_fotos y de las fotos de artistas, a CARPETA_SUBIDAS con la misma ruta.
// Las que ya están se saltean: se puede correr de nuevo (por ejemplo, el día del cambio, para
// traer las que el equipo haya subido mientras tanto).
//
// Uso (en el servidor, como el usuario de la app, después de copiar los datos):
//   SUPABASE_ORIGEN=https://<proyecto>.supabase.co \
//   node --env-file=/srv/subasta/compartido/.env scripts/servidor/copiar-fotos.mjs
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const origen = process.env.SUPABASE_ORIGEN?.replace(/\/$/, "");
const carpeta = process.env.CARPETA_SUBIDAS;
if (!origen || !carpeta || !process.env.DATABASE_URL) {
  console.error("Faltan SUPABASE_ORIGEN, CARPETA_SUBIDAS o DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 1 });
const rutas = [
  ...(await sql`select ruta from public.obra_fotos`).map((f) => f.ruta),
  ...(await sql`select foto_ruta as ruta from public.artistas where foto_ruta is not null`).map((f) => f.ruta),
].filter((r) => /^[a-z0-9-]+\/[a-f0-9-]+\.jpg$/.test(r));
await sql.end();

const cuenta = { nuevas: 0, yaEstaban: 0, fallidas: [] };
let i = 0;
async function trabajador() {
  while (i < rutas.length) {
    const ruta = rutas[i++];
    const destino = path.join(carpeta, ruta);
    try {
      await fs.access(destino);
      cuenta.yaEstaban++;
      continue;
    } catch {
      // No está: se descarga.
    }
    try {
      const r = await fetch(`${origen}/storage/v1/object/public/obras/${ruta}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const datos = Buffer.from(await r.arrayBuffer());
      await fs.mkdir(path.dirname(destino), { recursive: true });
      // Se escribe a un temporal y se renombra: nunca queda una foto a medias.
      await fs.writeFile(`${destino}.tmp`, datos);
      await fs.rename(`${destino}.tmp`, destino);
      cuenta.nuevas++;
    } catch (e) {
      cuenta.fallidas.push(`${ruta} (${e.message})`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, trabajador));
console.log(`Fotos: ${rutas.length} en la base, ${cuenta.nuevas} copiadas, ${cuenta.yaEstaban} ya estaban.`);
if (cuenta.fallidas.length) {
  console.error(`No se pudieron copiar ${cuenta.fallidas.length}:\n  ${cuenta.fallidas.join("\n  ")}`);
  process.exitCode = 1;
}
