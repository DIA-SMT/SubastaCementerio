// Avisos "te superaron": cada aviso sale una sola vez y solo cuando corresponde, sin datos
// personales en los logs fuera del modo local y sin marcarse como enviado si no salió.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pesos } from "@/lib/formato";
import { ADMIN, OBRA, baseDePrueba, como, crearUsuario, ofertar, registrar } from "./ayuda";

const base = vi.hoisted(() => ({ db: undefined as unknown as PGlite }));

vi.mock("server-only", () => ({}));
// Las consultas del servidor van a la base de prueba. El rol de servicio corre como dueño de
// la base, igual que en src/lib/db (sin set_config de rol).
vi.mock("@/lib/db", () => ({
  consultar: (_ctx: unknown, texto: string, params?: unknown[]) =>
    base.db.transaction(async (tx) => (await tx.query(texto, params ?? [])).rows),
}));

type FilaAviso = {
  id: number;
  estado: string;
  intentos: number;
  reservado_hasta: Date | null;
  ultimo_error: string | null;
  enviado_at: Date | null;
};

async function directo<T = Record<string, unknown>>(db: PGlite, texto: string, params: unknown[] = []) {
  return (await db.query<T>(texto, params)).rows;
}

async function aviso(db: PGlite, id: number) {
  const [fila] = await directo<FilaAviso>(
    db,
    `select id::int as id, estado, intentos, reservado_hasta, ultimo_error, enviado_at
     from public.avisos_correo where id = $1`,
    [id],
  );
  return fila;
}

/** Lo que haría el servidor: reservar avisos para enviar. Devuelve los ids. */
async function reservar(db: PGlite, limite = 100) {
  return (
    await directo<{ aviso_id: number }>(db, "select aviso_id::int as aviso_id from public.avisos_para_enviar($1)", [
      limite,
    ])
  ).map((f) => f.aviso_id);
}

/** Los avisos que se reservarían ahora, sin dejarlos reservados. */
async function mirar(db: PGlite) {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ aviso_id: number }>(
      "select aviso_id::int as aviso_id from public.avisos_para_enviar(100)",
    );
    await tx.rollback();
    return rows.map((f) => f.aviso_id);
  });
}

async function oferente(db: PGlite, email: string, dni: string) {
  const uid = await crearUsuario(db, email);
  expect((await registrar(db, uid, dni)).ok).toBe(true);
  return uid;
}

/** Ana oferta y Beto la supera en la obra: queda un aviso para Ana. */
async function anaSuperada(db: PGlite, obraId = OBRA(6), monto = 10000) {
  const ana = await oferente(db, "ana@prueba.test", "20111222");
  const beto = await oferente(db, "beto@prueba.test", "20333444");
  expect((await ofertar(db, ana, obraId, monto)).ok).toBe(true);
  const r = await ofertar(db, beto, obraId, monto + 5000);
  expect(r.ok).toBe(true);
  expect(r.aviso_id).toBeTruthy();
  return { ana, beto, avisoId: Number(r.aviso_id) };
}

async function cerrarEtapa(db: PGlite) {
  await db.query(
    `update public.configuracion
     set inicio_virtual = now() - interval '3 days', cierre_virtual = now() - interval '1 minute'
     where id = 1`,
  );
}

// ---------------------------------------------------------------------------
// Entorno y módulos del servidor
// ---------------------------------------------------------------------------

type Entorno = { local: boolean; resend?: boolean; url?: string; cron?: boolean };

/** Vuelve a cargar los módulos con las variables de entorno indicadas. */
async function cargar({ local, resend = false, url = "https://subasta.smt.gob.ar", cron = true }: Entorno) {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", local ? "" : "postgresql://prueba@db.invalid:6543/postgres");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", local ? "" : "https://prueba.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", local ? "" : "clave-anonima-de-prueba");
  vi.stubEnv("RESEND_API_KEY", resend ? "re_prueba" : "");
  vi.stubEnv("CORREO_REMITENTE", resend ? "Subasta <subasta@prueba.test>" : "");
  vi.stubEnv("NEXT_PUBLIC_URL_SITIO", url);
  vi.stubEnv("CRON_SECRET", cron ? "secreto-de-prueba-largo" : "");
  return { ...(await import("@/lib/avisos")), ...(await import("@/lib/correo")) };
}

