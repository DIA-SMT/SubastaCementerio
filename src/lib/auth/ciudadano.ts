import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

// Sesión de los oferentes, que ingresan con Cidituc. Es propia de la subasta: el token de
// Cidituc no se guarda, y lo que queda es esta cookie firmada con nuestro secreto. Igual que
// en El Sanmiguelino (repo DiarioDigital, src/lib/auth/session.ts). El panel sigue con su
// propia sesión (Supabase Auth, o la del modo local): son cookies distintas.

export const COOKIE_SESION = "subasta_oferente";

/** Una sesión sin renovar dura 7 días, como la que tenía el ingreso por correo (decisión 16). */
export const VIDA_SESION_S = 60 * 60 * 24 * 7;

/** Subirla invalida todas las sesiones vivas: se hace al cambiar el contenido del token. */
const VERSION = 1;
const LARGO_MINIMO = 32;

/**
 * El secreto de firma. En producción tiene que venir de SESSION_SECRET y no hay respaldo: un
 * valor por defecto escrito en el repositorio sería una llave publicada. Fuera de producción,
 * sin la variable, se usa uno aleatorio guardado en .local/ (como el modo local del panel).
 * Se resuelve en cada uso y no al importar, para no romper el build.
 */
function secreto(): string {
  const valor = process.env.SESSION_SECRET;
  if (valor && valor.length >= LARGO_MINIMO) return valor;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `SESSION_SECRET falta o es más corto que ${LARGO_MINIMO} caracteres. Sin un secreto propio no se pueden abrir sesiones de oferentes.`,
    );
  }
  const archivo = path.join(process.cwd(), ".local", "secreto-oferentes");
  if (!fs.existsSync(archivo)) {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, randomBytes(32).toString("hex"));
  }
  return fs.readFileSync(archivo, "utf8");
}

function firmar(payload: string) {
  return createHmac("sha256", secreto()).update(payload).digest("base64url");
}

/** Token de sesión para la persona (id de public.personas). Tira si falta el secreto. */
export function crearSesion(personaId: string): string {
  const datos = { v: VERSION, id: personaId, exp: Math.floor(Date.now() / 1000) + VIDA_SESION_S };
  const payload = Buffer.from(JSON.stringify(datos), "utf8").toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verificarSesion(token: string | undefined): { id: string } | null {
  if (!token) return null;
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return null;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (datos?.v !== VERSION) return null;
    if (typeof datos.exp !== "number" || datos.exp * 1000 <= Date.now()) return null;
    // El id termina en request.jwt.claims (auth.uid() de las políticas RLS): tiene que ser un uuid.
    if (typeof datos.id !== "string" || !UUID.test(datos.id)) return null;
    return { id: datos.id };
  } catch {
    return null;
  }
}

/** Oferente con sesión iniciada (id de public.personas), o null. Se resuelve una vez por pedido. */
export const ciudadanoActual = cache(async () => {
  // La validez depende de la hora actual: siempre se evalúa en el pedido.
  await connection();
  try {
    return verificarSesion((await cookies()).get(COOKIE_SESION)?.value);
  } catch (e) {
    // Sin SESSION_SECRET en producción: nadie tiene sesión, pero el sitio sigue funcionando.
    console.error("Sesión de oferentes:", e instanceof Error ? e.message : e);
    return null;
  }
});

/** Cierra la sesión del oferente (desde una Server Action). */
export async function cerrarSesionCiudadano() {
  (await cookies()).delete(COOKIE_SESION);
}
