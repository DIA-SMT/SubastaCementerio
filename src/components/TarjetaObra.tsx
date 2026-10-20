import Link from "next/link";
import type { Fase, ObraResumen } from "@/lib/datos/tipos";
import { pesos, tituloObra } from "@/lib/formato";
import { EstadoChip } from "./EstadoChip";
import { FotoObra } from "./FotoObra";
import { IconoFlecha } from "./Iconos";

/** Estado de la obra para quien mira: si la oferta más alta es suya, se lo decimos. */
function estadoDeObra(obra: ObraResumen, fase: Fase) {
  if (fase === "abierta" && obra.ofertaActualEsMia) return "Tenés la oferta más alta";
  return undefined;
}

/**
 * Tarjeta de obra para la grilla. El título es el enlace a la ficha y cubre toda la tarjeta;
 * "Realizar oferta" es un enlace aparte, encima. Se adapta al ancho de la propia tarjeta
 * (consulta de contenedor): angosta en la grilla de dos columnas del celular, completa en el resto.
 */
export function TarjetaObra({
  obra,
  fase,
  prioridad,
  tamanos = "(min-width: 1024px) 400px, 50vw",
}: {
  obra: ObraResumen;
  fase: Fase;
  prioridad?: boolean;
  tamanos?: string;
}) {
  const puedeOfertar = fase === "abierta" && !obra.ofertaActualEsMia;
  const cantidad = `${obra.cantidadOfertas} ${obra.cantidadOfertas === 1 ? "oferta" : "ofertas"}`;

  // Los mismos datos que el panel de la ficha (PanelOferta), en versión corta.
  let rotulo: string;
  let monto: string | null;
  let detalle: string;
  if (obra.ofertaActual != null) {
    rotulo = fase === "cerrada" ? "Base de la subasta presencial" : "Oferta actual";
    monto = pesos(obra.ofertaActual);
    detalle = cantidad;
  } else if (fase === "cerrada") {
    rotulo = "Sin ofertas";
    monto = null;
    detalle = "Pasa a la subasta presencial";
  } else {
    rotulo = "Ofertas desde";
    monto = pesos(obra.precioSalida);
    detalle = "Todavía sin ofertas";
  }

  return (
    <article className="tarjeta-obra @container group relative flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-suave ring-1 ring-tinta/[0.05] transition-shadow duration-300 ease-suave hover:shadow-elevada">
      <div className="relative aspect-[4/5] overflow-hidden bg-piedra">
        <FotoObra
          foto={obra.portada}
          tamanos={tamanos}
          prioridad={prioridad}
          className="transition-transform duration-300 ease-suave group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col p-3.5 @min-[15rem]:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-[0.8rem] font-medium text-gris tabular-nums">N° {obra.numero}</span>
          <span className="hidden @min-[15rem]:inline-flex">
            <EstadoChip fase={fase} texto={estadoDeObra(obra, fase)} />
          </span>
        </div>
        <h3 className="mt-1.5 text-[1rem] leading-snug tracking-[-0.015em] @min-[15rem]:text-subtitulo">
          <Link href={`/obras/${obra.numero}`} className="enlace-tarjeta after:absolute after:inset-0 after:z-0">
            <span className={obra.titulo ? "" : "italic"}>{tituloObra(obra.titulo)}</span>
          </Link>
        </h3>
        <p className="mt-0.5 text-[0.88rem] text-gris @min-[15rem]:text-[0.94rem]">{obra.artistaNombre}</p>

        <div className="mt-auto pt-4 @min-[15rem]:pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-linea pt-3 @min-[15rem]:pt-4">
            <div className="min-w-0">
              <p className="text-[0.68rem] leading-snug font-semibold tracking-[0.09em] text-gris uppercase @min-[15rem]:text-rotulo @min-[15rem]:tracking-[0.14em]">
                {rotulo}
              </p>
              {monto && (
                <p className="mt-1 font-display text-[1.05rem] leading-tight font-semibold tracking-[-0.02em] text-tinta tabular-nums @min-[15rem]:text-[1.45rem]">
                  {monto}
                </p>
              )}
              <p className="mt-0.5 text-[0.8rem] text-gris @min-[15rem]:text-[0.85rem]">{detalle}</p>
              {/* En la tarjeta angosta, el estado propio va acá (no hay lugar arriba). */}
              {estadoDeObra(obra, fase) && (
                <p className="mt-1.5 @min-[15rem]:hidden">
                  <EstadoChip fase={fase} texto={estadoDeObra(obra, fase)} />
                </p>
              )}
            </div>
            {puedeOfertar ? (
              <Link
                href={`/obras/${obra.numero}/ofertar`}
                className="relative z-10 hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 -mr-2 -mb-1.5 text-[0.9rem] font-semibold text-azul transition-colors duration-200 hover:bg-fondo hover:text-azul-profundo @min-[15rem]:inline-flex"
              >
                Realizar oferta
                <span className="sr-only"> por la obra N° {obra.numero}</span>
                <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <span
                aria-hidden
                className="hidden shrink-0 items-center gap-1.5 pb-1 text-[0.9rem] font-semibold text-tinta @min-[15rem]:inline-flex"
              >
                Ver obra
                <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
