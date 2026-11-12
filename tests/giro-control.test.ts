import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ROTATIONS,
  MS_POR_VUELTA,
  VISTAS,
  giroActivo,
  msPorCuadro,
  posicionDelGiro,
  soltarGiro,
  tomarGiro,
  vistaIntermedia,
} from "@/lib/giro";

describe("posición del giro 360°", () => {
  it("avanza de forma continua entre una foto y la siguiente", () => {
    expect(posicionDelGiro(0, 0, 8)).toMatchObject({ desde: 0, hacia: 1, t: 0 });
    expect(posicionDelGiro(250, 0, 8)).toMatchObject({ desde: 0, hacia: 1, t: 0.5 });
    expect(posicionDelGiro(1000, 3, 8)).toMatchObject({ desde: 5, hacia: 6, t: 0 });
    // De la última foto vuelve a la primera.
    expect(posicionDelGiro(3750, 0, 8)).toMatchObject({ desde: 7, hacia: 0, t: 0.5 });
  });

  it.each([8, 16, 24, 36, 11])("con %i fotos la vuelta dura lo mismo", (total) => {
    expect(msPorCuadro(total) * total).toBeCloseTo(MS_POR_VUELTA);
    expect(posicionDelGiro(MS_POR_VUELTA, 2, total)).toMatchObject({ desde: 2 });
    expect(posicionDelGiro(MS_POR_VUELTA / 2, 0, total).progreso).toBeCloseTo(1 / (2 * MAX_ROTATIONS));
  });

  it(`se detiene sola a las ${MAX_ROTATIONS} vueltas, en la foto de inicio`, () => {
    for (const total of [8, 16, 24, 36]) {
      const tope = MS_POR_VUELTA * MAX_ROTATIONS;
      expect(posicionDelGiro(tope - 1, 5, total).terminado).toBe(false);
      const fin = posicionDelGiro(tope, 5, total);
      expect(fin).toMatchObject({ desde: 5 % total, t: 0, terminado: true, progreso: 1 });
      // Seguir encima o presionando no la reinicia.
      expect(posicionDelGiro(tope * 10, 5, total)).toEqual(fin);
    }
  });

  it("el máximo de vueltas y la duración se pueden cambiar", () => {
    expect(posicionDelGiro(1000, 0, 4, { msPorVuelta: 1000, maxVueltas: 1 })).toMatchObject({ desde: 0, terminado: true });
    expect(posicionDelGiro(500, 0, 4, { maxVueltas: 2 }).progreso).toBeCloseTo(1 / 16);
  });

  it("sin secuencia no gira", () => {
    expect(posicionDelGiro(1000, 0, 1).terminado).toBe(true);
    expect(posicionDelGiro(1000, 0, 0).terminado).toBe(true);
  });
});

describe("vistas intermedias", () => {
  it("al empezar y al terminar cada paso, las fotos quedan derechas y en su lugar", () => {
    const inicio = vistaIntermedia(0);
    expect(Math.abs(inicio.sale.x) + Math.abs(inicio.sale.grados)).toBe(0);
    expect(inicio.entra.opacidad).toBe(0);
    const fin = vistaIntermedia(1);
    expect(Math.abs(fin.entra.x) + Math.abs(fin.entra.grados)).toBe(0);
    expect(fin.entra.opacidad).toBe(1);
  });

  it("la que sale se corre hacia el lado del giro y la que entra llega del otro lado", () => {
    const v = vistaIntermedia(0.5);
    expect(Math.sign(v.sale.x)).toBe(VISTAS.sentido);
    expect(Math.sign(v.entra.x)).toBe(-VISTAS.sentido);
    expect(Math.abs(v.sale.x)).toBeLessThanOrEqual(VISTAS.desplazamiento);
    expect(Math.abs(v.sale.grados)).toBeLessThanOrEqual(VISTAS.grados);
  });

  it("el fundido es corto y en el medio: sin imagen doble al principio ni al final del paso", () => {
    const desde = 0.5 - VISTAS.fundido / 2;
    expect(vistaIntermedia(desde - 0.01).entra.opacidad).toBe(0);
    expect(vistaIntermedia(1 - desde + 0.01).entra.opacidad).toBe(1);
    expect(vistaIntermedia(0.5).entra.opacidad).toBeCloseTo(0.5);
  });
});

describe("una sola obra gira por vez", () => {
  afterEach(() => {
    const activo = giroActivo();
    if (activo) soltarGiro(activo);
  });

  it("al girar otra obra, la anterior se detiene", () => {
    const a = vi.fn(() => soltarGiro(a));
    const b = vi.fn(() => soltarGiro(b));
    tomarGiro(a);
    tomarGiro(b);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(giroActivo()).toBe(b);
  });

  it("volver a activar la misma obra no la detiene ni duplica el giro", () => {
    const a = vi.fn(() => soltarGiro(a));
    tomarGiro(a);
    tomarGiro(a);
    expect(a).not.toHaveBeenCalled();
    expect(giroActivo()).toBe(a);
  });

  it("una obra que ya no es la activa no libera el turno de otra", () => {
    const a = vi.fn();
    const b = vi.fn();
    tomarGiro(a);
    tomarGiro(b);
    soltarGiro(a);
    expect(giroActivo()).toBe(b);
    soltarGiro(b);
    expect(giroActivo()).toBeNull();
  });
});
