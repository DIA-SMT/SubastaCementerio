// El driver de producción (postgres.js) contra PGlite, y la auditoría con datos mínimos.
//
// En producción las consultas van por postgres.js, que antes de mandar los parámetros le pide a
// la base sus tipos y aplica su propio serializador: a un parámetro jsonb le hace JSON.stringify
// aunque ya sea texto. PGlite pasa los strings tal cual, así que el modo local no lo muestra.
// Para reproducirlo, acá se conecta el postgres.js real a la base de prueba por un socket en
// memoria (cada mensaje del protocolo va a PGlite.execProtocolRaw) y se usan las mismas
// funciones de src/lib/db y src/lib/datos que usa el sitio.
import fs from "node:fs";
import path from "node:path";
import { Duplex } from "node:stream";
import type { PGlite } from "@electric-sql/pglite";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { detalleLegible, resumirCambios, SIN_VALOR } from "@/app/admin/(panel)/auditoria/resumen";
import { listarAuditoria, type FiltrosAuditoria } from "@/lib/datos/admin/auditoria";
import { obtenerListadoFinal, registrarExportacion } from "@/lib/datos/admin/exportacion";
import { listarOfertas, ofertasDeObra } from "@/lib/datos/admin/ofertas";
import { opcionesTls } from "@/lib/db";
import { ADMIN, baseDePrueba, como, crearUsuario, registrar } from "./ayuda";

const estado = vi.hoisted(() => ({ sql: null as Sql | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/sesion", () => ({
  comoAdmin: (admin: { id: string }) => ({ rol: "authenticated", uid: admin.id }),
}));
// exportacion.ts lo usa para el estado de la etapa (PRELIMINAR o FINAL); acá no interesa.
vi.mock("@/lib/datos/publico", () => ({
  estadoSubasta: vi.fn(async () => ({
    inicio: new Date(Date.UTC(2026, 9, 17, 23, 0)),
    cierre: new Date(Date.UTC(2026, 10, 1, 23, 0)),
    fechasConfirmadas: true,
    fechaPresencial: null,
    detallePresencial: null,
    incrementoMinimo: 5000,
    precioSalida: 10000,
    modoEjemplo: true,
    fase: "abierta",
    ahora: new Date(Date.UTC(2026, 9, 19, 17, 0)),
  })),
}));
// conBase y consultar corren con el motor de producción (motorPostgres) sobre la base de prueba.
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const conBase: typeof real.conBase = (ctx, fn) => {
    if (!estado.sql) throw new Error("postgres.js no está conectado a la base de prueba.");
    return real.motorPostgres(estado.sql)(ctx, fn);
  };
  const consultar = ((ctx, texto, params) => conBase(ctx, (q) => q(texto, params))) as typeof real.consultar;
  return { ...real, conBase, consultar };
});

const EQUIPO = { rol: "authenticated", uid: ADMIN } as const;
const ADMIN_PRUEBA = { id: ADMIN, email: "admin@ejemplo.test", nombre: "Equipo de ejemplo" };
const SIN_FILTROS: FiltrosAuditoria = { pagina: 1, tabla: null, accion: null, desde: null, hasta: null };
const PERSONALES = ["nombre", "apellido", "dni", "telefono", "email"];

/** Socket en memoria: lo que escribe postgres.js va a PGlite y la respuesta vuelve como datos. */
function socketPglite(db: PGlite) {
  let cola = Promise.resolve();
  const socket: Duplex = new Duplex({
    read() {},
    write(mensaje: Buffer, _codificacion, listo) {
      // Terminate (X): al cerrar la conexión no hay nada que mandarle a PGlite.
      if (mensaje.length === 5 && mensaje[0] === 0x58) return listo();
      cola = cola.then(async () => {
        try {
          const respuesta = await db.execProtocolRaw(new Uint8Array(mensaje));
          if (respuesta.length > 0) socket.push(Buffer.from(respuesta));
          listo();
        } catch (e) {
          listo(e as Error);
        }
      });
    },
    final(listo) {
      listo();
      socket.destroy();
    },
  });
  // postgres.js espera la propiedad de net.Socket para saber si la conexión sigue abierta.
  return Object.assign(socket, { readyState: "open" });
}

/** Mismas opciones que crearMotorSupabase (sin TLS: no hay red de por medio). */
function conectar(db: PGlite): Sql {
  return postgres({ socket: () => socketPglite(db), prepare: false, max: 1, idle_timeout: 20 } as never);
}

