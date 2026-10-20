import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr";

// Cookies de sesión de Supabase. Las usan src/lib/auth/supabase.ts y src/proxy.ts.
// La app no usa Supabase en el navegador: los tokens no tienen por qué quedar al alcance de
// los scripts de la página.

export const opcionesCookie: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

/** Una sesión sin uso durante 7 días se cierra sola en ese navegador. */
const VIDA_MAXIMA_S = 60 * 60 * 24 * 7;

/**
 * @supabase/ssr fija siempre 400 días (pisa el maxAge de cookieOptions), así que se acota al
 * escribir cada cookie. maxAge 0 es el que borra la cookie al cerrar la sesión: se respeta.
 */
export function vidaAcotada(opciones: CookieOptions): CookieOptions {
  return opciones.maxAge && opciones.maxAge > 0
    ? { ...opciones, maxAge: Math.min(opciones.maxAge, VIDA_MAXIMA_S) }
    : opciones;
}
