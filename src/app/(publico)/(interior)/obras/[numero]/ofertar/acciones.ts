"use server";

import { after } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { procesarAvisos } from "@/lib/avisos";
import { ofertar } from "@/lib/datos/oferente";
import { MONTO_MAXIMO, montoDesdeTexto } from "@/lib/validacion";

export type ResultadoOferta =
  | { estado: "inicial" }
  /** cierreExtendido: nueva hora de cierre de la obra (ISO) si esta oferta lo extendió. */
  | { estado: "ok"; monto: number; cierreExtendido: string | null }
  | { estado: "error"; codigo: string; minimo?: number; ofertaActual?: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function confirmarOferta(_previo: ResultadoOferta, datos: FormData): Promise<ResultadoOferta> {
  const usuario = await usuarioActual();
  if (!usuario) return { estado: "error", codigo: "sin_sesion" };

  const obraId = String(datos.get("obraId") ?? "");
  const monto = montoDesdeTexto(datos.get("monto"));
  if (!UUID.test(obraId)) return { estado: "error", codigo: "obra_inexistente" };
  if (monto == null) return { estado: "error", codigo: "monto_invalido" };
  // La base recibe un integer: un monto más grande falla antes de llegar a su propio control.
  if (monto > MONTO_MAXIMO) return { estado: "error", codigo: "monto_muy_alto" };

  let r: Awaited<ReturnType<typeof ofertar>>;
  try {
    r = await ofertar(usuario.id, obraId, monto);
  } catch (error) {
    console.error("No se pudo registrar la oferta:", error);
    return { estado: "error", codigo: "error_interno" };
  }
  if (!r.ok) {
    return {
      estado: "error",
      codigo: String(r.codigo),
      minimo: typeof r.minimo === "number" ? r.minimo : undefined,
      ofertaActual: typeof r.oferta_actual === "number" ? r.oferta_actual : null,
    };
  }

  // Los avisos a quien quedó superado salen después de responder. Se procesa la cola en toda
  // oferta aceptada, no solo cuando se encoló un aviso nuevo: si ya había uno pendiente para
  // esa persona y esa obra, ofertar() no crea otro, pero esta oferta puede habilitarlo.
  after(async () => {
    await procesarAvisos().catch((e) => console.error("Avisos:", e));
  });
  const cierreExtendido = r.extendio === true && typeof r.cierre === "string" ? new Date(r.cierre).toISOString() : null;
  return { estado: "ok", monto, cierreExtendido };
}
