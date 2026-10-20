/** Número de obra desde la URL ("7"), o null si no es válido. */
export function numeroDeObra(texto: string) {
  return /^\d{1,3}$/.test(texto) ? Number(texto) : null;
}

/**
 * Solo rutas internas, para no redirigir a sitios externos. Devuelve la ruta ya resuelta:
 * "/.//sitio" o "/obras/..//sitio" se resolverían a "//sitio", que el navegador toma como
 * otra dirección, así que se rechazan.
 */
export function rutaSegura(ruta: unknown, porDefecto = "/obras") {
  if (typeof ruta !== "string" || ruta.length > 300 || !/^\/(?!\/)[\w\-/?=&.%]*$/.test(ruta)) {
    return porDefecto;
  }
  const BASE = "http://sitio.invalid";
  let url: URL;
  try {
    url = new URL(ruta, BASE);
  } catch {
    return porDefecto;
  }
  // Ninguna ruta del sitio lleva "//" ni barras codificadas (%2F, %5C): se rechazan en
  // cualquier posición, no solo al principio, por si algún paso posterior las decodifica.
  if (url.origin !== BASE || url.pathname.includes("//") || /%2f|%5c/i.test(url.pathname)) {
    return porDefecto;
  }
  return url.pathname + url.search;
}

export function normalizarCorreo(texto: unknown) {
  const correo = String(texto ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && correo.length <= 254 ? correo : null;
}

/** Tope de una oferta, el mismo que controla public.ofertar en la base. */
export const MONTO_MAXIMO = 1_000_000_000;

/**
 * "55.000", "$ 55000", "55 000" → 55000. Acepta hasta 10 cifras para que el campo deje
 * escribir un monto de más y se pueda avisar; el tope se controla con MONTO_MAXIMO.
 */
export function montoDesdeTexto(texto: unknown) {
  const digitos = String(texto ?? "").replace(/\D/g, "");
  return digitos && digitos.length <= 10 ? Number(digitos) : null;
}
