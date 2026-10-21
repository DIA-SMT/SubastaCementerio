"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { cerrarSesion, usuarioActual } from "@/lib/auth";
import { actualizarMisDatos } from "@/lib/datos/oferente";

export type EstadoDatos = {
  ok?: boolean;
  error?: string;
  /** Campo al que corresponde el error, para asociarlo con aria-describedby. */
  campo?: "telefono";
  /** Lo que la persona mandó, para no perderlo cuando el guardado falla. */
  valores?: { telefono: string; avisos: boolean };
  /** Distinto en cada respuesta, para que el aviso se vuelva a anunciar. */
  vez?: number;
};

export async function guardarDatos(_previo: EstadoDatos, datos: FormData): Promise<EstadoDatos> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?volver=/mis-ofertas");
  const telefono = String(datos.get("telefono") ?? "");
  const avisos = datos.get("avisos") === "si";
  const vez = Date.now();

  let r: Awaited<ReturnType<typeof actualizarMisDatos>> | null = null;
  try {
    r = await actualizarMisDatos(usuario.id, telefono, avisos);
  } catch (error) {
    console.error("No se pudieron guardar los datos del oferente:", error);
  }
  if (r?.ok) {
    // La página vuelve a leer el perfil: el formulario muestra el teléfono tal como quedó guardado.
    refresh();
    return { ok: true, vez };
  }
  if (r?.codigo === "telefono_invalido") {
    return {
      error: "Escribí el teléfono con código de área, por ejemplo 381 555 1234.",
      campo: "telefono",
      valores: { telefono, avisos },
      vez,
    };
  }
  return { error: "No pudimos guardar los cambios. Probá de nuevo.", valores: { telefono, avisos }, vez };
}

export async function salir() {
  await cerrarSesion();
  redirect("/");
}
