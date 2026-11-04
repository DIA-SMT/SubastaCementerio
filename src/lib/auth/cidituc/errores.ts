/**
 * Por qué alguien puede no haber entrado, y qué se le dice. Tomado de El Sanmiguelino (repo
 * DiarioDigital, src/lib/auth/cidituc/errores.ts).
 *
 * Se distinguen a propósito: cada uno se arregla en un lugar distinto —el entorno, el login de
 * Ciudad Digital, el backend municipal o el navegador de la persona—. Este módulo no importa nada: lo lee la
 * pantalla de ingreso y no tiene por qué arrastrar el transporte HTTPS ni la configuración.
 */

/** Lo que puede decir la validación del token contra el backend. */
export type MotivoRechazo =
  /** Faltan variables: el sitio no está en condiciones de mandar a nadie. */
  | "sin-configurar"
  /** El backend contestó 401/403, o el token no tiene forma de token. */
  | "token-invalido"
  /** La persona existe pero figura dada de baja en Cidituc. */
  | "cuenta-inactiva"
  /** No hubo respuesta del backend, o vino una que no se entiende. */
  | "no-disponible";

export type ErrorIngreso =
  | MotivoRechazo
  /** El callback llegó sin `?auth=`. */
  | "sin-token"
  /**
   * No teníamos cookie: pasaron los diez minutos, el navegador no la mandó o el ingreso no
   * empezó en este sitio (un enlace al callback armado por otro).
   */
  | "state-vencido"
  /** El login devolvió un `state` que no es el nuestro: dos pedidos pisándose (dos pestañas). */
  | "state-distinto"
  /**
   * Cidituc dijo que sí y nosotros no pudimos abrir la sesión: falta `SESSION_SECRET` (o es más
   * corto que 32 caracteres) o la base no respondió al guardar a la persona.
   */
  | "sesion-fallida";

/** Qué ve la persona. El detalle técnico va al log del servidor, no a la pantalla. */
export const TEXTO_ERROR: Record<ErrorIngreso, string> = {
  "sin-configurar": "El ingreso con Ciudadano Digital todavía no está habilitado en este sitio.",
  "token-invalido": "Ciudadano Digital no reconoció la credencial. Probá ingresar de nuevo.",
  "cuenta-inactiva": "Tu cuenta de Ciudadano Digital figura como dada de baja. Consultá en Ciudadano Digital.",
  "no-disponible": "No pudimos comunicarnos con Ciudadano Digital. Volvé a intentar en unos minutos.",
  "sin-token": "El ingreso volvió sin credencial. Probá de nuevo.",
  "state-vencido": "La solicitud de ingreso venció. Volvé a empezar desde el botón.",
  "state-distinto": "Había otro ingreso en curso. Cerrá las demás pestañas y probá de nuevo.",
  "sesion-fallida":
    "Ciudadano Digital te reconoció, pero no pudimos abrir tu sesión. Probá de nuevo en unos minutos; si sigue igual, comunicate con la Dirección de Cementerios.",
};

/**
 * El mensaje para lo que venga en `?error=`, o `null`. Sólo se muestran códigos conocidos: el
 * valor sale de la barra de direcciones y un enlace preparado no puede poner su propio texto.
 */
export function textoDeError(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  return Object.hasOwn(TEXTO_ERROR, valor) ? TEXTO_ERROR[valor as ErrorIngreso] : null;
}

/**
 * Si el reintento tiene que cerrar antes la sesión de Ciudad Digital. Con un token inválido, el
 * login lo tiene guardado y lo volvería a mandar sin pedir la contraseña.
 */
export function reintentoLimpia(valor: unknown): boolean {
  return valor === "token-invalido";
}
