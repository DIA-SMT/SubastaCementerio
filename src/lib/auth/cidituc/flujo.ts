import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, crearSesion, VIDA_SESION_S } from "@/lib/auth/ciudadano";
import { CIDITUC_CLAVE, CIDITUC_CONFIGURADO, CIDITUC_LOGIN } from "@/lib/auth/cidituc/config";
import type { ErrorIngreso } from "@/lib/auth/cidituc/errores";
import { urlDelLogin } from "@/lib/auth/cidituc/login";
import { nombreDePersona } from "@/lib/auth/cidituc/nombre";
import { validarToken } from "@/lib/auth/cidituc/persona";
import { esOferente, registrarIngresoCidituc } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";

/**
 * El ingreso de oferentes con Cidituc, de punta a punta. Armado sobre el de El Sanmiguelino (repo
 * DiarioDigital, src/lib/auth/cidituc/flujo.ts), pero contra el login de Ciudad Digital y no
 * contra el derivador, que el equipo de Cidituc da de baja:
 *
 *   /auth/cidituc/inicio  →  ciudaddigital.smt.gob.ar/#/login  →  /auth/cidituc/callback?auth=…
 *
 * El token de Cidituc no se guarda en ningún lado y no sobrevive al callback: lo único que
 * queda es la sesión de la subasta, firmada con nuestro secreto. Cidituc dice quién es la
 * persona; qué puede hacer (registrarse, ofertar) lo deciden las reglas de la base.
 */

/**
 * Cookie del flujo: `<nonce>|<a dónde volver>`, diez minutos de vida. Es protección CSRF —que
 * alguien nos empuje un token ajeno al callback con un enlace— y el destino viaja acá porque el
 * login no devuelve parámetros propios: sólo `auth`.
 *
 * El login de Ciudad Digital tampoco devuelve el `state`, así que la cookie no se puede comparar
 * con nada: lo que prueba es que el ingreso empezó acá, en este navegador, hace menos de diez
 * minutos. Un enlace armado por otro llega sin cookie y se rechaza. Si algún día el login devuelve
 * el `state`, el callback lo compara.
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

/**
 * Arranca el ingreso: guarda el nonce y manda al login de Ciudad Digital.
 *
 * Con `?limpiar=1` (el reintento después de un token inválido) el login borra antes el token que
 * tenía guardado. Sin eso, un token vencido vuelve una y otra vez: el login redirige apenas ve un
 * token, sin esperar a confirmar que siga siendo válido.
 */
export function inicioCidituc(request: NextRequest): NextResponse {
  if (!CIDITUC_CONFIGURADO) return conError(request, "sin-configurar");

  const parametros = request.nextUrl.searchParams;
  const destino = destinoSeguro(parametros.get("volver"));
  const nonce = crypto.randomUUID();

  let destinoCidituc: string;
  try {
    destinoCidituc = urlDelLogin(CIDITUC_LOGIN, CIDITUC_CLAVE, nonce, parametros.get("limpiar") === "1");
  } catch {
    console.error(
      `CIDITUC_LOGIN_URL no es una URL válida: ${JSON.stringify(CIDITUC_LOGIN)}. ` +
        "Va el origen solo (https://ciudaddigital.smt.gob.ar); el #/login lo agrega urlDelLogin().",
    );
    return conError(request, "sin-configurar");
  }

  const res = NextResponse.redirect(destinoCidituc, 303);
  res.cookies.set(COOKIE_FLUJO, `${nonce}|${destino}`, { ...OPCIONES_COOKIE, maxAge: VIDA_FLUJO_S });
  return res;
}

/**
 * Descarta una sesión que ya no corresponde a nadie (la persona no está en la base: se reinició
 * o se borró) y vuelve al ingreso. Sin esto, /ingresar ve una sesión y manda a /registro, y
 * /registro no encuentra a la persona y manda a /ingresar, sin fin. Los Server Components no
 * pueden borrar cookies: por eso es una ruta.
 */
export function descartarSesion(request: NextRequest): NextResponse {
  const destino = destinoSeguro(request.nextUrl.searchParams.get("volver"));
  const parametros = destino === "/obras" ? "" : `?${new URLSearchParams({ volver: destino })}`;
  const res = NextResponse.redirect(interna(request, `/ingresar${parametros}`), 303);
  res.cookies.set(COOKIE_SESION, "", { ...OPCIONES_COOKIE, maxAge: 0 });
  return res;
}

/** Vuelta desde Cidituc: valida el token, guarda a la persona y abre la sesión de la subasta. */
export async function callbackCidituc(request: NextRequest): Promise<NextResponse> {
  const parametros = request.nextUrl.searchParams;
  const token = parametros.get("auth") ?? "";
  const estadoDevuelto = parametros.get("state") ?? "";
  const { nonce, destino } = leerFlujo(request);

  if (!nonce || (estadoDevuelto && nonce !== estadoDevuelto)) {
    // Las dos formas de fallar se arreglan distinto: sin cookie (venció, el navegador no la
    // mandó o el ingreso no empezó acá) y un state distinto (dos pestañas pisándose).
    const causa: ErrorIngreso = !nonce ? "state-vencido" : "state-distinto";
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
