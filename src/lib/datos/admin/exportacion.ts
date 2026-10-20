import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { estadoSubasta } from "@/lib/datos/publico";
import { consultar } from "@/lib/db";
import { urlDeObra } from "@/lib/exportacion/comun";
import type { ObraCartel } from "@/lib/exportacion/tipos";
import {
  SQL_LISTADO,
  SQL_REGISTRAR_EXPORTACION,
  armarListado,
  type FilaVista,
  type ListadoFinal,
} from "@/lib/exportacion/vista";

// Listado final para el martillero y obras para los carteles con QR. Corre como el
// integrante del equipo: public.v_listado_final solo devuelve filas a administradores.

export type { ListadoFinal } from "@/lib/exportacion/vista";
export type { ObraNoPublicada } from "@/lib/exportacion/tipos";

/**
 * Listado final: una fila por obra publicada, ordenado por número. Precio base = mayor
 * oferta válida. Mientras la etapa virtual no cerró, el listado es PRELIMINAR.
 */
export async function obtenerListadoFinal(admin: Admin): Promise<ListadoFinal> {
  // Primero la fase y después las ofertas (no en paralelo): si la fase dice "cerrada", las
  // filas se leyeron después del cierre y el listado FINAL no puede quedar sin la última oferta.
  const estado = await estadoSubasta();
  const vista = await consultar<FilaVista>(comoAdmin(admin), SQL_LISTADO);
  return armarListado(vista, estado);
}

/** Obras publicadas con la dirección de su ficha, para los carteles con QR. */
export async function obrasParaCarteles(
  admin: Admin,
  urlSitio: string,
): Promise<{ obras: ObraCartel[]; noPublicadas: number; generado: Date }> {
  // Sin datos personales: los carteles solo llevan la obra.
  const [vista, estado] = await Promise.all([
    consultar<Pick<FilaVista, "numero" | "titulo" | "artista_nombre" | "publicada">>(
      comoAdmin(admin),
      "select numero, titulo, artista_nombre, publicada from public.v_listado_final order by numero",
    ),
    estadoSubasta(),
  ]);
  return {
    obras: vista
      .filter((f) => f.publicada)
      .map((f) => ({
        numero: Number(f.numero),
        titulo: f.titulo ?? null,
        artista: String(f.artista_nombre),
        url: urlDeObra(urlSitio, Number(f.numero)),
      })),
    noPublicadas: vista.filter((f) => !f.publicada).length,
    generado: estado.ahora,
  };
}

/** Deja constancia en la auditoría de una descarga del listado (contiene datos personales). */
export async function registrarExportacion(
  admin: Admin,
  detalle: { formato: "xlsx" | "pdf"; preliminar: boolean; filas: number },
) {
  await consultar(comoAdmin(admin), SQL_REGISTRAR_EXPORTACION, [JSON.stringify(detalle)]);
}