let db: PGlite;

async function directo<T = Record<string, unknown>>(texto: string, params: unknown[] = []) {
  return (await db.query<T>(texto, params)).rows;
}

type FilaAuditoria = {
  id: number;
  accion: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  detalle: unknown;
};

async function ultimaAuditoria(tabla: string, registroId: string, accion?: string) {
  const [fila] = await directo<FilaAuditoria>(
    `select id::int as id, accion, antes, despues, detalle from public.auditoria
     where tabla = $1 and registro_id = $2 and ($3::text is null or accion = $3)
     order by id desc limit 1`,
    [tabla, registroId, accion ?? null],
  );
  return fila;
}

beforeAll(async () => {
  db = await baseDePrueba();
  estado.sql = conectar(db);
});

afterAll(async () => {
  await estado.sql?.end({ timeout: 5 });
  estado.sql = null;
});

// ---------------------------------------------------------------------------

describe("parámetros jsonb con el driver de producción", () => {
  it("la prueba reproduce postgres.js: $1::jsonb llega como string jsonb; $1::text::jsonb, como objeto", async () => {
    const valor = JSON.stringify({ formato: "xlsx" });
    const [fila] = await estado.sql!.unsafe(
      "select jsonb_typeof($1::jsonb) as directo, jsonb_typeof($2::text::jsonb) as por_texto",
      [valor, valor],
    );
    expect(fila).toEqual({ directo: "string", por_texto: "object" });
  });

  it("listarAuditoria funciona y resuelve los nombres de lo que aparece en la página", async () => {
    await como(db, EQUIPO, (tx) => tx.query("update public.obras set titulo = 'Título auditado' where numero = 2"));
    const [obra] = await directo<{ id: string }>("select id from public.obras where numero = 2");

    const pagina = await listarAuditoria(ADMIN_PRUEBA, SIN_FILTROS);
    expect(pagina.total).toBeGreaterThan(0);
    expect(pagina.entradas[0]).toMatchObject({ tabla: "obras", accion: "update", actorId: ADMIN });
    expect(pagina.referencias.admins[ADMIN]).toBe("Equipo de ejemplo");
    expect(pagina.referencias.obras[obra.id]).toEqual({ numero: 2, titulo: "Título auditado" });
  });

  it("registrarExportacion guarda el detalle como objeto y el panel lo muestra en palabras", async () => {
    await registrarExportacion(ADMIN_PRUEBA, { formato: "xlsx", preliminar: true, filas: 25 });
    const [fila] = await directo<{ tipo: string; formato: string | null }>(
      `select jsonb_typeof(detalle) as tipo, detalle ->> 'formato' as formato
       from public.auditoria where accion = 'exportar_listado' order by id desc limit 1`,
    );
    expect(fila).toEqual({ tipo: "object", formato: "xlsx" });

    const pagina = await listarAuditoria(ADMIN_PRUEBA, { ...SIN_FILTROS, accion: "exportar_listado" });
    expect(detalleLegible(pagina.entradas[0], pagina.referencias)).toEqual([
      "Descarga del listado final (Excel) con la marca PRELIMINAR: 25 obras.",
    ]);
  });

  it("en src/ ningún parámetro se castea directo a jsonb (tiene que pasar por text)", () => {
    const raiz = process.cwd();
    const directoAJsonb = [
      /\$\d+\s*::\s*jsonb?\b/i,
      /cast\s*\(\s*\$\d+\s+as\s+jsonb?\b/i,
      // Un parámetro sin cast en un argumento jsonb también toma el tipo de la función:
      // registrar_evento(text, jsonb) es la única con un parámetro jsonb.
      /registrar_evento\s*\([^)]*\$\d+\s*\)/i,
    ];
    const encontrados: string[] = [];
    const recorrer = (carpeta: string) => {
      for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
        const ruta = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx|js|mjs|sql)$/.test(entrada.name)) {
          fs.readFileSync(ruta, "utf8")
            .split("\n")
            .forEach((linea, i) => {
              const codigo = linea.trim();
              if (/^(\/\/|\/?\*|--)/.test(codigo)) return; // comentarios
              if (directoAJsonb.some((r) => r.test(codigo))) {
                encontrados.push(`${path.relative(raiz, ruta).replaceAll("\\", "/")}:${i + 1}`);
              }
            });
        }
      }
    };
    recorrer(path.join(raiz, "src"));
    expect(encontrados).toEqual([]);
  });

  it("el listado final y las ofertas del panel marcan al oferente bloqueado también con postgres.js", async () => {
    const [mejor] = await directo<{ obra_id: string; oferente_id: string }>(
      `select mo.obra_id, mo.oferente_id from public.v_mejor_oferta mo
       join public.obras ob on ob.id = mo.obra_id where ob.publicada order by ob.numero limit 1`,
    );
    await db.query("update public.oferentes set bloqueado = true, bloqueo_motivo = 'Prueba del driver' where id = $1", [
      mejor.oferente_id,
    ]);
    try {
      const listado = await obtenerListadoFinal(ADMIN_PRUEBA);
      const fila = listado.filas.find((f) => f.obraId === mejor.obra_id)!;
      expect(fila.oferente).toMatchObject({ bloqueado: true });
      expect(fila.ofertaAt).toBeInstanceOf(Date);

      const deLaObra = await ofertasDeObra(ADMIN_PRUEBA, mejor.obra_id);
      expect(deLaObra?.obra.mejor).toMatchObject({ bloqueado: true, monto: fila.precioBase });
      expect(deLaObra?.ofertas.find((o) => o.esLaMasAlta)).toMatchObject({ oferenteId: mejor.oferente_id, bloqueado: true });

      const pagina = await listarOfertas(ADMIN_PRUEBA, { numeroObra: fila.numero, estado: "validas", pagina: 1 });
      expect(pagina.ofertas.length).toBeGreaterThan(0);
      for (const o of pagina.ofertas) {
        expect(o).toMatchObject({ numero: fila.numero, estado: "valida", bloqueado: o.oferenteId === mejor.oferente_id });
      }
    } finally {
      await db.query("update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1", [
        mejor.oferente_id,
      ]);
    }
  });
});

