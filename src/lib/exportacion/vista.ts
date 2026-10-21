import type { EstadoSubasta } from "@/lib/datos/tipos";
import { totalesListado } from "./comun";
import type { FilaListado, MetaListado, ObraNoPublicada, TotalesListado } from "./tipos";

// Lectura de public.v_listado_final para el listado del martillero: el texto de las consultas
// y el armado del listado a partir de las filas. No accede a la base (la consulta la hace
// src/lib/datos/admin/exportacion.ts), así las pruebas usan exactamente el mismo SQL.

export type ListadoFinal = {
  filas: FilaListado[];
  noPublicadas: ObraNoPublicada[];
  estado: EstadoSubasta;
  meta: MetaListado;
  totales: TotalesListado;
};

/** Una fila de public.v_listado_final, tal como la devuelve SQL_LISTADO. */
export type FilaVista = {
  obra_id: string;
  numero: number;
  titulo: string | null;
  artista_nombre: string;
  publicada: boolean;
  precio_salida: number;
  precio_base: number | null;
  oferta_at: Date | string | null;
  alias_numero: number | null;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  cantidad_ofertas: number;
  bloqueado: boolean;
};

export const SQL_LISTADO = `select obra_id, numero, titulo, artista_nombre, publicada, precio_salida, precio_base,
         oferta_at, alias_numero, nombre, apellido, dni, telefono, email,
         cantidad_ofertas::int as cantidad_ofertas, bloqueado
  from public.v_listado_final
  order by numero`;

/**
 * Deja constancia de una descarga del listado. El detalle va como texto y se convierte en la
 * base: con `$1::jsonb`, postgres.js (producción) vuelve a serializar el JSON y la auditoría
 * guarda un string en lugar de un objeto.
 */
export const SQL_REGISTRAR_EXPORTACION = "select public.registrar_evento('exportar_listado', $1::text::jsonb)";

export function aFila(f: FilaVista): FilaListado {
  const conOferta = f.precio_base != null;
  return {
    obraId: String(f.obra_id),
    numero: Number(f.numero),
    titulo: f.titulo ?? null,
    artista: String(f.artista_nombre),
    precioSalida: Number(f.precio_salida),
    precioBase: conOferta ? Number(f.precio_base) : null,
    ofertaAt: conOferta && f.oferta_at != null ? new Date(f.oferta_at) : null,
    oferente:
      conOferta && f.alias_numero != null
        ? {
            alias: Number(f.alias_numero),
            nombre: String(f.nombre ?? ""),
            apellido: String(f.apellido ?? ""),
            dni: String(f.dni ?? ""),
            telefono: String(f.telefono ?? ""),
            email: String(f.email ?? ""),
            bloqueado: Boolean(f.bloqueado),
          }
        : null,
    cantidadOfertas: Number(f.cantidad_ofertas),
  };
}

export function aNoPublicada(f: FilaVista): ObraNoPublicada {
  return {
    obraId: String(f.obra_id),
    numero: Number(f.numero),
    titulo: f.titulo ?? null,
    artista: String(f.artista_nombre),
    cantidadOfertas: Number(f.cantidad_ofertas),
    mayorOferta: f.precio_base == null ? null : Number(f.precio_base),
  };
}

/**
 * Listado final: una fila por obra publicada, ordenado por número. Precio base = mayor oferta
 * válida. Las obras sin publicar quedan afuera, con sus ofertas, para avisarlo en el listado.
 * Mientras la etapa virtual no cerró, el listado es PRELIMINAR.
 */
export function armarListado(vista: FilaVista[], estado: EstadoSubasta): ListadoFinal {
  const filas = vista.filter((f) => f.publicada).map(aFila);
  const noPublicadas = vista.filter((f) => !f.publicada).map(aNoPublicada);
  const meta: MetaListado = {
    generado: estado.ahora,
    preliminar: estado.fase !== "cerrada",
    cierre: estado.cierreFinal,
    modoEjemplo: estado.modoEjemplo,
    noPublicadas,
  };
  return { filas, noPublicadas, estado, meta, totales: totalesListado(filas) };
}