type Envio = { url: string; clave: string | undefined; para: string; asunto: string; texto: string };

/** Reemplaza fetch por un Resend falso que tarda `demora` ms y responde `estado`. */
function resendFalso({ demora = 0, estado = 200, cuerpo = '{"id":"prueba"}' } = {}) {
  const envios: Envio[] = [];
  const falso = vi.fn(async (url: string, init: RequestInit) => {
    await new Promise((r) => setTimeout(r, demora));
    const datos = JSON.parse(String(init.body));
    const encabezados = init.headers as Record<string, string>;
    envios.push({ url, clave: encabezados["Idempotency-Key"], para: datos.to[0], asunto: datos.subject, texto: datos.text });
    return new Response(cuerpo, { status: estado });
  });
  vi.stubGlobal("fetch", falso);
  return { envios, falso };
}

/** Todo lo que se escribió en la consola durante la prueba. */
function consola() {
  const espias = (["info", "log", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  return () => espias.flatMap((e) => e.mock.calls.map((args) => args.map(String).join(" "))).join("\n");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe("reserva de avisos en la base", () => {
  let db: PGlite;
  let avisoId: number;

  beforeAll(async () => {
    db = await baseDePrueba();
    ({ avisoId } = await anaSuperada(db));
  });

  it("la reserva no devuelve dos veces el mismo aviso y cuenta el intento al reservar", async () => {
    expect(await reservar(db)).toEqual([avisoId]);
    expect(await reservar(db)).toEqual([]);
    const fila = await aviso(db, avisoId);
    expect(fila).toMatchObject({ estado: "pendiente", intentos: 1 });
    expect(fila.reservado_hasta!.getTime()).toBeGreaterThan(Date.now());
  });

  it("si el envío se corta, vencido el plazo de la reserva se vuelve a tomar", async () => {
    await db.query("update public.avisos_correo set reservado_hasta = now() - interval '1 second' where id = $1", [
      avisoId,
    ]);
    expect(await reservar(db)).toEqual([avisoId]);
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "pendiente", intentos: 2 });
  });

  it("marcar_aviso no suma intentos ni cambia un aviso ya enviado", async () => {
    await db.query("select public.marcar_aviso($1, true)", [avisoId]);
    const enviado = await aviso(db, avisoId);
    expect(enviado).toMatchObject({ estado: "enviado", intentos: 2, reservado_hasta: null, ultimo_error: null });

    // Un segundo proceso que llega tarde (con error o con éxito) no lo toca.
    await db.query("select public.marcar_aviso($1, false, 'Falló el segundo envío')", [avisoId]);
    await db.query("select public.marcar_aviso($1, true)", [avisoId]);
    expect(await aviso(db, avisoId)).toEqual(enviado);
    expect(await reservar(db)).toEqual([]);
  });

  it("un aviso con 5 intentos ya no se reserva", async () => {
    const otro = await oferente(db, "carla@prueba.test", "20555666");
    const dario = await oferente(db, "dario@prueba.test", "20777888");
    expect((await ofertar(db, otro, OBRA(12), 10000)).ok).toBe(true);
    const r = await ofertar(db, dario, OBRA(12), 15000);
    await db.query("update public.avisos_correo set estado = 'error', intentos = 5 where id = $1", [r.aviso_id]);
    expect(await reservar(db)).toEqual([]);
  });

  it("marcar_aviso tampoco cambia un aviso descartado", async () => {
    const eva = await oferente(db, "eva@prueba.test", "20999000");
    const fede = await oferente(db, "fede@prueba.test", "21111222");
    expect((await ofertar(db, eva, OBRA(18), 10000)).ok).toBe(true);
    const id = Number((await ofertar(db, fede, OBRA(18), 15000)).aviso_id);
    await db.query("update public.avisos_correo set estado = 'descartado' where id = $1", [id]);
    await db.query("select public.marcar_aviso($1, true)", [id]);
    await db.query("select public.marcar_aviso($1, false, 'Falló')", [id]);
    expect(await aviso(db, id)).toMatchObject({ estado: "descartado", intentos: 0, enviado_at: null, ultimo_error: null });
    expect(await reservar(db)).toEqual([]);
  });
});

describe("un solo aviso vivo por persona y obra", () => {
  let db: PGlite;
  let ana: string;
  let beto: string;
  let avisoId: number;

  async function avisosDeAna() {
    return directo<{ id: number; estado: string }>(
      db,
      "select id::int as id, estado from public.avisos_correo where oferente_id = $1 and obra_id = $2 order by id",
      [ana, OBRA(6)],
    );
  }

  beforeAll(async () => {
    db = await baseDePrueba();
    ({ ana, beto, avisoId } = await anaSuperada(db));
  });

  it("un aviso en error (que se reintenta) no genera otro: ofertar() devuelve el mismo", async () => {
    expect(await reservar(db)).toEqual([avisoId]);
    await db.query("select public.marcar_aviso($1, false, 'Resend respondió 500')", [avisoId]);
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "error", intentos: 1 });

    // Ana vuelve a tener la oferta más alta y Beto la supera otra vez.
    expect((await ofertar(db, ana, OBRA(6), 20000)).ok).toBe(true);
    const r = await ofertar(db, beto, OBRA(6), 25000);
    expect(r.ok).toBe(true);
    expect(Number(r.aviso_id)).toBe(avisoId);
    expect(await avisosDeAna()).toEqual([{ id: avisoId, estado: "error" }]);
  });

  it("un aviso pendiente tampoco genera otro", async () => {
    await db.query("update public.avisos_correo set estado = 'pendiente', intentos = 0 where id = $1", [avisoId]);
    expect((await ofertar(db, ana, OBRA(6), 30000)).ok).toBe(true);
    expect(Number((await ofertar(db, beto, OBRA(6), 35000)).aviso_id)).toBe(avisoId);
    expect(await avisosDeAna()).toHaveLength(1);
  });

  it("si el anterior ya no se reintenta (5 intentos), se crea uno nuevo", async () => {
    await db.query("update public.avisos_correo set estado = 'error', intentos = 5 where id = $1", [avisoId]);
    expect((await ofertar(db, ana, OBRA(6), 40000)).ok).toBe(true);
    const r = await ofertar(db, beto, OBRA(6), 45000);
    expect(r.aviso_id).toBeTruthy();
    expect(Number(r.aviso_id)).not.toBe(avisoId);
    expect(await avisosDeAna()).toEqual([
      { id: avisoId, estado: "error" },
      { id: Number(r.aviso_id), estado: "pendiente" },
    ]);
  });

  it("no avisa si nadie tiene la oferta más alta (las ofertas se anularon)", async () => {
    const vivo = await directo<{ id: number }>(
      db,
      "select id::int as id from public.avisos_correo where oferente_id = $1 and estado = 'pendiente'",
      [ana],
    );
    expect(await mirar(db)).toEqual(vivo.map((f) => f.id));
    const ofertas = await directo<{ id: number }>(
      db,
      "select id::int as id from public.ofertas where obra_id = $1 and estado = 'valida'",
      [OBRA(6)],
    );
    for (const o of ofertas) {
      await como(db, { rol: "authenticated", uid: ADMIN }, (tx) =>
        tx.query("select public.anular_oferta($1, 'Anulación de prueba')", [o.id]),
      );
    }
    expect(await reservar(db)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("procesarAvisos", () => {
  let plantilla: PGlite;
  let db: PGlite;

  // Cada prueba parte de una copia de la misma base (más rápido que volver a migrar).
  beforeAll(async () => {
    plantilla = await baseDePrueba();
  });
  beforeEach(async () => {
    // clone() está tipado como PGliteInterface, pero devuelve una instancia de PGlite
    // (PGlite.create con el volcado de la base).
    db = (await plantilla.clone()) as PGlite;
    base.db = db;
  });
  afterEach(async () => {
    await db.close();
  });
  afterAll(async () => {
    await plantilla.close();
  });

  it("dos ejecuciones simultáneas no mandan dos veces el mismo aviso", async () => {
    const { ana, beto } = await anaSuperada(db, OBRA(6));
    for (const obra of [OBRA(12), OBRA(18)]) {
      expect((await ofertar(db, ana, obra, 10000)).ok).toBe(true);
      expect((await ofertar(db, beto, obra, 15000)).ok).toBe(true);
    }
    const { procesarAvisos } = await cargar({ local: false, resend: true });
    const { envios } = resendFalso({ demora: 30 });
    consola();

    const [a, b] = await Promise.all([procesarAvisos(), procesarAvisos()]);
    expect(a + b).toBe(3);
    expect(envios).toHaveLength(3);
    expect(new Set(envios.map((e) => e.clave)).size).toBe(3);
    for (const e of envios) {
      expect(e.url).toBe("https://api.resend.com/emails");
      expect(e.clave).toMatch(/^aviso-\d+-[0-9a-f]{16}$/);
      expect(e.para).toBe("ana@prueba.test");
    }
    const filas = await directo(db, "select estado, intentos, reservado_hasta from public.avisos_correo");
    expect(filas).toEqual(Array(3).fill({ estado: "enviado", intentos: 1, reservado_hasta: null }));

    // Una tercera ejecución ya no tiene nada para mandar.
    expect(await procesarAvisos()).toBe(0);
    expect(envios).toHaveLength(3);
  });

  it("con la etapa abierta invita a volver a ofertar", async () => {
    const { avisoId } = await anaSuperada(db);
    const { procesarAvisos } = await cargar({ local: false, resend: true });
    const { envios } = resendFalso();
    consola();

    expect(await procesarAvisos()).toBe(1);
    expect(envios[0].asunto).toBe("Superaron tu oferta por la obra N° 6");
    expect(envios[0].texto).toContain("Hola, Ana:");
    expect(envios[0].texto).toContain("Alguien superó tu oferta por la obra N° 6 — ");
    expect(envios[0].texto).toContain(`La oferta actual es de ${pesos(15000)}.`);
    expect(envios[0].texto).toContain(
      `Si querés volver a ofertar, la próxima oferta tiene que ser de al menos ${pesos(20000)}.`,
    );
    expect(envios[0].texto).toContain("La etapa virtual cierra el ");
    expect(envios[0].texto).toContain("Ver la obra: https://subasta.smt.gob.ar/obras/6");
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "enviado", intentos: 1 });
  });

  it("después del cierre no invita a volver a ofertar: informa la base de la subasta presencial", async () => {
    const { avisoId } = await anaSuperada(db);
    await cerrarEtapa(db);
    const { procesarAvisos } = await cargar({ local: true });
    const escrito = consola();

    expect(await procesarAvisos()).toBe(1);
    const texto = escrito();
    expect(texto).toContain(`La etapa virtual cerró. La obra pasa a subasta presencial con base de ${pesos(15000)}.`);
    expect(texto).toContain("La subasta presencial es el ");
    expect(texto).not.toContain("volver a ofertar");
    expect(texto).not.toContain("cierra el");
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "enviado" });
  });

  it("a una persona bloqueada no la invita a volver a ofertar", async () => {
    const { ana } = await anaSuperada(db);
    await db.query("update public.oferentes set bloqueado = true, bloqueo_motivo = 'Prueba de bloqueo' where id = $1", [
      ana,
    ]);
    const { procesarAvisos } = await cargar({ local: true });
    const escrito = consola();

    expect(await procesarAvisos()).toBe(1);
    const texto = escrito();
    expect(texto).toContain(`La oferta actual es de ${pesos(15000)}.`);
    expect(texto).not.toContain("volver a ofertar");
    expect(texto).not.toContain("cierra el");
  });

  it("en modo local, sin proveedor, escribe el correo en la consola y lo marca enviado", async () => {
    const { avisoId } = await anaSuperada(db);
    const { procesarAvisos } = await cargar({ local: true, url: "http://localhost:3000" });
    const { falso } = resendFalso();
    const escrito = consola();

    expect(await procesarAvisos()).toBe(1);
    expect(falso).not.toHaveBeenCalled();
    expect(escrito()).toContain("[correo sin enviar] Para: ana@prueba.test");
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "enviado", intentos: 1 });
  });

  it("fuera del modo local, sin proveedor, no escribe datos personales ni marca enviado ni gasta intentos", async () => {
    const { avisoId } = await anaSuperada(db);
    const { procesarAvisos, enviarCorreo } = await cargar({ local: false, resend: false });
    const { falso } = resendFalso();
    const escrito = consola();

    expect(await procesarAvisos()).toBe(0);
    expect(await procesarAvisos(50)).toBe(0);
    await expect(enviarCorreo({ para: "ana@prueba.test", asunto: "Prueba", texto: "Hola, Ana:" })).rejects.toThrow(
      "Falta configurar RESEND_API_KEY o CORREO_REMITENTE.",
    );
    expect(falso).not.toHaveBeenCalled();
    expect(escrito()).toContain("Avisos por correo: quedan pendientes, sin enviar.");
    expect(escrito()).not.toMatch(/ana@prueba\.test|Hola, Ana/);
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "pendiente", intentos: 0, reservado_hasta: null });

    // Cuando se configura el proveedor, el aviso sale.
    const despues = await cargar({ local: false, resend: true });
    const { envios } = resendFalso();
    expect(await despues.procesarAvisos()).toBe(1);
    expect(envios).toHaveLength(1);
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "enviado", intentos: 1 });
  });

  it("fuera del modo local, con la dirección del sitio local, deja los avisos pendientes", async () => {
    const { avisoId } = await anaSuperada(db);
    const { procesarAvisos } = await cargar({ local: false, resend: true, url: "http://localhost:3000" });
    const { falso } = resendFalso();
    const escrito = consola();

    expect(await procesarAvisos()).toBe(0);
    expect(falso).not.toHaveBeenCalled();
    expect(escrito()).toContain("NEXT_PUBLIC_URL_SITIO");
    expect(await aviso(db, avisoId)).toMatchObject({ estado: "pendiente", intentos: 0 });
  });

  it("si Resend rechaza el envío, queda en error sin el correo en el registro ni en los logs", async () => {
    const { avisoId } = await anaSuperada(db);
    const { procesarAvisos } = await cargar({ local: false, resend: true });
    resendFalso({
      estado: 422,
      cuerpo: '{"name":"validation_error","message":"Invalid `to` field: ana@prueba.test"}',
    });
    const escrito = consola();

    expect(await procesarAvisos()).toBe(0);
    const fila = await aviso(db, avisoId);
    expect(fila).toMatchObject({ estado: "error", intentos: 1, reservado_hasta: null });
    expect(fila.ultimo_error).toContain("Resend respondió 422");
    expect(fila.ultimo_error).not.toContain("ana@prueba.test");
    expect(escrito()).toContain(`No se pudo enviar el aviso ${avisoId}`);
    expect(escrito()).not.toContain("ana@prueba.test");
  });
});

