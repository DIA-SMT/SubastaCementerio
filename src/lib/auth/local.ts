import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { consultar } from "@/lib/db";
import type { ResultadoAuth, Usuario } from "./tipos";

// Ingreso al panel en el MODO LOCAL. Reemplaza a Supabase Auth solo para desarrollo: la
// contraseña se compara contra auth.users de PGlite y la sesión es una cookie firmada. Los
// oferentes ingresan con Cidituc también en local (src/lib/auth/ciudadano.ts).

const COOKIE = "subasta_sesion_local";
const DURACION_S = 60 * 60 * 24 * 30;
const servicio = { rol: "servicio" } as const;

function secreto() {
  if (process.env.SESION_LOCAL_SECRETO) return process.env.SESION_LOCAL_SECRETO;
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
