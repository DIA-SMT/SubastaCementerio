import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ingreso de oferentes con Cidituc: validación del token, sesión propia y el viaje de ida y
// vuelta al derivador. El backend municipal y la base se simulan.

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
  vi.stubEnv("CIDITUC_DERIVADOR_URL", "https://cidituc.smt.gob.ar");
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

describe("ida y vuelta por el derivador", () => {
  const flujo = () => import("@/lib/auth/cidituc/flujo");
  const pedido = (url: string, cookie?: string) =>
    new NextRequest(url, cookie ? { headers: { cookie: `subasta_cidituc=${cookie}` } } : undefined);

  it("el inicio guarda el nonce y el destino, y manda al derivador con la clave de la subasta", async () => {
    const r = (await flujo()).inicioCidituc(pedido("https://subasta.test/auth/cidituc/inicio?volver=/obras/7/ofertar"));
    expect(r.status).toBe(303);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.origin + destino.pathname).toBe("https://cidituc.smt.gob.ar/");
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

  it("distingue las tres formas de fallar el state", async () => {
    const { callbackCidituc } = await flujo();
    const casos: [string, string | undefined, string][] = [
      [`auth=${TOKEN}`, "abc|/obras", "state-ausente"],
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
