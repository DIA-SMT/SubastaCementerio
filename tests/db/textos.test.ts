import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";
import { listarMigraciones } from "@/lib/db/local/preparar";
import { baseDePrueba } from "./ayuda";

// 20261019140400_textos.sql corrige los textos provisorios de privacidad y de "Cómo
// participar" solo si siguen iguales al original: no puede pisar lo que el equipo ya editó.

const MIGRACION = "20261019140400_textos.sql";

/** Lo que la confirmación de la oferta y "Cómo participar" tienen que decir igual. */
const FRASE_OFERTA =
  "Una vez confirmada, la oferta queda registrada y no se puede editar ni borrar desde el sitio. Las condiciones de la subasta están en las";

type Pagina = { contenido: string; version: number; provisorio: boolean };
type Transformar = (sql: string) => string;

const leer = (...partes: string[]) => fs.readFileSync(path.join(process.cwd(), ...partes), "utf8");
const sinCambios: Transformar = (sql) => sql;
// Cómo queda un archivo en una copia de Windows (git con core.autocrlf).
const conCrlf: Transformar = (sql) => sql.replace(/\r?\n/g, "\r\n");

const anteriores = () => listarMigraciones().filter((a) => a < MIGRACION);
const desdeTextos = () => listarMigraciones().filter((a) => a >= MIGRACION);

async function aplicar(db: PGlite, archivos: string[], transformar: Transformar) {
  for (const archivo of archivos) await db.exec(transformar(leer("supabase", "migrations", archivo)));
}

/** Base con las migraciones previas a la de textos, como una base que ya estaba en uso. */
async function baseAnterior(transformar: Transformar = sinCambios) {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(leer("supabase", "local", "shim.sql"));
  await aplicar(db, anteriores(), transformar);
  return db;
}

async function pagina(db: PGlite, slug: string) {
  const { rows } = await db.query<Pagina>(
    "select contenido, version, provisorio from public.paginas where slug = $1",
    [slug],
  );
  return rows[0];
}

function esPrivacidadNueva(p: Pagina) {
  expect(p.contenido).toContain(
    "El equipo autorizado de la Dirección de Cementerios. Al cierre de la etapa virtual, el martillero de la subasta presencial recibe el listado final",
  );
  expect(p.contenido).toContain("- Quién es el martillero y en qué condiciones recibe y conserva los datos.");
  expect(p.contenido).not.toContain("Solo el equipo autorizado");
  expect(p.contenido).not.toContain("\r");
  expect(p).toMatchObject({ version: 2, provisorio: true });
}

function esComoParticiparNuevo(p: Pagina) {
  expect(p.contenido).toContain(`${FRASE_OFERTA} [bases y condiciones](/bases-y-condiciones).`);
  expect(p.contenido).not.toMatch(/retirar|modificar/);
  expect(p.contenido).not.toContain("\r");
  expect(p).toMatchObject({ version: 2, provisorio: true });
}

describe("textos provisorios (20261019140400)", () => {
  it("después de las migraciones, privacidad y cómo participar quedan actualizados", async () => {
    const db = await baseDePrueba(false);
    esPrivacidadNueva(await pagina(db, "privacidad"));
    esComoParticiparNuevo(await pagina(db, "como-participar"));

    // El cambio queda en la auditoría como hecho por el sistema.
    const { rows } = await db.query<{ registro_id: string }>(
      `select registro_id from public.auditoria
       where tabla = 'paginas' and accion = 'update' and actor_tipo = 'sistema' and actor_id is null
       order by registro_id`,
    );
    expect(rows.map((r) => r.registro_id)).toEqual(expect.arrayContaining(["como-participar", "privacidad"]));
  });

  it("no pisa un texto de privacidad que el equipo ya editó", async () => {
    const db = await baseAnterior();
    await db.query("update public.paginas set contenido = 'Texto aprobado por la Dirección.' where slug = 'privacidad'");
    await aplicar(db, desdeTextos(), sinCambios);

    expect(await pagina(db, "privacidad")).toEqual({
      contenido: "Texto aprobado por la Dirección.",
      version: 2,
      provisorio: true,
    });
    // El otro texto sigue sin editar: ese sí se corrige.
    esComoParticiparNuevo(await pagina(db, "como-participar"));
  });

  it("no pisa cómo participar aunque el cambio del equipo sea mínimo", async () => {
    const db = await baseAnterior();
    const original = (await pagina(db, "como-participar")).contenido;
    const editado = original.replace("con martillero.", "con martillero y público.");
    expect(editado).not.toBe(original);
    await db.query("update public.paginas set contenido = $1 where slug = 'como-participar'", [editado]);
    await aplicar(db, desdeTextos(), sinCambios);

    expect(await pagina(db, "como-participar")).toEqual({ contenido: editado, version: 2, provisorio: true });
    esPrivacidadNueva(await pagina(db, "privacidad"));
  });

  it.each([
    ["CRLF", "LF", conCrlf, sinCambios],
    ["LF", "CRLF", sinCambios, conCrlf],
    ["CRLF", "CRLF", conCrlf, conCrlf],
  ])(
    "corrige los textos con los originales en %s y la migración en %s",
    async (_original, _migracion, antes, despues) => {
      const db = await baseAnterior(antes);
      await aplicar(db, desdeTextos(), despues);
      esPrivacidadNueva(await pagina(db, "privacidad"));
      esComoParticiparNuevo(await pagina(db, "como-participar"));
    },
  );

  it("la confirmación de la oferta dice lo mismo que cómo participar", () => {
    const formulario = leer("src", "app", "(publico)", "obras", "[numero]", "ofertar", "FormularioOferta.tsx");
    expect(formulario.replace(/\s+/g, " ")).toContain(FRASE_OFERTA);
    expect(formulario).toContain('href="/bases-y-condiciones"');
  });
});
