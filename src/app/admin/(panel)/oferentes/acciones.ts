"use server";

import { requerirAdmin } from "@/lib/admin/sesion";
import { buscarOferentes } from "@/lib/datos/admin/oferentes";
import type { EstadoBusqueda } from "./BuscadorOferentes";

/**
 * Búsqueda de oferentes por POST: el texto (puede ser un DNI o un correo) no queda en la
 * dirección, en el historial del navegador ni en los registros de pedidos del servidor.
 * Sin texto (o con «Ver a todas») devuelve null y se muestra el listado completo.
 */
export async function buscarOferentesAccion(_previo: EstadoBusqueda, datos: FormData): Promise<EstadoBusqueda> {
  const admin = await requerirAdmin();
  const busqueda = String(datos.get("q") ?? "").trim().slice(0, 100);
  if (!busqueda || datos.get("accion") === "todas") return null;
  try {
    return { busqueda, resultado: await buscarOferentes(admin, busqueda) };
  } catch (error) {
    // Solo el código: el error completo puede incluir la consulta con el texto buscado.
    console.error("No se pudo buscar oferentes. Código:", (error as { code?: string } | null)?.code ?? "sin código");
    return { busqueda, error: "No pudimos hacer la búsqueda. Probá de nuevo en unos segundos." };
  }
}
