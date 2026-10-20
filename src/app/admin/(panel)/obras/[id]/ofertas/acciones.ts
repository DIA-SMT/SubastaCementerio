"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeDeErrorDb, type EstadoAccion } from "@/lib/admin/acciones";
import { requerirAdmin } from "@/lib/admin/sesion";
import { anularOferta } from "@/lib/datos/admin/ofertas";

const MENSAJES: Record<string, string> = {
  sin_permiso: "Tu usuario no tiene permiso para anular ofertas.",
  no_encontrada: "No encontramos esa oferta. Volvé a abrir el listado de ofertas de la obra.",
  ya_anulada: "Esta oferta ya estaba anulada. Revisá el listado actualizado.",
};

/**
 * Anula una oferta con motivo. La oferta no se borra: queda registrada como anulada.
 * Si sale bien, vuelve al listado de la obra con el aviso del resultado.
 */
export async function anularOfertaAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();

  const ofertaTexto = String(datos.get("oferta") ?? "");
  const motivo = String(datos.get("motivo") ?? "").trim();
  const confirmado = datos.get("confirmacion") === "si";

  if (!/^\d{1,15}$/.test(ofertaTexto) || Number(ofertaTexto) <= 0) {
    return { error: MENSAJES.no_encontrada, valores: { motivo } };
  }

  // Se cuentan caracteres como la base (un emoji es uno solo), no unidades de JavaScript.
  const largo = Array.from(motivo).length;
  const errores: Record<string, string> = {};
  if (largo < 5) errores.motivo = "Escribí el motivo de la anulación (al menos 5 caracteres).";
  else if (largo > 500) errores.motivo = "El motivo puede tener hasta 500 caracteres.";
  if (!confirmado) errores.confirmacion = "Marcá la casilla para confirmar la anulación.";
  if (Object.keys(errores).length > 0) {
    return { errores, valores: { motivo } };
  }

  let resultado: Awaited<ReturnType<typeof anularOferta>>;
  try {
    resultado = await anularOferta(admin, Number(ofertaTexto), motivo);
  } catch (error) {
    return { error: mensajeDeErrorDb(error), valores: { motivo } };
  }

  if (!resultado.ok) {
    if (resultado.codigo === "motivo_requerido") {
      return { errores: { motivo: "Escribí el motivo de la anulación (al menos 5 caracteres)." }, valores: { motivo } };
    }
    if (resultado.codigo === "ya_anulada") refresh();
    return { error: MENSAJES[resultado.codigo] ?? "No se pudo anular la oferta. Probá de nuevo.", valores: { motivo } };
  }

  // El aviso de la página muestra la oferta anulada y la nueva oferta más alta.
  redirect(`/admin/obras/${resultado.obraId}/ofertas?anulada=${ofertaTexto}`);
}
