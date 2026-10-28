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
    const formulario = leer("src", "app", "(publico)", "(interior)", "obras", "[numero]", "ofertar", "FormularioOferta.tsx");
    expect(formulario.replace(/\s+/g, " ")).toContain(FRASE_OFERTA);
    expect(formulario).toContain('href="/bases-y-condiciones"');
  });
});

// 20261020120000_muestra.sql: nombre de la muestra, destino y fechas por defecto (provisorios).
describe("textos de la muestra Memorias del futuro", () => {
  it("una base nueva queda con el nombre de la muestra, el destino y las fechas por defecto sin confirmar", async () => {
    const db = await baseDePrueba(false);
    const paginas = (
      await db.query<{ slug: string; titulo: string; contenido: string; provisorio: boolean }>(
        "select slug, titulo, contenido, provisorio from public.paginas",
      )
    ).rows;
    const por = Object.fromEntries(paginas.map((p) => [p.slug, p]));
    expect(por.portada.titulo).toBe("Memorias del futuro");
    expect(por.portada.contenido).toContain("Artistas en diálogo con el patrimonio");
    expect(por.portada.contenido).toContain("Cottolengo Don Orione");
    expect(por.destino.contenido).toContain("Cottolengo Don Orione");
    expect(por.destino.contenido).not.toContain("todavía no está definido");
    expect(por["bases-y-condiciones"].contenido).not.toContain("- Destino de lo recaudado.");
    for (const p of paginas) expect(p.provisorio).toBe(true);

    const [c] = (
      await db.query<{ inicio: string; cierre: string; confirmadas: boolean }>(
        `select to_char(inicio_virtual at time zone 'America/Argentina/Tucuman', 'YYYY-MM-DD HH24:MI') as inicio,
                to_char(cierre_virtual at time zone 'America/Argentina/Tucuman', 'YYYY-MM-DD HH24:MI') as cierre,
                fechas_confirmadas as confirmadas
         from public.configuracion`,
      )
    ).rows;
    expect(c).toEqual({ inicio: "2026-10-31 20:00", cierre: "2026-11-14 20:00", confirmadas: false });
    await db.close();
  });

  it("no pisa la portada si el equipo ya la editó", async () => {
    const db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(leer("supabase", "local", "shim.sql"));
    const todas = listarMigraciones();
    await aplicar(db, todas.filter((a) => a < "20261020120000_muestra.sql"), sinCambios);
    await db.query("update public.paginas set contenido = 'Texto editado por el equipo.' where slug = 'portada'");
    await aplicar(db, ["20261020120000_muestra.sql"], sinCambios);
    const [p] = (await db.query<{ titulo: string; contenido: string }>("select titulo, contenido from public.paginas where slug = 'portada'")).rows;
    expect(p.contenido).toBe("Texto editado por el equipo.");
    expect(p.titulo).toBe("Subasta solidaria del Cementerio del Oeste");
    await db.close();
  });
});

// 20261021120000_extension_cierre.sql: texto provisorio sobre la extensión del cierre.
describe("bases: extensión del cierre", () => {
  it("una base nueva explica la extensión como provisoria y a definir", async () => {
    const db = await baseDePrueba(false);
    const [b] = (
      await db.query<{ contenido: string; provisorio: boolean }>(
        "select contenido, provisorio from public.paginas where slug = 'bases-y-condiciones'",
      )
    ).rows;
    expect(b.provisorio).toBe(true);
    expect(b.contenido).toContain("- Si se aplica la extensión del cierre por ofertas de último momento.");
    expect(b.contenido).toContain("**Extensión del cierre (provisorio, a confirmar):**");
    await db.close();
  });

  it("no pisa las bases si el equipo ya las editó", async () => {
    const db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(leer("supabase", "local", "shim.sql"));
    const todas = listarMigraciones();
    await aplicar(db, todas.filter((a) => a < "20261021120000_extension_cierre.sql"), sinCambios);
    await db.query("update public.paginas set contenido = 'Bases editadas por el equipo.' where slug = 'bases-y-condiciones'");
    await aplicar(db, ["20261021120000_extension_cierre.sql"], sinCambios);
    const [p] = (
      await db.query<{ contenido: string }>("select contenido from public.paginas where slug = 'bases-y-condiciones'")
    ).rows;
    expect(p.contenido).toBe("Bases editadas por el equipo.");
    await db.close();
  });
});

// 20261028120000_catalogo_muestra.sql: página "La muestra" y portada con 24 obras.
describe("catálogo de la muestra", () => {
  it("crea «La muestra» como provisoria y la portada habla de 24 obras", async () => {
    const db = await baseDePrueba(false);
    const por = Object.fromEntries(
      (
        await db.query<{ slug: string; titulo: string; contenido: string; provisorio: boolean }>(
          "select slug, titulo, contenido, provisorio from public.paginas",
        )
      ).rows.map((p) => [p.slug, p]),
    );
    expect(por["la-muestra"]).toMatchObject({ titulo: "La muestra", provisorio: true });
    expect(por["la-muestra"].contenido).toContain("**Dra. Rossana Chahla**, Intendenta de San Miguel de Tucumán.");
    expect(por["la-muestra"].contenido).toContain("- 24. Ariel Xamena");
    expect(por["la-muestra"].contenido).toContain("## Créditos");
    expect(por.portada.contenido).toContain("Veinticuatro artistas contemporáneos");
    expect(por.portada.contenido).not.toContain("Veinticinco");
    expect(por.portada.contenido).toContain("[La muestra](/la-muestra)");
    await db.close();
  });

  it("no pisa la portada si el equipo ya la editó", async () => {
    const db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(leer("supabase", "local", "shim.sql"));
    const todas = listarMigraciones();
    await aplicar(db, todas.filter((a) => a < "20261028120000_catalogo_muestra.sql"), sinCambios);
    await db.query("update public.paginas set contenido = 'Portada editada por el equipo.' where slug = 'portada'");
    await aplicar(db, ["20261028120000_catalogo_muestra.sql"], sinCambios);
    const [p] = (await db.query<{ contenido: string }>("select contenido from public.paginas where slug = 'portada'")).rows;
    expect(p.contenido).toBe("Portada editada por el equipo.");
    await db.close();
  });
});
