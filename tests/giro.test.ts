import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { cuadrosDelGiro } = await import("@/lib/datos/publico");

const foto = (n: number, ancho: number | null = 1125, alto: number | null = 2000) => ({
  ruta: `obra-1/${n}.jpg`,
  alt: `Vista ${n}`,
  ancho,
  alto,
});

describe("cuadros del giro 360° de la tarjeta", () => {
  it("toma todas las fotos cuando son de la misma sesión (mismas medidas)", () => {
    const fotos = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => foto(n));
    expect(cuadrosDelGiro(fotos)).toEqual(fotos);
  });

  it("corta en la primera foto con otras medidas: esa queda solo en la galería", () => {
    const fotos = [foto(1), foto(2), foto(3), foto(4, 1068, 1600), foto(5)];
    expect(cuadrosDelGiro(fotos).map((f) => f.ruta)).toEqual(["obra-1/1.jpg", "obra-1/2.jpg", "obra-1/3.jpg"]);
  });

  it("sin giro con una sola foto, sin fotos o sin medidas conocidas", () => {
    expect(cuadrosDelGiro([foto(1)])).toEqual([]);
    expect(cuadrosDelGiro([])).toEqual([]);
    expect(cuadrosDelGiro([foto(1, null, null), foto(2, null, null)])).toEqual([]);
  });

  it("una portada distinta de las demás deja la tarjeta sin giro", () => {
    expect(cuadrosDelGiro([foto(1, 1068, 1600), foto(2), foto(3)])).toEqual([]);
  });
});
