import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** urlSitio se lee al importar src/lib/entorno.ts: cada caso importa de nuevo con su entorno. */
async function conSitio(url: string | undefined) {
  vi.resetModules();
  if (url === undefined) vi.stubEnv("NEXT_PUBLIC_URL_SITIO", "");
  else vi.stubEnv("NEXT_PUBLIC_URL_SITIO", url);
  return (await import("@/lib/origen")).urlDelSitio;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("la dirección pública para redirigir", () => {
  it("en el servidor propio no usa la dirección interna de nginx (127.0.0.1:3008)", async () => {
    const urlDelSitio = await conSitio("https://subastas.smt.gob.ar");
    expect(urlDelSitio("/ingresar?error=token-invalido", "https://localhost:3008/auth/cidituc/callback").toString()).toBe(
      "https://subastas.smt.gob.ar/ingresar?error=token-invalido",
    );
  });

  it("en desarrollo usa la del pedido, así anda en cualquier puerto", async () => {
    const urlDelSitio = await conSitio(undefined);
    expect(urlDelSitio("/registro", "http://localhost:3010/auth/cidituc/callback").toString()).toBe("http://localhost:3010/registro");
  });

  it("la ruta queda en este sitio aunque venga con otro dominio", async () => {
    const urlDelSitio = await conSitio("https://subastas.smt.gob.ar");
    expect(urlDelSitio("/obras/7", "https://localhost:3008/x").host).toBe("subastas.smt.gob.ar");
  });
});
