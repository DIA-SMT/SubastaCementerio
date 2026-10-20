import "server-only";
import { headers } from "next/headers";
import { consultar } from "@/lib/db";

// Límites propios de intentos de ingreso (supabase/migrations/20261019140100_ingreso.sql).
// Se controlan antes de llamar a Supabase Auth, que solo limita por IP y ve la del servidor,
// compartida por todas las personas. Valen igual en el modo local.

const servicio = { rol: "servicio" } as const;

export type Permiso = "ok" | "limite_correo" | "limite_ip" | "sin_codigo" | "error";

/** IP de quien hace el pedido. En Vercel, x-real-ip y x-forwarded-for los pone la plataforma. */
async function ipDelPedido() {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || null;
}

async function permiso(texto: string, params: unknown[]): Promise<Permiso> {
  try {
    const [f] = await consultar<{ r: Permiso }>(servicio, texto, params);
    return f.r;
  } catch (e) {
    console.error("Límites de ingreso:", e instanceof Error ? e.message : e);
    return "error";
  }
}

/** Pedir un código: 3 por correo cada 15 minutos y 20 por IP por hora. Registra el pedido. */
export async function permitirPedidoDeCodigo(correo: string) {
  return permiso("select public.ingreso_pedir_codigo($1, $2) as r", [correo, await ipDelPedido()]);
}

/** Probar un código: 5 pruebas desde el último código pedido (en la última hora). */
export async function permitirPruebaDeCodigo(correo: string) {
  return permiso("select public.ingreso_probar_codigo($1) as r", [correo]);
}

/** Contraseña del panel: 5 intentos en 15 minutos por correo o por IP. */
export async function permitirPruebaDeContrasena(correo: string) {
  return permiso("select public.ingreso_probar_contrasena($1, $2) as r", [correo, await ipDelPedido()]);
}

/** Con la contraseña correcta, los intentos anteriores dejan de contar. */
export async function contrasenaCorrecta(correo: string) {
  try {
    await consultar(servicio, "select public.ingreso_contrasena_correcta($1, $2)", [correo, await ipDelPedido()]);
  } catch (e) {
    console.error("Límites de ingreso:", e instanceof Error ? e.message : e);
  }
}
