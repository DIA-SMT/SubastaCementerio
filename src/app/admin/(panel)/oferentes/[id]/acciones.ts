"use server";

import { refresh } from "next/cache";
import { mensajeDeErrorDb, type EstadoAccion } from "@/lib/admin/acciones";
import { requerirAdmin } from "@/lib/admin/sesion";
import { esUuid } from "@/lib/datos/admin/ofertas";
import { cambiarBloqueo } from "@/lib/datos/admin/oferentes";

/**
 * Bloquea (con motivo obligatorio) o desbloquea a una persona. Bloquear impide nuevas
 * ofertas, pero no anula las que ya hizo: eso se hace oferta por oferta desde cada obra.
 */
export async function cambiarBloqueoAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();

  const id = String(datos.get("oferente") ?? "");
  const accion = String(datos.get("accion") ?? "");
  if (!esUuid(id) || (accion !== "bloquear" && accion !== "desbloquear")) {
    return { error: "No encontramos a esta persona. Volvé a abrir su ficha desde el listado de oferentes." };
  }

  const motivo = String(datos.get("motivo") ?? "").trim();
  // Se cuentan caracteres como la base (un emoji es uno solo), no unidades de JavaScript.
  const largo = Array.from(motivo).length;
  if (accion === "bloquear") {
    if (largo < 5) {
      return { errores: { motivo: "Escribí el motivo del bloqueo (al menos 5 caracteres)." }, valores: { motivo } };
    }
    if (largo > 500) {
      return { errores: { motivo: "El motivo puede tener hasta 500 caracteres." }, valores: { motivo } };
    }
  }

  let encontrado: boolean;
  try {
    encontrado = await cambiarBloqueo(
      admin,
      id,
      accion === "bloquear" ? { bloquear: true, motivo } : { bloquear: false },
    );
  } catch (error) {
    return { error: mensajeDeErrorDb(error), valores: { motivo } };
  }
  if (!encontrado) {
    return { error: "No encontramos a esta persona o tu usuario no tiene permiso para cambiar el bloqueo." };
  }

  refresh();
  return {
    ok: true,
    mensaje:
      accion === "bloquear"
        ? "Listo: la persona quedó bloqueada y no puede hacer nuevas ofertas. Sus ofertas anteriores siguen vigentes."
        : "Listo: la persona quedó desbloqueada y puede volver a ofertar.",
  };
}
