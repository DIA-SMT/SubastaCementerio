"use server";

import { redirect } from "next/navigation";
import type { EstadoAccion } from "@/lib/admin/acciones";
import { cerrarSesion, ingresarConContrasena, type ErrorAuth } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { normalizarCorreo } from "@/lib/validacion";

const ERRORES: Partial<Record<ErrorAuth, string>> = {
  // Límite propio: 5 intentos en 15 minutos por correo o por conexión.
  demasiados_intentos: "Hubo demasiados intentos. Esperá 15 minutos y probá de nuevo.",
  servicio_ocupado: "Hubo demasiados intentos de ingreso. Esperá unos minutos y probá de nuevo.",
  error_servicio: "No pudimos revisar tus datos. Probá de nuevo en unos minutos.",
};

export async function ingresarAlPanel(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const email = normalizarCorreo(datos.get("email"));
  const contrasena = String(datos.get("contrasena") ?? "");
  if (!email || !contrasena) return { error: "Escribí tu correo y tu contraseña.", valores: { email: email ?? "" } };

  const r = await ingresarConContrasena(email, contrasena);
  if (!r.ok || !r.uid) {
    const error = (!r.ok && ERRORES[r.error]) || "El correo o la contraseña no son correctos.";
    return { error, valores: { email } };
  }

  const [admin] = await consultar(
    { rol: "authenticated", uid: r.uid },
    "select 1 from public.admins where user_id = $1 and activo",
    [r.uid],
  );
  if (!admin) {
    await cerrarSesion();
    return { error: "Esta cuenta no tiene acceso al panel.", valores: { email } };
  }
  redirect("/admin");
}
