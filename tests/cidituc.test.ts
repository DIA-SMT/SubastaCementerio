import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ingreso de oferentes con Cidituc: validación del token, sesión propia y el viaje de ida y
// vuelta al login de Ciudad Digital. El backend municipal y la base se simulan.

const simulado = vi.hoisted(() => ({
  respuesta: { status: 200, body: "{}" } as { status: number; body: string } | Error,
  llamadas: [] as { url: string; token: string }[],
  oferente: false,
  personas: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => {} }) }));
vi.mock("@/lib/auth/cidituc/transporte", () => ({
  getDeCidituc: async (url: string, token: string) => {
    simulado.llamadas.push({ url, token });
    if (simulado.respuesta instanceof Error) throw simulado.respuesta;
    return simulado.respuesta;
  },
  motivoDeFallo: (e: Error) => e.message,
}));
vi.mock("@/lib/datos/oferente", () => ({
  registrarIngresoCidituc: async (datos: Record<string, unknown>) => {
    simulado.personas.push(datos);
    return "6f1b5b3e-2a4c-4d8e-9f00-0123456789ab";
  },
  esOferente: async () => simulado.oferente,
}));

const PERSONA = {
  id_persona: 4321,
  documento_persona: 20071234563,
  nombre_persona: "MARIA DEL VALLE",
  apellido_persona: "DI STEFANO",
  email_persona: " Maria@Correo.COM ",
  validado: 1,
  habilita: null,
};
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.token-de-prueba.firma";

function configurar(habilitado = true) {
  vi.resetModules();
  vi.stubEnv("CIDITUC_HABILITADO", habilitado ? "1" : "");
  vi.stubEnv("CIDITUC_LOGIN_URL", "https://ciudaddigital.smt.gob.ar");
  vi.stubEnv("CIDITUC_API_URL", "https://estadisticas.smt.gob.ar:5000/");
  vi.stubEnv("CIDITUC_CALLBACK_URL", "https://subasta.test/auth/cidituc/callback");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
}

beforeEach(() => {
  simulado.respuesta = { status: 200, body: JSON.stringify({ usuarioSinContraseña: PERSONA }) };
  simulado.llamadas = [];
  simulado.oferente = false;
  simulado.personas = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  configurar();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validación del token", () => {
  const validar = async () => (await import("@/lib/auth/cidituc/persona")).validarToken(TOKEN);

  it("consulta authStatus con el token crudo (sin Bearer) y normaliza a la persona", async () => {
    expect(await validar()).toEqual({
      ok: true,
      persona: {
        id: "4321",
        cuil: "20071234563",
        // Un DNI de 7 dígitos ocupa 8 lugares en el CUIL: el cero de adelante se saca.
        dni: "7123456",
        nombre: "MARIA DEL VALLE",
        apellido: "DI STEFANO",
        email: "maria@correo.com",
      },
    });
    expect(simulado.llamadas).toEqual([{ url: "https://estadisticas.smt.gob.ar:5000/usuarios/authStatus", token: TOKEN }]);
  });

  it("acepta la persona envuelta en user o sin envoltorio", async () => {
    for (const cuerpo of [{ user: PERSONA }, PERSONA]) {
      simulado.respuesta = { status: 200, body: JSON.stringify(cuerpo) };
      expect(await validar()).toMatchObject({ ok: true, persona: { id: "4321", dni: "7123456" } });
    }
  });

  it("distingue token inválido, cuenta dada de baja y backend no disponible", async () => {
    simulado.respuesta = { status: 401, body: "" };
    expect(await validar()).toEqual({ ok: false, motivo: "token-invalido" });

    simulado.respuesta = { status: 200, body: JSON.stringify({ usuarioSinContraseña: { ...PERSONA, habilita: "baja" } }) };
    expect(await validar()).toEqual({ ok: false, motivo: "cuenta-inactiva" });

    simulado.respuesta = { status: 404, body: "" };
    expect(await validar()).toEqual({ ok: false, motivo: "no-disponible" });

    simulado.respuesta = new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(await validar()).toEqual({ ok: false, motivo: "no-disponible" });
  });

  it("sin la integración habilitada no consulta a nadie", async () => {
    configurar(false);
    expect(await validar()).toEqual({ ok: false, motivo: "sin-configurar" });
    expect(simulado.llamadas).toEqual([]);
  });
});