// ---------------------------------------------------------------------------

describe("configuración que falta para los avisos", () => {
  it("en modo local no falta nada; fuera, se informa el correo, la dirección del sitio y el cron", async () => {
    consola();
    await cargar({ local: true, url: "http://localhost:3000", cron: false });
    expect((await import("@/lib/entorno")).faltasDeConfiguracion()).toEqual([]);
    await cargar({ local: false, resend: false, url: "http://localhost:3000", cron: false });
    expect((await import("@/lib/entorno")).faltasDeConfiguracion()).toEqual(["correo", "url_sitio", "cron"]);
    await cargar({ local: false, resend: true });
    expect((await import("@/lib/entorno")).faltasDeConfiguracion()).toEqual([]);
  });

  it("al arrancar fuera del modo local advierte lo que falta, sin cortar el arranque", async () => {
    delete (globalThis as { __subastaEntornoRevisado?: boolean }).__subastaEntornoRevisado;
    const escrito = consola();
    await cargar({ local: false, resend: false, cron: false });
    expect(escrito()).toContain("Configuración: Falta RESEND_API_KEY o CORREO_REMITENTE");
    expect(escrito()).toContain("Configuración: Falta CRON_SECRET");
    expect(escrito()).not.toContain("NEXT_PUBLIC_URL_SITIO");
  });
});
