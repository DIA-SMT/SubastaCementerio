// Configuración del ingreso de oferentes con Cidituc (Ciudadano Digital). Tomado de El
// Sanmiguelino (repo DiarioDigital, src/lib/auth/config.ts). Lo lee solo el servidor.

function limpio(valor: string | undefined): string {
  return valor?.trim() ?? "";
}

/**
 * La pantalla de ingreso del municipio. Va el **origen solo**, sin `#`: el `#/login` lo agrega
 * `urlDelDerivador()`. La URL completa lleva un `#`, que en un `.env` sin comillas abre
 * comentario y se come `/login`; con el fragmento en el código esa trampa no existe.
 */
export const CIDITUC_DERIVADOR = limpio(process.env.CIDITUC_DERIVADOR_URL);

/** El backend contra el que se valida el token. Sin barra final. */
export const CIDITUC_API = limpio(process.env.CIDITUC_API_URL).replace(/\/+$/, "");

/** La URL de retorno. Tiene que ser **la misma** registrada en el derivador. */
export const CIDITUC_CALLBACK = limpio(process.env.CIDITUC_CALLBACK_URL);

/** La clave con la que el derivador identifica a la subasta: `?next=<clave>`. */
export const CIDITUC_CLAVE = limpio(process.env.CIDITUC_CLAVE_APP) || "subasta-cementerio";

/**
 * ¿Está la integración completa como para mandar a alguien a Cidituc? Es una comprobación de
 * configuración, no un control de seguridad: el único emisor de sesiones de oferentes es el
 * callback, y el callback exige un token que valida el backend municipal.
 */
export const CIDITUC_CONFIGURADO =
  process.env.CIDITUC_HABILITADO === "1" && Boolean(CIDITUC_DERIVADOR && CIDITUC_API && CIDITUC_CALLBACK);
