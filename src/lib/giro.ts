/**
 * Giro 360° de las obras del catálogo: parámetros, cálculo de la posición y control que asegura
 * que gire una sola obra por vez. No depende de React ni del navegador, así se puede probar.
 */

/** Vueltas completas como máximo por cada activación (mouse, pulsación o botón). */
export const MAX_ROTATIONS = 3;
/** Duración de una vuelta completa, sin importar cuántas fotos tenga la secuencia. */
export const MS_POR_VUELTA = 4000;
/** Con el dedo: tiempo que hay que mantener presionada la foto para que empiece a girar. */
export const MS_PULSACION = 300;
/** Si el dedo se mueve más que esto antes de activarse, es scroll: se cancela. */
export const UMBRAL_MOVIMIENTO_PX = 10;
/** Al detenerse: la foto que quedó a medio aparecer termina de mostrarse con este fundido. */
export const MS_FUNDIDO = 90;
/** Con mouse: al salir de la tarjeta, la obra vuelve al frente con este fundido. */
export const MS_VUELTA_AL_FRENTE = 400;

export type OpcionesGiro = { msPorVuelta?: number; maxVueltas?: number };

/** Tiempo entre una foto y la siguiente: con más fotos, cada paso dura menos y la vuelta lo mismo. */
export function msPorCuadro(total: number, msPorVuelta = MS_POR_VUELTA) {
  return msPorVuelta / Math.max(total, 1);
}

/**
 * Posición continua del giro `ms` milisegundos después de activarlo, empezando en la foto
 * `inicio` de una secuencia de `total` fotos: va de la foto `desde` a la foto `hacia`, y `t`
 * (de 0 a 1) dice cuánto avanzó entre las dos. Al completar las vueltas queda quieta en la foto
 * de inicio y `terminado` pasa a true. La foto `hacia` aparece sobre `desde` con opacidad `t`:
 * un fundido parejo que ocupa todo el paso, sin pausas entre foto y foto.
 */
export function posicionDelGiro(
  ms: number,
  inicio: number,
  total: number,
  { msPorVuelta = MS_POR_VUELTA, maxVueltas = MAX_ROTATIONS }: OpcionesGiro = {},
) {
  if (total < 2) return { desde: 0, hacia: 0, t: 0, progreso: 1, terminado: true };
  const pasosTotales = total * maxVueltas;
  const avance = Math.min(Math.max(ms, 0) / msPorCuadro(total, msPorVuelta), pasosTotales);
  const pasos = Math.floor(avance);
  const desde = (((inicio + pasos) % total) + total) % total;
  return {
    desde,
    hacia: (desde + 1) % total,
    t: avance - pasos,
    progreso: avance / pasosTotales,
    terminado: avance >= pasosTotales,
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