// ---------------------------------------------------------------------------

describe("cifrado de la conexión con Supabase", () => {
  it("sin certificado cifra igual (ssl: require)", () => {
    expect(opcionesTls("")).toBe("require");
    expect(opcionesTls("   ")).toBe("require");
  });

  it("con SUPABASE_CA_CERT verifica el servidor, con saltos de línea reales o escritos como \\n", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
    expect(opcionesTls(pem)).toEqual({ ca: pem, rejectUnauthorized: true });
    expect(opcionesTls(pem.replaceAll("\n", "\\n"))).toEqual({ ca: pem, rejectUnauthorized: true });
  });
});

// ---------------------------------------------------------------------------

describe("auditoría con datos mínimos", () => {
  let uid: string;

  beforeAll(async () => {
    uid = await crearUsuario(db, "lucia.auditoria@prueba.test");
    expect((await registrar(db, uid, "30111222")).ok).toBe(true);
  });

  it("el alta de un oferente no copia nombre, apellido, DNI, teléfono ni correo", async () => {
    const alta = await ultimaAuditoria("oferentes", uid, "insert");
    expect(alta.antes).toBeNull();
    expect(alta.despues).toMatchObject({ id: uid, alias_numero: expect.any(Number), bloqueado: false });
    for (const campo of PERSONALES) expect(alta.despues, campo).not.toHaveProperty(campo);
    const texto = JSON.stringify(alta);
    for (const dato of ["30111222", "3815551234", "lucia.auditoria@prueba.test"]) expect(texto).not.toContain(dato);
  });

  it("un cambio de teléfono deja solo el nombre de la columna, sin el valor", async () => {
    const { rows } = await como(db, { rol: "authenticated", uid }, (tx) =>
      tx.query<{ r: { ok: boolean } }>("select public.actualizar_mis_datos($1, $2) as r", ["381 555-9999", true]),
    );
    expect(rows[0].r.ok).toBe(true);

    const cambio = await ultimaAuditoria("oferentes", uid, "update");
    expect(cambio).toMatchObject({ antes: {}, despues: {}, detalle: { campos: ["telefono"] } });
    expect(JSON.stringify(cambio)).not.toMatch(/3815551234|3815559999/);
  });

  it("el bloqueo guarda los campos que cambiaron, sin la fecha de actualización", async () => {
    await como(db, EQUIPO, (tx) =>
      tx.query("update public.oferentes set bloqueado = true, bloqueo_motivo = 'Datos de contacto falsos' where id = $1", [
        uid,
      ]),
    );
    const cambio = await ultimaAuditoria("oferentes", uid, "update");
    expect(cambio).toMatchObject({
      antes: { bloqueado: false, bloqueo_motivo: null },
      despues: { bloqueado: true, bloqueo_motivo: "Datos de contacto falsos" },
      detalle: { campos: ["bloqueado", "bloqueo_motivo"] },
    });
    expect(Object.keys(cambio.despues!).sort()).toEqual(["bloqueado", "bloqueo_motivo"]);
  });

  it("la baja de un oferente tampoco copia sus datos personales", async () => {
    const otro = await crearUsuario(db, "baja.auditoria@prueba.test");
    expect((await registrar(db, otro, "30999888")).ok).toBe(true);
    await db.query("delete from public.oferentes where id = $1", [otro]);
    const baja = await ultimaAuditoria("oferentes", otro, "delete");
    expect(baja.despues).toBeNull();
    expect(baja.antes).toMatchObject({ id: otro });
    for (const campo of PERSONALES) expect(baja.antes, campo).not.toHaveProperty(campo);
  });

  it("ningún registro de oferentes guarda datos personales (tampoco los de ejemplo)", async () => {
    const [fila] = await directo<{ total: number; con_datos: number }>(
      `select count(*)::int as total,
              count(*) filter (
                where coalesce(antes, '{}'::jsonb) ?| $1::text[] or coalesce(despues, '{}'::jsonb) ?| $1::text[]
              )::int as con_datos
       from public.auditoria where tabla = 'oferentes'`,
      [PERSONALES],
    );
    expect(fila.total).toBeGreaterThan(3);
    expect(fila.con_datos).toBe(0);
  });

  it("en otras tablas, un cambio guarda solo las columnas que cambiaron", async () => {
    await como(db, EQUIPO, (tx) => tx.query("update public.obras set titulo = 'Otro título' where numero = 3"));
    const [obra] = await directo<{ id: string }>("select id from public.obras where numero = 3");
    expect(await ultimaAuditoria("obras", obra.id, "update")).toMatchObject({
      antes: { titulo: "Título de ejemplo 3" },
      despues: { titulo: "Otro título" },
      detalle: null,
    });
    const cambio = await ultimaAuditoria("obras", obra.id, "update");
    expect(Object.keys(cambio.antes!)).toEqual(["titulo"]);

    // Una actualización que no cambia nada no copia la fila.
    await como(db, EQUIPO, (tx) => tx.query("update public.obras set publicada = publicada where numero = 3"));
    expect(await ultimaAuditoria("obras", obra.id, "update")).toMatchObject({ antes: {}, despues: {} });
  });

  it("la anulación de una oferta conserva la obra para el panel", async () => {
    const [oferta] = await directo<{ id: string; obra_id: string }>(
      "select id::text as id, obra_id from public.ofertas where estado = 'valida' order by id limit 1",
    );
    const { rows } = await como(db, EQUIPO, (tx) =>
      tx.query<{ r: { ok: boolean } }>("select public.anular_oferta($1, $2) as r", [oferta.id, "Cargada por error"]),
    );
    expect(rows[0].r.ok).toBe(true);
    const anulacion = await ultimaAuditoria("ofertas", oferta.id, "anular");
    expect(Object.keys(anulacion.antes!).sort()).toEqual([
      "anulada_at",
      "anulada_por",
      "estado",
      "motivo_anulacion",
      "obra_id",
    ]);
    expect(anulacion.despues).toMatchObject({ estado: "anulada", obra_id: oferta.obra_id, anulada_por: ADMIN });
  });

  it("el panel muestra los cambios de oferentes con la lista de campos, sin el valor", async () => {
    const pagina = await listarAuditoria(ADMIN_PRUEBA, { ...SIN_FILTROS, tabla: "oferentes", accion: "update" });
    const deLucia = pagina.entradas.filter((e) => e.registroId === uid);
    expect(deLucia).toHaveLength(2);
    const [bloqueo, telefono] = deLucia;

    expect(resumirCambios(telefono, pagina.referencias)).toEqual([{ campo: "Teléfono", despues: SIN_VALOR }]);
    expect(detalleLegible(telefono, pagina.referencias)).toBeNull();

    expect(resumirCambios(bloqueo, pagina.referencias)).toEqual([
      { campo: "Bloqueado", antes: "No", despues: "Sí" },
      { campo: "Motivo del bloqueo", antes: "(vacío)", despues: "Datos de contacto falsos" },
    ]);
    expect(detalleLegible(bloqueo, pagina.referencias)).toBeNull();
  });
});
