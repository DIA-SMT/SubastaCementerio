import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { consultar } from "@/lib/db";
import { plataforma } from "@/lib/entorno";
import type { ResultadoAuth, Usuario } from "./tipos";

// Ingreso al panel sin Supabase Auth: en el modo local (desarrollo) y en el servidor propio
// (VPS). La contraseña se compara contra auth.users (bcrypt, el mismo formato que usa Supabase:
// las cuentas del equipo se copian tal cual) y la sesión es una cookie firmada. Los oferentes
// ingresan con Cidituc y tienen su propia sesión (src/lib/auth/ciudadano.ts).

const enServidor = plataforma === "propio";
const COOKIE = enServidor ? "subasta_sesion_panel" : "subasta_sesion_local";
// En el servidor, como con Supabase: una semana. En local, un mes para no reingresar tanto.
const DURACION_S = 60 * 60 * 24 * (enServidor ? 7 : 30);
const servicio = { rol: "servicio" } as const;

function secreto() {
  const propio = process.env.SESION_PANEL_SECRETO?.trim() || process.env.SESION_LOCAL_SECRETO?.trim();
  if (propio) return propio;
  // En el servidor no se inventa uno: cambiaría en cada despliegue y cerraría todas las sesiones.
  if (enServidor) {
    throw new Error("Falta SESION_PANEL_SECRETO (32 caracteres o más) para las sesiones del panel.");
  }
  const archivo = path.join(process.cwd(), ".local", "secreto");
  if (!fs.existsSync(archivo)) {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, crypto.randomBytes(32).toString("hex"));
  }
  return fs.readFileSync(archivo, "utf8");
}

function firmar(valor: string) {
  return crypto.createHmac("sha256", secreto()).update(valor).digest("base64url");
}

async function abrirSesion(uid: string) {
  const vence = Math.floor(Date.now() / 1000) + DURACION_S;
  const valor = `${uid}.${vence}`;
  (await cookies()).set(COOKIE, `${valor}.${firmar(valor)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_S,
  });
}

export async function usuarioActual(): Promise<Usuario | null> {
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return null;
  const [uid, vence, firma] = cookie.split(".");
  const valor = `${uid}.${vence}`;
  const esperada = firmar(valor);
  if (
    !firma ||
    firma.length !== esperada.length ||
    !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada)) ||
    Number(vence) * 1000 < Date.now()
  ) {
    return null;
  }
  const filas = await consultar<{ id: string; email: string }>(
    servicio,
    "select id, email from auth.users where id = $1",
    [uid],
  );
  return filas[0] ?? null;
}

export async function ingresarConContrasena(email: string, contrasena: string): Promise<ResultadoAuth> {
  const [usuario] = await consultar<{ id: string }>(
    servicio,
    `select id from auth.users
     where lower(email) = lower($1) and encrypted_password is not null
       and encrypted_password = extensions.crypt($2, encrypted_password)`,
    [email, contrasena],
  );
  if (!usuario) return { ok: false, error: "credenciales_invalidas" };
  await abrirSesion(usuario.id);
  return { ok: true, uid: usuario.id };
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}
