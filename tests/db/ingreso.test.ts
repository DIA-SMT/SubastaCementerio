import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { opcionesCookie, vidaAcotada } from "@/lib/auth/cookies";
import { baseDePrueba, como, crearUsuario, registrar } from "./ayuda";

// Cliente de Supabase Auth simulado, para probar src/lib/auth/supabase.ts y src/proxy.ts sin
// conectarse (en modo local esos caminos no se recorren).
const simulado = vi.hoisted(() => ({
  error: null as null | { name: string; code?: string; status?: number; message: string },
  cookies: [] as { name: string; value: string; options: Record<string, unknown> }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: (name: string, value: string, options: Record<string, unknown>) => simulado.cookies.push({ name, value, options }),
  }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _clave: string,
    { cookieOptions, cookies }: { cookieOptions: object; cookies: { setAll: (...a: unknown[]) => void } },
  ) => {
    const resultado = async () => ({ data: { user: { id: "u1" } }, error: simulado.error });
    return {
      cookieOptions,
      auth: {
        signInWithOtp: resultado,
        verifyOtp: resultado,
        signInWithPassword: resultado,
        // Como @supabase/ssr al renovar la sesión: los encabezados anti-caché llegan solo en la
        // primera escritura de cookies.
        getClaims: async () => {
          cookies.setAll([{ name: "sb-token", value: "v1", options: { path: "/", maxAge: 400 * 86400 } }], {
            "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
            Expires: "0",
            Pragma: "no-cache",
          });
          cookies.setAll([{ name: "sb-token.1", value: "", options: { path: "/", maxAge: 0 } }], {});
          return { data: null };
        },
      },
    };
  },
}));

// El servidor llama a estas funciones con el rol de servicio (en las pruebas, el usuario dueño).
async function llamar(db: PGlite, sql: string, params: unknown[]) {
  const { rows } = await db.query<{ r: string }>(`select ${sql} as r`, params);
  return rows[0].r;
}
const pedir = (db: PGlite, correo: string, ip: string | null = "200.1.1.1") =>
  llamar(db, "public.ingreso_pedir_codigo($1, $2)", [correo, ip]);
const probarCodigo = (db: PGlite, correo: string) => llamar(db, "public.ingreso_probar_codigo($1)", [correo]);
const probarContrasena = (db: PGlite, correo: string, ip: string | null = "200.1.1.1") =>
  llamar(db, "public.ingreso_probar_contrasena($1, $2)", [correo, ip]);

/** Simula el paso del tiempo corriendo hacia atrás los intentos registrados. */
async function envejecer(db: PGlite, intervalo: string) {
  await db.query(`update public.intentos_ingreso set creado_at = creado_at - interval '${intervalo}'`);
}