describe("sesión del oferente", () => {
  const ID = "6f1b5b3e-2a4c-4d8e-9f00-0123456789ab";

  it("se verifica con la misma firma y rechaza una alterada", async () => {
    const { crearSesion, verificarSesion } = await import("@/lib/auth/ciudadano");
    const token = crearSesion(ID);
    expect(verificarSesion(token)).toEqual({ id: ID });

    const [payload, firma] = token.split(".");
    const otro = Buffer.from(JSON.stringify({ v: 1, id: "00000000-0000-4000-8000-000000000000", exp: 9e9 })).toString(
      "base64url",
    );
    expect(verificarSesion(`${otro}.${firma}`)).toBeNull();
    expect(verificarSesion(`${payload}.x${firma.slice(1)}`)).toBeNull();
    expect(verificarSesion(undefined)).toBeNull();
  });

  it("vence a los 7 días", async () => {
    const { crearSesion, verificarSesion } = await import("@/lib/auth/ciudadano");
    const token = crearSesion(ID);
    vi.useFakeTimers({ now: Date.now() + 7 * 24 * 3600 * 1000 + 1000 });
    try {
      expect(verificarSesion(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("en producción no abre sesiones sin SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "corto");
    const { crearSesion } = await import("@/lib/auth/ciudadano");
    expect(() => crearSesion(ID)).toThrow(/SESSION_SECRET/);
  });
});

describe("ida y vuelta por el login de Ciudad Digital", () => {
  const flujo = () => import("@/lib/auth/cidituc/flujo");
  const pedido = (url: string, cookie?: string) =>
    new NextRequest(url, cookie ? { headers: { cookie: `subasta_cidituc=${cookie}` } } : undefined);

  it("el inicio guarda el nonce y el destino, y manda al login con la clave de la subasta", async () => {
    const r = (await flujo()).inicioCidituc(pedido("https://subasta.test/auth/cidituc/inicio?volver=/obras/7/ofertar"));
    expect(r.status).toBe(303);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.origin + destino.pathname).toBe("https://ciudaddigital.smt.gob.ar/");
    // Sin ?logout: quien ya tiene la sesión de Ciudad Digital vuelve sin poner la contraseña.
    expect(destino.search).toBe("");
    const hash = new URLSearchParams(destino.hash.replace(/^#\/login\?/, ""));
    expect(hash.get("next")).toBe("subasta-cementerio");
    const cookie = r.cookies.get("subasta_cidituc");
    expect(cookie?.value).toBe(`${hash.get("state")}|/obras/7/ofertar`);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 600 });
  });

  it("el inicio no acepta volver a otro sitio ni al ingreso mismo", async () => {
    for (const volver of ["https://otro.sitio", "//otro.sitio", "/auth/cidituc/inicio", "/ingresar"]) {
      const r = (await flujo()).inicioCidituc(
        pedido(`https://subasta.test/auth/cidituc/inicio?volver=${encodeURIComponent(volver)}`),
      );
      expect(r.cookies.get("subasta_cidituc")?.value, volver).toMatch(/\|\/obras$/);
    }
  });

  it("sin configuración vuelve al ingreso con el error", async () => {
    configurar(false);
    const r = (await flujo()).inicioCidituc(pedido("https://subasta.test/auth/cidituc/inicio"));
    expect(r.headers.get("location")).toBe("https://subasta.test/ingresar?error=sin-configurar");
  });

  it("el reintento con limpiar=1 cierra antes la sesión guardada en Ciudad Digital", async () => {
    const r = (await flujo()).inicioCidituc(pedido("https://subasta.test/auth/cidituc/inicio?volver=/obras&limpiar=1"));
    const destino = new URL(r.headers.get("location")!);
    // El logout va antes del #: el sitio lo lee de la query real, no del fragmento.
    expect(destino.searchParams.get("logout")).toBe("1");
    expect(destino.hash).toMatch(/^#\/login\?next=subasta-cementerio&state=/);
  });

  it("solo el token inválido pide limpiar al reintentar", async () => {
    const { reintentoLimpia } = await import("@/lib/auth/cidituc/errores");
    expect(reintentoLimpia("token-invalido")).toBe(true);
    for (const otro of ["no-disponible", "state-vencido", "sesion-fallida", undefined]) {
      expect(reintentoLimpia(otro), String(otro)).toBe(false);
    }
  });

  it("el cierre de sesión pasa por el logout de Ciudad Digital", async () => {
    const { salidaCidituc } = await import("@/lib/auth/cidituc/config");
    expect(salidaCidituc()).toBe("https://ciudaddigital.smt.gob.ar/?logout=1");
    configurar(false);
    expect((await import("@/lib/auth/cidituc/config")).salidaCidituc()).toBe("/");
  });

  it("el login no devuelve el state: alcanza con la cookie del flujo", async () => {
    simulado.oferente = true;
    const r = await (await flujo()).callbackCidituc(
      pedido(`https://subasta.test/auth/cidituc/callback?auth=${TOKEN}`, "abc|/obras/7"),
    );
    expect(r.headers.get("location")).toBe("https://subasta.test/obras/7");
    expect(r.cookies.get("subasta_oferente")?.value).toBeTruthy();
  });

  it("rechaza la vuelta sin cookie del flujo y un state que no es el nuestro", async () => {
    const { callbackCidituc } = await flujo();
    const casos: [string, string | undefined, string][] = [
      // Un enlace al callback armado por otro: el ingreso no empezó en este navegador.
      [`auth=${TOKEN}`, undefined, "state-vencido"],
      [`auth=${TOKEN}&state=abc`, undefined, "state-vencido"],
      [`auth=${TOKEN}&state=otro`, "abc|/obras/3", "state-distinto"],
    ];
    for (const [query, cookie, error] of casos) {
      const r = await callbackCidituc(pedido(`https://subasta.test/auth/cidituc/callback?${query}`, cookie));
      const destino = new URL(r.headers.get("location")!);
      expect(destino.pathname).toBe("/ingresar");
      expect(destino.searchParams.get("error")).toBe(error);
      expect(r.cookies.get("subasta_oferente")).toBeUndefined();
    }
    expect(simulado.llamadas).toEqual([]);
  });

  it("con el token válido guarda a la persona, abre la sesión y la primera vez pide completar los datos", async () => {
    const { callbackCidituc } = await flujo();
    const { verificarSesion } = await import("@/lib/auth/ciudadano");
    const r = await callbackCidituc(
      pedido(`https://subasta.test/auth/cidituc/callback?auth=${TOKEN}&state=abc`, "abc|/obras/7/ofertar"),
    );
    expect(r.headers.get("location")).toBe("https://subasta.test/registro?volver=%2Fobras%2F7%2Fofertar");
    expect(simulado.personas).toEqual([
      {
        ciditucId: "4321",
        cuil: "20071234563",
        dni: "7123456",
        nombre: "Maria del Valle",
        apellido: "Di Stefano",
        email: "maria@correo.com",
      },
    ]);
    const sesion = r.cookies.get("subasta_oferente");
    expect(verificarSesion(sesion?.value)).toEqual({ id: "6f1b5b3e-2a4c-4d8e-9f00-0123456789ab" });
    expect(sesion).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 });
    expect(r.cookies.get("subasta_cidituc")?.value).toBe("");
  });

  it("quien ya se registró vuelve directo a donde estaba", async () => {
    simulado.oferente = true;
    const r = await (await flujo()).callbackCidituc(
      pedido(`https://subasta.test/auth/cidituc/callback?auth=${TOKEN}&state=abc`, "abc|/obras/7/ofertar"),
    );
    expect(r.headers.get("location")).toBe("https://subasta.test/obras/7/ofertar");
  });

  it("una sesión de una persona que ya no existe se descarta y vuelve al ingreso", async () => {
    const r = (await flujo()).descartarSesion(pedido("https://subasta.test/auth/cidituc/descartar?volver=/obras/7"));
    expect(r.headers.get("location")).toBe("https://subasta.test/ingresar?volver=%2Fobras%2F7");
    expect(r.cookies.get("subasta_oferente")).toMatchObject({ value: "", maxAge: 0 });
  });

  it("si Cidituc rechaza el token, vuelve al ingreso conservando el destino y sin sesión", async () => {
    simulado.respuesta = { status: 401, body: "" };
    const r = await (await flujo()).callbackCidituc(
      pedido(`https://subasta.test/auth/cidituc/callback?auth=${TOKEN}&state=abc`, "abc|/obras/7/ofertar"),
    );
    expect(r.headers.get("location")).toBe(
      "https://subasta.test/ingresar?error=token-invalido&volver=%2Fobras%2F7%2Fofertar",
    );
    expect(r.cookies.get("subasta_oferente")).toBeUndefined();
  });
});

describe("mensajes de error en el ingreso", () => {
  it("solo muestra códigos conocidos", async () => {
    const { textoDeError } = await import("@/lib/auth/cidituc/errores");
    expect(textoDeError("state-vencido")).toMatch(/venció/);
    expect(textoDeError("<script>")).toBeNull();
    expect(textoDeError(["state-vencido"])).toBeNull();
  });
});
