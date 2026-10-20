import "server-only";
import { esDireccionLocal } from "@/lib/exportacion/comun";

/**
 * Sin DATABASE_URL la app corre en modo local: base PGlite en .local/, códigos de ingreso
 * en pantalla y correos en la consola. Con DATABASE_URL usa Supabase.
 */
export const modoLocal = !process.env.DATABASE_URL;

export const supabase = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  claveAnonima: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** URL pública del sitio, para correos y códigos QR. */
export const urlSitio = (process.env.NEXT_PUBLIC_URL_SITIO ?? "http://localhost:3000").replace(/\/$/, "");

if (!modoLocal && (!supabase.url || !supabase.claveAnonima)) {
  throw new Error(
    "Con DATABASE_URL también hay que definir NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

/** Datos del proveedor de correo (Resend), o null si falta RESEND_API_KEY o CORREO_REMITENTE. */
export function proveedorDeCorreo() {
  const clave = process.env.RESEND_API_KEY?.trim();
  const remitente = process.env.CORREO_REMITENTE?.trim();
  return clave && remitente ? { clave, remitente } : null;
}

export type FaltaDeConfiguracion = "correo" | "url_sitio" | "cron";

/**
 * Lo que falta configurar fuera del modo local para que los avisos por correo funcionen:
 *  - correo: RESEND_API_KEY o CORREO_REMITENTE. Los avisos quedan pendientes, sin salir.
 *  - url_sitio: NEXT_PUBLIC_URL_SITIO falta o apunta a una dirección local. Los avisos quedan
 *    pendientes (los enlaces no abrirían la obra) y los QR no sirven.
 *  - cron: CRON_SECRET. /api/avisos responde 401 y los avisos que fallan no se reintentan.
 * En modo local no falta nada: los correos se escriben en la consola.
 */
export function faltasDeConfiguracion(): FaltaDeConfiguracion[] {
  if (modoLocal) return [];
  const faltas: FaltaDeConfiguracion[] = [];
  if (!proveedorDeCorreo()) faltas.push("correo");
  if (esDireccionLocal(urlSitio)) faltas.push("url_sitio");
  if (!process.env.CRON_SECRET?.trim()) faltas.push("cron");
  return faltas;
}

const ADVERTENCIAS: Record<FaltaDeConfiguracion, string> = {
  correo:
    "Falta RESEND_API_KEY o CORREO_REMITENTE: los avisos por correo quedan pendientes y no se envían hasta configurarlas.",
  url_sitio:
    "NEXT_PUBLIC_URL_SITIO falta o apunta a una dirección local: los avisos por correo quedan pendientes y los QR no abren la obra.",
  cron: "Falta CRON_SECRET: /api/avisos responde 401 y los avisos que fallan no se reintentan.",
};

// Advertencias al arrancar (una vez por proceso). No cortan el arranque: el sitio y el
// ingreso tienen que seguir funcionando aunque el correo esté pendiente.
const global = globalThis as typeof globalThis & { __subastaEntornoRevisado?: boolean };
if (!global.__subastaEntornoRevisado) {
  global.__subastaEntornoRevisado = true;
  for (const falta of faltasDeConfiguracion()) console.warn(`Configuración: ${ADVERTENCIAS[falta]}`);
}
