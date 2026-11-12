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
/** Fundido al detenerse: la foto que quedó a medio aparecer termina de mostrarse. */
export const MS_FUNDIDO = 90;
/** Con mouse: al salir de la tarjeta, la obra vuelve al frente con este fundido. */
export const MS_VUELTA_AL_FRENTE = 400;

/**
 * Vistas intermedias: entre una foto y la siguiente, la que sale se corre y gira un poco en
 * perspectiva hacia el lado del giro, y la que entra llega desde el otro lado. Así el movimiento
 * es continuo en lugar de saltar de foto en foto.
 */
export const VISTAS = {
  /** Corrimiento horizontal máximo, en % del ancho de la foto. */
  desplazamiento: 4,
  /** Giro en perspectiva máximo, en grados. */
  grados: 9,
  /** Parte del paso entre dos fotos que dura el fundido (en el medio): corto, sin imagen doble. */
  fundido: 0.45,
  /** Hacia dónde gira la secuencia: -1 = la cara se va hacia la izquierda (como en las fotos). */
  sentido: -1,
} as const;

export type OpcionesGiro = { msPorVuelta?: number; maxVueltas?: number };

/** Tiempo entre una foto y la siguiente: con más fotos, cada paso dura menos y la vuelta lo mismo. */
export function msPorCuadro(total: number, msPorVuelta = MS_POR_VUELTA) {
  return msPorVuelta / Math.max(total, 1);
}

/**
 * Posición continua del giro `ms` milisegundos después de activarlo, empezando en la foto
 * `inicio` de una secuencia de `total` fotos: va de la foto `desde` a la foto `hacia`, y `t`
 * (de 0 a 1) dice cuánto avanzó entre las dos. Al completar las vueltas queda quieta en la foto
 * de inicio y `terminado` pasa a true.
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

const suave = (x: number) => {
  const c = Math.min(Math.max(x, 0), 1);
  return c * c * (3 - 2 * c);
};

/**
 * Cómo se ven las dos fotos en el punto `t` del paso entre una y otra (la vista intermedia):
 * corrimiento (% del ancho), giro (grados) y opacidad de la que entra, que va encima.
 */
export function vistaIntermedia(t: number, v: { desplazamiento: number; grados: number; fundido: number; sentido: number } = VISTAS) {
  const desde = 0.5 - v.fundido / 2;
  return {
    sale: { x: v.sentido * v.desplazamiento * t, grados: v.sentido * v.grados * t },
    entra: {
      x: -v.sentido * v.desplazamiento * (1 - t),
      grados: -v.sentido * v.grados * (1 - t),
      opacidad: suave((t - desde) / v.fundido),
    },
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
