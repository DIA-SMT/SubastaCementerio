import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { modoLocal } from "@/lib/entorno";
import {
  contrasenaCorrecta,
  permitirPedidoDeCodigo,
  permitirPruebaDeCodigo,
  permitirPruebaDeContrasena,
} from "./limites";
import type { ResultadoAuth } from "./tipos";

export type { ErrorAuth, ResultadoAuth, Usuario } from "./tipos";

const impl = () => (modoLocal ? import("./local") : import("./supabase"));

/** Usuario con sesión iniciada, o null. Se resuelve una vez por pedido. */
export const usuarioActual = cache(async () => {
  // La validez de la sesión depende de la hora actual: siempre se evalúa en el pedido.
  await connection();
  return (await impl()).usuarioActual();
});

// Los límites propios de intentos se controlan antes de llamar a Supabase Auth (o al modo local).

export async function enviarCodigo(email: string): Promise<ResultadoAuth> {
  const permiso = await permitirPedidoDeCodigo(email);
  if (permiso === "error") return { ok: false, error: "error_servicio" };
  if (permiso === "limite_ip") return { ok: false, error: "limite_conexion" };
  if (permiso !== "ok") return { ok: false, error: "limite_envios" };
  return (await impl()).enviarCodigo(email);
}

export async function verificarCodigo(email: string, codigo: string): Promise<ResultadoAuth> {
  const permiso = await permitirPruebaDeCodigo(email);
  if (permiso === "error") return { ok: false, error: "error_servicio" };
  // Sin un código pedido en la última hora, ninguno puede estar vigente.
  if (permiso === "sin_codigo") return { ok: false, error: "codigo_vencido" };
  if (permiso !== "ok") return { ok: false, error: "demasiados_intentos" };
  return (await impl()).verificarCodigo(email, codigo);
}

export async function ingresarConContrasena(email: string, contrasena: string): Promise<ResultadoAuth> {
  const permiso = await permitirPruebaDeContrasena(email);
  if (permiso === "error") return { ok: false, error: "error_servicio" };
  if (permiso !== "ok") return { ok: false, error: "demasiados_intentos" };
  const r = await (await impl()).ingresarConContrasena(email, contrasena);
  if (r.ok) await contrasenaCorrecta(email);
  return r;
}

export async function cerrarSesion() {
  return (await impl()).cerrarSesion();
}
