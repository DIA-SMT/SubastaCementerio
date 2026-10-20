import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { usuarioActual } from "@/lib/auth";
import { consultar, type Contexto } from "@/lib/db";

export type Admin = { id: string; email: string; nombre: string };

/** Integrante activo del equipo con sesión iniciada, o null. Se resuelve una vez por pedido. */
export const adminActual = cache(async (): Promise<Admin | null> => {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  const [fila] = await consultar<{ nombre: string }>(
    { rol: "authenticated", uid: usuario.id },
    "select nombre from public.admins where user_id = $1 and activo",
    [usuario.id],
  );
  return fila ? { ...usuario, nombre: fila.nombre } : null;
});

/**
 * Exige una sesión del equipo. Llamarla en CADA página, Server Action y Route Handler
 * del panel: el layout no protege las acciones ni las rutas de descarga.
 */
export async function requerirAdmin(): Promise<Admin> {
  const admin = await adminActual();
  if (!admin) redirect("/admin/ingresar");
  return admin;
}

/** Contexto de base de datos del integrante del equipo (las políticas RLS exigen es_admin()). */
export function comoAdmin(admin: Admin): Contexto {
  return { rol: "authenticated", uid: admin.id };
}