describe("límites de ingreso", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseDePrueba(false);
  });
  beforeEach(async () => {
    await db.query("delete from public.intentos_ingreso");
  });

  it("pedir código: 3 por correo cada 15 minutos, sin importar mayúsculas", async () => {
    expect(await pedir(db, "ana@prueba.test")).toBe("ok");
    expect(await pedir(db, "Ana@Prueba.test")).toBe("ok");
    expect(await pedir(db, " ana@prueba.test ", "200.9.9.9")).toBe("ok");
    expect(await pedir(db, "ana@prueba.test", "200.8.8.8")).toBe("limite_correo");
    expect(await pedir(db, "beto@prueba.test")).toBe("ok");

    await envejecer(db, "16 minutes");
    expect(await pedir(db, "ana@prueba.test")).toBe("ok");
  });

  it("pedir código: 20 por IP por hora", async () => {
    for (let i = 0; i < 20; i++) expect(await pedir(db, `persona${i}@prueba.test`)).toBe("ok");
    expect(await pedir(db, "otra@prueba.test")).toBe("limite_ip");
    expect(await pedir(db, "otra@prueba.test", "200.2.2.2")).toBe("ok");
    // Sin IP conocida solo cuenta el correo.
    expect(await pedir(db, "sin-ip@prueba.test", null)).toBe("ok");

    await envejecer(db, "61 minutes");
    expect(await pedir(db, "otra@prueba.test")).toBe("ok");
  });

  it("no guarda correos ni IP en claro", async () => {
    await pedir(db, "ana@prueba.test", "200.1.1.1");
    const { rows } = await db.query<{ clave: string }>("select clave from public.intentos_ingreso");
    expect(rows).toHaveLength(2);
    for (const { clave } of rows) expect(clave).toMatch(/^[0-9a-f]{64}$/);
  });

  it("probar código: hace falta un pedido reciente y hay 5 pruebas por código", async () => {
    expect(await probarCodigo(db, "ana@prueba.test")).toBe("sin_codigo");

    await pedir(db, "ana@prueba.test");
    for (let i = 0; i < 5; i++) expect(await probarCodigo(db, "ana@prueba.test")).toBe("ok");
    expect(await probarCodigo(db, "ana@prueba.test")).toBe("limite_correo");
    // Otro correo no se ve afectado.
    await pedir(db, "beto@prueba.test");
    expect(await probarCodigo(db, "beto@prueba.test")).toBe("ok");

    // Un código nuevo habilita otras 5 pruebas.
    await envejecer(db, "1 second");
    await pedir(db, "ana@prueba.test");
    expect(await probarCodigo(db, "ana@prueba.test")).toBe("ok");

    // Pasada una hora del último pedido, el código ya no puede estar vigente.
    await envejecer(db, "61 minutes");
    expect(await probarCodigo(db, "ana@prueba.test")).toBe("sin_codigo");
  });

  it("contraseña del panel: 5 intentos por correo o por IP bloquean 15 minutos", async () => {
    for (let i = 0; i < 5; i++) expect(await probarContrasena(db, "equipo@prueba.test", `200.3.3.${i}`)).toBe("ok");
    expect(await probarContrasena(db, "equipo@prueba.test", "200.4.4.4")).toBe("limite_correo");

    for (let i = 0; i < 5; i++) expect(await probarContrasena(db, `otro${i}@prueba.test`, "200.5.5.5")).toBe("ok");
    expect(await probarContrasena(db, "nuevo@prueba.test", "200.5.5.5")).toBe("limite_ip");

    await envejecer(db, "16 minutes");
    expect(await probarContrasena(db, "equipo@prueba.test", "200.4.4.4")).toBe("ok");
    expect(await probarContrasena(db, "nuevo@prueba.test", "200.5.5.5")).toBe("ok");
  });

  it("con la contraseña correcta, los intentos anteriores dejan de contar", async () => {
    for (let i = 0; i < 4; i++) await probarContrasena(db, "equipo@prueba.test");
    await db.query("select public.ingreso_contrasena_correcta($1, $2)", ["equipo@prueba.test", "200.1.1.1"]);
    for (let i = 0; i < 5; i++) expect(await probarContrasena(db, "equipo@prueba.test")).toBe("ok");
    expect(await probarContrasena(db, "equipo@prueba.test")).toBe("limite_correo");
  });

  it("borra los intentos de más de un día", async () => {
    await pedir(db, "ana@prueba.test");
    await envejecer(db, "25 hours");
    await pedir(db, "beto@prueba.test");
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.intentos_ingreso");
    expect(rows[0].n).toBe(2);
  });

  it("el público y los oferentes no acceden a la tabla ni a las funciones", async () => {
    const uid = await crearUsuario(db, "curioso@prueba.test");
    for (const rol of [{ rol: "anon" } as const, { rol: "authenticated", uid } as const]) {
      await expect(como(db, rol, (tx) => tx.query("select * from public.intentos_ingreso"))).rejects.toThrow(
        /permission denied/,
      );
      for (const sql of [
        "select public.ingreso_pedir_codigo('a@b.test', null)",
        "select public.ingreso_probar_codigo('a@b.test')",
        "select public.ingreso_probar_contrasena('a@b.test', null)",
        "select public.ingreso_contrasena_correcta('a@b.test', null)",
      ]) {
        await expect(como(db, rol, (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
      }
    }
  });
});

describe("registro con un DNI que ya participa", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseDePrueba(false);
    const duena = await crearUsuario(db, "duena@prueba.test");
    expect((await registrar(db, duena, "20111222")).ok).toBe(true);
  });

  const auditoria = (uid: string) =>
    db
      .query<{ actor_tipo: string; tabla: string; detalle: Record<string, unknown> }>(
        "select actor_tipo, tabla, detalle from public.auditoria where accion = 'dni_duplicado' and actor_id = $1 order by id",
        [uid],
      )
      .then((r) => r.rows);

  it("queda en la auditoría con el DNI enmascarado y sin el correo", async () => {
    const uid = await crearUsuario(db, "prueba1@prueba.test");
    expect(await registrar(db, uid, "20.111.222")).toMatchObject({ ok: false, codigo: "dni_registrado" });

    const filas = await auditoria(uid);
    // La auditoría no se puede borrar: no guarda el DNI completo ni el correo (actor_id ya
    // identifica la cuenta).
    expect(filas).toEqual([{ actor_tipo: "oferente", tabla: "oferentes", detalle: { dni: "*****222" } }]);
    expect(JSON.stringify(filas)).not.toContain("20111222");
    expect(JSON.stringify(filas)).not.toContain("prueba1@");
  });

  it("desde el tercer intento responde demasiados_intentos, sea cual sea el DNI", async () => {
    const uid = await crearUsuario(db, "prueba2@prueba.test");
    expect(await registrar(db, uid, "20111222")).toMatchObject({ codigo: "dni_registrado" });
    expect(await registrar(db, uid, "20111222")).toMatchObject({ codigo: "dni_registrado" });
    expect(await registrar(db, uid, "20111222")).toMatchObject({ codigo: "demasiados_intentos" });
    // Tampoco puede registrarse con un DNI libre: así no se distingue cuál existe.
    expect(await registrar(db, uid, "30999888")).toMatchObject({ codigo: "demasiados_intentos" });
    expect(await auditoria(uid)).toHaveLength(2);

    const { rows } = await db.query("select 1 from public.oferentes where id = $1", [uid]);
    expect(rows).toHaveLength(0);
  });

  it("el límite es por cuenta", async () => {
    const uid = await crearUsuario(db, "prueba3@prueba.test");
    expect(await registrar(db, uid, "20111222")).toMatchObject({ codigo: "dni_registrado" });
    expect(await registrar(db, uid, "30999777")).toMatchObject({ ok: true });
  });

  it("los oferentes no pueden escribir en la auditoría por fuera del registro", async () => {
    const uid = await crearUsuario(db, "prueba4@prueba.test");
    await expect(
      como(db, { rol: "authenticated", uid }, (tx) =>
        tx.query("select public.auditar_dni_duplicado($1, '12345678')", [uid]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("cookies de sesión de Supabase", () => {
  it("no quedan al alcance de los scripts de la página", () => {
    expect(opcionesCookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("duran como máximo 7 días y se pueden borrar al cerrar la sesión", () => {
    // @supabase/ssr siempre pide 400 días.
    expect(vidaAcotada({ ...opcionesCookie, maxAge: 400 * 24 * 60 * 60 })).toMatchObject({
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
    });
    expect(vidaAcotada({ maxAge: 3600 }).maxAge).toBe(3600);
    expect(vidaAcotada({ maxAge: 0 }).maxAge).toBe(0);
    expect(vidaAcotada({ path: "/" }).maxAge).toBeUndefined();
  });

  it("el cliente del servidor las escribe httpOnly y con vida acotada", async () => {
    const { clienteSupabase } = await import("@/lib/auth/supabase");
    simulado.cookies = [];
    const cliente = (await clienteSupabase()) as unknown as { cookieOptions: object; auth: { getClaims(): Promise<unknown> } };
    expect(cliente.cookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    await cliente.auth.getClaims();
    expect(simulado.cookies.map((c) => [c.name, c.options.maxAge])).toEqual([
      ["sb-token", 7 * 86400],
      ["sb-token.1", 0],
    ]);
  });

  it("el proxy conserva todas las cookies y los encabezados anti-caché al rehacer la respuesta", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    process.env.DATABASE_URL = "postgres://prueba";
    try {
      const r = await proxy(new NextRequest("https://sitio.test/mis-ofertas"));
      expect(r.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
      expect(r.headers.get("pragma")).toBe("no-cache");
      expect(r.headers.get("expires")).toBe("0");
      const enviadas = r.headers.getSetCookie();
      expect(enviadas.find((c) => c.startsWith("sb-token=v1;"))).toMatch(/Max-Age=604800/);
      expect(enviadas.find((c) => c.startsWith("sb-token.1=;"))).toMatch(/Max-Age=0/);
    } finally {
      delete process.env.DATABASE_URL;
    }
  });
});

describe("errores de Supabase Auth", () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "error").mockImplementation((...partes: unknown[]) => void logs.push(partes.join(" ")));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    simulado.error = null;
  });

  type Caso = [name: string, code: string | undefined, status: number | undefined, esperado: string];
  async function probar(fn: () => Promise<unknown>, casos: Caso[]) {
    for (const [name, code, status, esperado] of casos) {
      simulado.error = { name, code, status, message: 'Email address "persona@gmail.com" is invalid' };
      expect(await fn(), `${code}/${status}`).toEqual({ ok: false, error: esperado });
    }
  }

  it("pedir código: errores de configuración y de límites con texto propio, sin correos en los logs", async () => {
    const { enviarCodigo } = await import("@/lib/auth/supabase");
    await probar(
      () => enviarCodigo("persona@gmail.com"),
      [
        ["AuthApiError", "email_address_not_authorized", 400, "correo_no_autorizado"],
        ["AuthApiError", "over_email_send_rate_limit", 429, "limite_correos"],
        ["AuthApiError", "email_address_invalid", 400, "correo_invalido"],
        ["AuthApiError", "over_request_rate_limit", 429, "servicio_ocupado"],
        ["AuthRetryableFetchError", undefined, 0, "error_servicio"],
        ["AuthApiError", "unexpected_failure", 500, "error_servicio"],
      ],
    );
    expect(logs.join("\n")).not.toContain("persona@gmail.com");
    expect(logs.join("\n")).toContain("<correo>");
  });

  it("verificar código: otp_expired es incorrecto o vencido; la red o un 5xx, una falla del servicio", async () => {
    const { verificarCodigo } = await import("@/lib/auth/supabase");
    await probar(
      () => verificarCodigo("persona@gmail.com", "123456"),
      [
        ["AuthApiError", "otp_expired", 403, "codigo_invalido_o_vencido"],
        ["AuthApiError", "validation_failed", 400, "codigo_incorrecto"],
        ["AuthApiError", "over_request_rate_limit", 429, "servicio_ocupado"],
        ["AuthRetryableFetchError", undefined, 0, "error_servicio"],
        ["AuthApiError", "unexpected_failure", 502, "error_servicio"],
      ],
    );
  });

  it("contraseña del panel: un 429 o un 5xx no se informan como contraseña incorrecta", async () => {
    const { ingresarConContrasena } = await import("@/lib/auth/supabase");
    await probar(
      () => ingresarConContrasena("persona@gmail.com", "x"),
      [
        ["AuthApiError", "invalid_credentials", 400, "credenciales_invalidas"],
        ["AuthApiError", "over_request_rate_limit", 429, "servicio_ocupado"],
        ["AuthApiError", "unexpected_failure", 500, "error_servicio"],
      ],
    );
  });
});
