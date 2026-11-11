import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ROTATIONS,
  MS_POR_VUELTA,
  giroActivo,
  msFundido,
  msPorCuadro,
  posicionDelGiro,
  soltarGiro,
  tomarGiro,
} from "@/lib/giro";

describe("posición del giro 360°", () => {
  it("avanza una foto apenas se activa y después a ritmo constante", () => {
    expect(posicionDelGiro(0, 0, 8).cuadro).toBe(1);
    expect(posicionDelGiro(499, 0, 8).cuadro).toBe(1);
    expect(posicionDelGiro(500, 0, 8).cuadro).toBe(2);
    expect(posicionDelGiro(1000, 3, 8).cuadro).toBe(6);
  });

  it.each([8, 16, 24, 36, 11])("con %i fotos la vuelta dura lo mismo", (total) => {
    expect(msPorCuadro(total) * total).toBe(MS_POR_VUELTA);
    // Justo al completar una vuelta vuelve a la foto de inicio (más el paso inicial).
    expect(posicionDelGiro(MS_POR_VUELTA, 2, total).cuadro).toBe(3 % total);
  });

  it(`se detiene sola a las ${MAX_ROTATIONS} vueltas, en la foto de inicio`, () => {
    for (const total of [8, 16, 24, 36]) {
      const tope = MS_POR_VUELTA * MAX_ROTATIONS;
      const antes = posicionDelGiro(tope - msPorCuadro(total) - 1, 5, total);
      expect(antes.terminado).toBe(false);
      const fin = posicionDelGiro(tope, 5, total);
      expect(fin).toMatchObject({ cuadro: 5 % total, terminado: true, progreso: 1 });
      // Seguir presionando no la reinicia.
      expect(posicionDelGiro(tope * 10, 5, total)).toEqual(fin);
    }
  });

  it("el máximo de vueltas y la duración se pueden cambiar", () => {
    const una = posicionDelGiro(1000, 0, 4, { msPorVuelta: 1000, maxVueltas: 1 });
    expect(una).toMatchObject({ cuadro: 0, terminado: true });
    expect(posicionDelGiro(0, 0, 4, { maxVueltas: 2 }).progreso).toBe(1 / 8);
  });

  it("sin secuencia no gira", () => {
    expect(posicionDelGiro(1000, 0, 1).terminado).toBe(true);
    expect(posicionDelGiro(1000, 0, 0).terminado).toBe(true);
  });

  it("el fundido es corto y nunca ocupa más de un tercio de cada foto", () => {
    expect(msFundido(8)).toBe(90);
    expect(msFundido(36)).toBeLessThanOrEqual(msPorCuadro(36) / 3);
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
