/**
 * Las direcciones del login de Ciudad Digital (repo `cidituc`, ciudaddigital.smt.gob.ar).
 *
 * Ese login guarda el token en el navegador y no lo borra al devolver a la persona: quien ya
 * entró una vez vuelve sin poner la contraseña. Por eso, además del ingreso, hay dos
 * direcciones que lo cierran con `?logout=1` —el sitio lo lee antes del `#` y borra el token—:
 * una para reintentar cuando quedó guardado un token vencido, y otra para el cierre de sesión.
 *
 * El `#` no es decorativo: el sitio usa HashRouter. Por eso `CIDITUC_LOGIN_URL` lleva el
 * **origen solo** y el `#/login` lo pone acá: una variable de entorno con un `#` adentro es un
 * accidente esperando —en un `.env` sin comillas, el `#` abre comentario y se come el resto de
 * la línea, así que se pierde `/login` y queda una URL que parece bien hasta que alguien la usa—.
 */

/**
 * El ingreso. El `state` viaja aunque hoy el login no lo devuelve (`PrivateRoute.jsx` arma la
 * vuelta solo con `auth`): si algún día lo devuelve, el callback lo compara.
 */
export function urlDelLogin(origen: string, clave: string, nonce: string, limpiar = false): string {
  const url = new URL(origen);
  if (limpiar) url.searchParams.set("logout", "1");
  url.hash = `/login?${new URLSearchParams({ next: clave, state: nonce })}`;
  return url.toString();
}

/** El cierre de la sesión de Ciudad Digital en este navegador. Termina en su portada. */
export function urlDeSalida(origen: string): string {
  const url = new URL(origen);
  url.searchParams.set("logout", "1");
  return url.toString();
}
