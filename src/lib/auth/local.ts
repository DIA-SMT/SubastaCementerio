import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { consultar } from "@/lib/db";
import type { ResultadoAuth, Usuario } from "./tipos";

// Autenticación del MODO LOCAL. Reemplaza a Supabase Auth solo para desarrollo:
// el código de ingreso se muestra en pantalla y la sesión es una cookie firmada.

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

export async function enviarCodigo(email: string): Promise<ResultadoAuth> {
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await consultar(
    servicio,
    `insert into local.codigos (email, codigo, vence_at, intentos)
     values ($1, $2, now() + interval '10 minutes', 0)
     on conflict (email) do update set codigo = excluded.codigo, vence_at = excluded.vence_at, intentos = 0`,
    [email, codigo],
  );
  console.info(`[modo local] Código de ingreso para ${email}: ${codigo}`);
  return { ok: true, codigoLocal: codigo };
}

export async function verificarCodigo(email: string, codigo: string): Promise<ResultadoAuth> {
  const [fila] = await consultar<{ codigo: string; vencido: boolean; intentos: number }>(
    servicio,
    "select codigo, vence_at < now() as vencido, intentos from local.codigos where email = $1",
    [email],
  );
  if (!fila || fila.vencido) return { ok: false, error: "codigo_vencido" };
  if (fila.intentos >= 5) return { ok: false, error: "demasiados_intentos" };
  if (fila.codigo !== codigo) {
    await consultar(servicio, "update local.codigos set intentos = intentos + 1 where email = $1", [email]);
    return { ok: false, error: "codigo_incorrecto" };
  }
  await consultar(servicio, "delete from local.codigos where email = $1", [email]);
  const [usuario] = await consultar<{ id: string }>(
    servicio,
    `insert into auth.users (email, email_confirmed_at) values ($1, now())
     on conflict (email) do update set email_confirmed_at = coalesce(auth.users.email_confirmed_at, now())
     returning id`,
    [email],
  );
  await abrirSesion(usuario.id);
  return { ok: true, uid: usuario.id };
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
