/**
 * Giro 360° de las obras del catálogo: parámetros, cálculo de la posición y control que asegura
 * que gire una sola obra por vez. No depende de React ni del navegador, así se puede probar.
 */

/** Vueltas completas como máximo por cada activación (pulsación o botón). */
export const MAX_ROTATIONS = 3;
/** Duración de una vuelta completa, sin importar cuántas fotos tenga la secuencia. */
export const MS_POR_VUELTA = 4000;
/** Tiempo que hay que mantener presionada la foto para que empiece a girar. */
export const MS_PULSACION = 300;
/** Si el dedo o el mouse se mueve más que esto antes de activarse, es scroll o arrastre: se cancela. */
export const UMBRAL_MOVIMIENTO_PX = 10;
/**
 * Fundido corto entre una foto y la siguiente: solo tapa el cambio, sin que se vean dos obras
 * superpuestas. Nunca dura más de un tercio del tiempo de cada foto.
 */
export const MS_FUNDIDO = 90;

export type OpcionesGiro = { msPorVuelta?: number; maxVueltas?: number };

/** Tiempo que se ve cada foto: con más fotos, cada una dura menos y la vuelta tarda lo mismo. */
export function msPorCuadro(total: number, msPorVuelta = MS_POR_VUELTA) {
  return msPorVuelta / Math.max(total, 1);
}

/** Duración del fundido para una secuencia de `total` fotos. */
export function msFundido(total: number, msPorVuelta = MS_POR_VUELTA) {
  return Math.round(Math.min(MS_FUNDIDO, msPorCuadro(total, msPorVuelta) / 3));
}

/**
 * Posición del giro `ms` milisegundos después de activarlo, empezando en la foto `inicio` de una
 * secuencia de `total` fotos. Avanza una foto apenas se activa, para que se note que empezó.
 * Al completar las vueltas queda en la foto de inicio y `terminado` pasa a true.
 */
export function posicionDelGiro(
  ms: number,
  inicio: number,
  total: number,
  { msPorVuelta = MS_POR_VUELTA, maxVueltas = MAX_ROTATIONS }: OpcionesGiro = {},
) {
  if (total < 2) return { cuadro: 0, pasos: 0, progreso: 1, terminado: true };
  const pasosTotales = total * maxVueltas;
  const pasos = Math.min(Math.floor(Math.max(ms, 0) / msPorCuadro(total, msPorVuelta)) + 1, pasosTotales);
  return {
    cuadro: (((inicio + pasos) % total) + total) % total,
    pasos,
    progreso: pasos / pasosTotales,
    terminado: pasos >= pasosTotales,
  };
}

type Detener = () => void;
let activo: Detener | null = null;

/**
 * Registra la obra que empieza a girar y detiene la que estuviera girando antes: nunca giran dos
 * a la vez. Cada obra pasa siempre la misma función para detenerse.
 */
export function tomarGiro(detener: Detener) {
  const anterior = activo;
  activo = detener;
  if (anterior && anterior !== detener) anterior();
}

/** La obra dejó de girar: libera el turno (si todavía era suyo). */
export function soltarGiro(detener: Detener) {
  if (activo === detener) activo = null;
}

/** Para pruebas: la función de la obra que gira ahora, si hay una. */
export function giroActivo() {
  return activo;
}
