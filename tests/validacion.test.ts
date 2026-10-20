import { describe, expect, it } from "vitest";
import { duracionEnPalabras } from "@/lib/formato";
import { MONTO_MAXIMO, montoDesdeTexto, numeroDeObra, rutaSegura } from "@/lib/validacion";

describe("rutaSegura", () => {
  it("devuelve tal cual las rutas internas", () => {
    expect(rutaSegura("/obras/7?x=1")).toBe("/obras/7?x=1");
    expect(rutaSegura("/obras/7/ofertar")).toBe("/obras/7/ofertar");
    expect(rutaSegura("/mis-ofertas")).toBe("/mis-ofertas");
    expect(rutaSegura("/")).toBe("/");
  });

  it("rechaza las que se resuelven a otra dirección", () => {
    for (const ruta of [
      "//evil.com",
      "/.//evil.com",
      "/..//evil.com",
      "/obras/..//evil.com",
      "/obras/.//evil.com",
      "/%2e%2e//evil.com",
      "/obras/%2E%2E//evil.com",
      "https://evil.com",
      "evil.com",
      "/\\evil.com",
      "/obras#//evil.com",
      "/.%2e//evil.com",
      "/%2F%2Fevil.com",
      "/%5c%5cevil.com",
    ]) {
      expect(rutaSegura(ruta), ruta).toBe("/obras");
    }
  });

  it("devuelve la ruta ya normalizada", () => {
    expect(rutaSegura("/obras/./7")).toBe("/obras/7");
    expect(rutaSegura("/obras/../mis-ofertas")).toBe("/mis-ofertas");
    // Lo que va en la consulta no cambia la ruta de destino.
    expect(rutaSegura("/ingresar?volver=%2F%2Fevil.com")).toBe("/ingresar?volver=%2F%2Fevil.com");
  });

  it("usa la ruta por defecto ante valores que no son rutas", () => {
    expect(rutaSegura(undefined)).toBe("/obras");
    expect(rutaSegura(null, "/")).toBe("/");
    expect(rutaSegura(["/obras/1"])).toBe("/obras");
    expect(rutaSegura("")).toBe("/obras");
    expect(rutaSegura(`/${"a".repeat(400)}`)).toBe("/obras");
  });
});

describe("montoDesdeTexto", () => {
  it("lee montos escritos con puntos, espacios o signo", () => {
    expect(montoDesdeTexto("55.000")).toBe(55000);
    expect(montoDesdeTexto("$ 55000")).toBe(55000);
    expect(montoDesdeTexto("55 000")).toBe(55000);
  });

  it("devuelve null sin cifras o con más de 10", () => {
    expect(montoDesdeTexto("")).toBeNull();
    expect(montoDesdeTexto("abc")).toBeNull();
    expect(montoDesdeTexto(null)).toBeNull();
    expect(montoDesdeTexto("12345678901")).toBeNull();
  });

  it("deja pasar 10 cifras para que el tope se avise con MONTO_MAXIMO", () => {
    expect(MONTO_MAXIMO).toBe(1_000_000_000);
    expect(montoDesdeTexto("3.000.000.000")).toBe(3_000_000_000);
    expect(montoDesdeTexto("3.000.000.000")! > MONTO_MAXIMO).toBe(true);
    expect(montoDesdeTexto("1.000.000.000")! > MONTO_MAXIMO).toBe(false);
  });
});

describe("numeroDeObra", () => {
  it("acepta de 1 a 3 cifras", () => {
    expect(numeroDeObra("7")).toBe(7);
    expect(numeroDeObra("025")).toBe(25);
    expect(numeroDeObra("1000")).toBeNull();
    expect(numeroDeObra("7a")).toBeNull();
  });
});

describe("duracionEnPalabras", () => {
  it("dice 'menos de un minuto' en el último minuto", () => {
    expect(duracionEnPalabras(59_999)).toBe("menos de un minuto");
    expect(duracionEnPalabras(1)).toBe("menos de un minuto");
  });

  it("arma días, horas y minutos", () => {
    expect(duracionEnPalabras(60_000)).toBe("1 minuto");
    expect(duracionEnPalabras(2 * 3_600_000 + 5 * 60_000)).toBe("2 horas y 5 minutos");
    expect(duracionEnPalabras(86_400_000 + 3_600_000 + 60_000)).toBe("1 día, 1 hora y 1 minuto");
  });

  it("con el plazo vencido no inventa tiempo", () => {
    expect(duracionEnPalabras(0)).toBe("0 minutos");
    expect(duracionEnPalabras(-5_000)).toBe("0 minutos");
  });
});
