import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, crearSesion, VIDA_SESION_S } from "@/lib/auth/ciudadano";
import { CIDITUC_CLAVE, CIDITUC_CONFIGURADO, CIDITUC_DERIVADOR } from "@/lib/auth/cidituc/config";
import { urlDelDerivador } from "@/lib/auth/cidituc/derivador";
import type { ErrorIngreso } from "@/lib/auth/cidituc/errores";
import { nombreDePersona } from "@/lib/auth/cidituc/nombre";
import { validarToken } from "@/lib/auth/cidituc/persona";
import { esOferente, registrarIngresoCidituc } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";

/**
 * El ingreso de oferentes con Cidituc, de punta a punta. Igual que en El Sanmiguelino (repo
 * DiarioDigital, src/lib/auth/cidituc/flujo.ts):
 *
 *   /auth/cidituc/inicio  →  derivador  →  /auth/cidituc/callback?auth=…&state=…
 *
 * El token de Cidituc no se guarda en ningún lado y no sobrevive al callback: lo único que
 * queda es la sesión de la subasta, firmada con nuestro secreto. Cidituc dice quién es la
 * persona; qué puede hacer (registrarse, ofertar) lo deciden las reglas de la base.
 */

/**
 * Cookie del flujo: `<nonce>|<a dónde volver>`, diez minutos de vida. El nonce es protección
 * CSRF —que alguien nos empuje un token ajeno al callback— y el destino viaja acá porque el
 * derivador no devuelve parámetros propios: sólo `auth` y lo que pusimos en `state`.
 */
const COOKIE_FLUJO = "subasta_cidituc";
const VIDA_FLUJO_S = 10 * 60;

const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** A dónde volver: una ruta de este sitio, nunca el ingreso mismo (lo relanzaría). */
function destinoSeguro(valor: unknown) {
  const ruta = rutaSegura(valor);
  return /^\/(?:auth|ingresar)(?:[/?]|$)/.test(ruta) ? "/obras" : ruta;
}

/** Una dirección de este sitio: la ruta ya viene saneada, y se le pone NUESTRO origen. */
function interna(request: NextRequest, ruta: string) {
  const url = request.nextUrl.clone();
  const destino = new URL(ruta, url.origin);
  url.pathname = destino.pathname;
  url.search = destino.search;
  url.hash = "";
  return url;
}

function leerFlujo(request: NextRequest): { nonce: string; destino: string } {
  const guardado = request.cookies.get(COOKIE_FLUJO)?.value ?? "";
  const corte = guardado.indexOf("|");
  return {
    nonce: corte === -1 ? guardado : guardado.slice(0, corte),
    destino: destinoSeguro(corte === -1 ? null : guardado.slice(corte + 1)),
  };
}

function conError(request: NextRequest, error: ErrorIngreso) {
  // El destino se rescata de la cookie antes de borrarla: quien llegó desde el QR de una obra
  // reintenta y vuelve a esa obra, no al catálogo.
  const { destino } = leerFlujo(request);
  const parametros = new URLSearchParams({ error });
  if (destino !== "/obras") parametros.set("volver", destino);
  const res = NextResponse.redirect(interna(request, `/ingresar?${parametros}`), 303);
  res.cookies.set(COOKIE_FLUJO, "", { ...OPCIONES_COOKIE, maxAge: 0 });
  return res;
}

/** Arranca el ingreso: guarda el nonce y manda al derivador. */
export function inicioCidituc(request: NextRequest): NextResponse {
  if (!CIDITUC_CONFIGURADO) return conError(request, "sin-configurar");

  const destino = destinoSeguro(request.nextUrl.searchParams.get("volver"));
  const nonce = crypto.randomUUID();

  let destinoCidituc: string;
  try {
    destinoCidituc = urlDelDerivador(CIDITUC_DERIVADOR, CIDITUC_CLAVE, nonce);
  } catch {
    console.error(
      `CIDITUC_DERIVADOR_URL no es una URL válida: ${JSON.stringify(CIDITUC_DERIVADOR)}. ` +
        "Va el origen solo (https://cidituc.smt.gob.ar); el #/login lo agrega urlDelDerivador().",
    );
    return conError(request, "sin-configurar");
  }

  const res = NextResponse.redirect(destinoCidituc, 303);
  res.cookies.set(COOKIE_FLUJO, `${nonce}|${destino}`, { ...OPCIONES_COOKIE, maxAge: VIDA_FLUJO_S });
  return res;
}

/** Vuelta desde Cidituc: valida el token, guarda a la persona y abre la sesión de la subasta. */
export async function callbackCidituc(request: NextRequest): Promise<NextResponse> {
  const parametros = request.nextUrl.searchParams;
  const token = parametros.get("auth") ?? "";
  const estadoDevuelto = parametros.get("state") ?? "";
  const { nonce, destino } = leerFlujo(request);

  if (!nonce || !estadoDevuelto || nonce !== estadoDevuelto) {
    // Las tres formas de fallar el state se arreglan distinto: sin cookie (venció o el
    // navegador no la mandó), sin state en la URL (el derivador no lo devolvió) y distintos
    // (dos pestañas pisándose).
    const causa: ErrorIngreso = !estadoDevuelto ? "state-ausente" : !nonce ? "state-vencido" : "state-distinto";
    // Sólo si estaban, nunca el valor.
    console.error("Ingreso por Cidituc rechazado al comparar el state.", {
      causa,
      cookiePresente: Boolean(nonce),
      statePresente: Boolean(estadoDevuelto),
      tokenPresente: Boolean(token),
    });
    return conError(request, causa);
  }

  if (!token) return conError(request, "sin-token");

  const validacion = await validarToken(token);
  if (!validacion.ok) return conError(request, validacion.motivo);
  const { persona } = validacion;

  let personaId: string;
  let sesion: string;
  try {
    personaId = await registrarIngresoCidituc({
      ciditucId: persona.id,
      cuil: persona.cuil,
      dni: persona.dni,
      // Cidituc los manda en mayúsculas: se normaliza cada campo por separado (ver nombre.ts).
      nombre: nombreDePersona(persona.nombre).slice(0, 80),
      apellido: nombreDePersona(persona.apellido).slice(0, 80),
      email: persona.email,
    });
    sesion = crearSesion(personaId);
  } catch (error) {
    // La base no respondió, o falta SESSION_SECRET. Sin este catch sale un 500 en blanco con
    // la persona ya autenticada en Cidituc.
    console.error(
      "Cidituc validó la identidad pero no se pudo abrir la sesión:",
      error instanceof Error ? error.message : error,
    );
    return conError(request, "sesion-fallida");
  }

  // La primera vez se completan teléfono y correo y se aceptan las bases.
  let registrado = true;
  try {
    registrado = await esOferente(personaId);
  } catch (error) {
    // /registro vuelve a revisarlo y, si ya está registrado, sigue de largo.
    console.error("No se pudo revisar el registro del oferente:", error instanceof Error ? error.message : error);
  }
  const siguiente = registrado ? destino : `/registro?volver=${encodeURIComponent(destino)}`;

  // A una URL limpia: el token no queda en la barra de direcciones, el historial ni el Referer.
  const res = NextResponse.redirect(interna(request, siguiente), 303);
  res.cookies.set(COOKIE_SESION, sesion, { ...OPCIONES_COOKIE, maxAge: VIDA_SESION_S });
  res.cookies.set(COOKIE_FLUJO, "", { ...OPCIONES_COOKIE, maxAge: 0 });
  return res;
}
