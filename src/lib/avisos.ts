import "server-only";
import { consultar } from "@/lib/db";
import { enviarCorreo, sinCorreos } from "@/lib/correo";
import { faltasDeConfiguracion, urlSitio } from "@/lib/entorno";
import { fechaHoraLarga, fechaLarga, pesos, tituloObra } from "@/lib/formato";

const servicio = { rol: "servicio" } as const;

const VARIABLES = {
  correo: "el proveedor de correo (RESEND_API_KEY y CORREO_REMITENTE)",
  url_sitio: "la dirección pública del sitio (NEXT_PUBLIC_URL_SITIO)",
} as const;

/** Una fila de public.avisos_para_enviar (ya reservada para este envío). */
export type Aviso = {
  aviso_id: number | string;
  email: string;
  nombre: string;
  obra_numero: number;
  obra_titulo: string | null;
  artista_nombre: string;
  oferta_actual: number;
  minimo_siguiente: number;
  /** Cierre de esta obra (el general, o más tarde si una oferta de último momento lo extendió). */
  cierre_virtual: Date | string;
  /** Fase de esta obra. */
  fase: "por_confirmar" | "antes" | "abierta" | "cerrada";
  /** AAAA-MM-DD */
  fecha_presencial: string | null;
  detalle_presencial: string | null;
  bloqueado: boolean;
};

/**
 * Asunto y texto del aviso "te superaron". Solo invita a volver a ofertar mientras la etapa
 * virtual está abierta y la persona no está bloqueada.
 */
export function armarAviso(a: Aviso) {
  const obra = `obra N° ${a.obra_numero} — ${tituloObra(a.obra_titulo)}, de ${a.artista_nombre}`;
  const cuerpo: string[] = [];
  if (a.fase === "cerrada") {
    cuerpo.push(`La etapa virtual cerró. La obra pasa a subasta presencial con base de ${pesos(a.oferta_actual)}.`);
    cuerpo.push(
      a.fecha_presencial
        ? `La subasta presencial es el ${fechaLarga(a.fecha_presencial)}.${
            a.detalle_presencial ? ` ${a.detalle_presencial}` : ""
          }`
        : "La fecha de la subasta presencial está por confirmarse.",
    );
  } else {
    cuerpo.push(`La oferta actual es de ${pesos(a.oferta_actual)}.`);
    if (a.fase === "abierta" && !a.bloqueado) {
      cuerpo.push(
        `Si querés volver a ofertar, la próxima oferta tiene que ser de al menos ${pesos(a.minimo_siguiente)}.`,
        `La etapa virtual cierra el ${fechaHoraLarga(new Date(a.cierre_virtual))} (hora de Tucumán).`,
      );
    }
  }
  return {
    asunto: `Superaron tu oferta por la obra N° ${a.obra_numero}`,
    texto: [
      `Hola, ${a.nombre}:`,
      "",
      `Alguien superó tu oferta por la ${obra}.`,
      ...cuerpo,
      "",
      `Ver la obra: ${urlSitio}/obras/${a.obra_numero}`,
      "",
      "Municipalidad de San Miguel de Tucumán · Dirección de Cementerios",
      "Para dejar de recibir estos avisos, entrá a «Mis ofertas» en el sitio.",
    ].join("\n"),
  };
}

/**
 * Envía los avisos "te superaron" que correspondan. Devuelve cuántos salieron.
 *
 * Cada aviso se reserva en la base antes de enviarlo (avisos_para_enviar), así dos
 * ejecuciones simultáneas (el after() de una oferta y el cron) no mandan el mismo. Fuera del
 * modo local, si falta el proveedor de correo o la dirección del sitio, no reserva nada: los
 * avisos quedan pendientes, sin gastar intentos, y salen solos cuando se configure.
 */
export async function procesarAvisos(limite = 20) {
  const faltas = faltasDeConfiguracion().flatMap((f) => (f === "cron" ? [] : [VARIABLES[f]]));
  if (faltas.length > 0) {
    console.warn(`Avisos por correo: quedan pendientes, sin enviar. Falta configurar ${faltas.join(" y ")}.`);
    return 0;
  }

  const avisos = await consultar<Aviso>(servicio, "select * from public.avisos_para_enviar($1)", [limite]);
  let enviados = 0;
  for (const a of avisos) {
    const { asunto, texto } = armarAviso(a);
    let fallo: string | null = null;
    try {
      await enviarCorreo({ para: a.email, asunto, texto, idempotencia: `aviso-${a.aviso_id}` });
    } catch (error) {
      fallo = sinCorreos(error instanceof Error ? error.message : String(error));
      console.error(`No se pudo enviar el aviso ${a.aviso_id}: ${fallo}`);
    }
    try {
      await consultar(servicio, "select public.marcar_aviso($1, $2, $3)", [a.aviso_id, fallo == null, fallo]);
      if (fallo == null) enviados++;
    } catch (error) {
      // El aviso queda reservado: vencido el plazo se vuelve a intentar (con la misma clave
      // de Resend, que evita el duplicado si ya había salido).
      console.error(`No se pudo registrar el resultado del aviso ${a.aviso_id}:`, error);
    }
  }
  return enviados;
}
