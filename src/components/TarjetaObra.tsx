import Link from "next/link";
import type { Fase, ObraResumen } from "@/lib/datos/tipos";
import { pesos, tituloObra } from "@/lib/formato";
import { EstadoChip } from "./EstadoChip";
import { FotoObra } from "./FotoObra";

export function TarjetaObra({
  obra,
  fase,
  prioridad,
  tamanos = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
  obra: ObraResumen;
  fase: Fase;
  prioridad?: boolean;
  tamanos?: string;
}) {
  return (
    <Link
      href={`/obras/${obra.numero}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-suave ring-1 ring-linea/70 transition duration-200 hover:-translate-y-1 hover:shadow-elevada"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-superficie">
        <FotoObra
          foto={obra.portada}
          tamanos={tamanos}
          prioridad={prioridad}
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-sm font-extrabold text-tinta shadow-sm">
          N° {obra.numero}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xl leading-tight font-extrabold text-tinta">{obra.artistaNombre}</p>
        <p className={`mt-1 ${obra.titulo ? "text-texto" : "text-texto italic"}`}>{tituloObra(obra.titulo)}</p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-linea pt-4">
          <div>
            {/* Los mismos textos que la ficha de la obra (PanelOferta). */}
            {obra.ofertaActual != null ? (
              <>
                <p className="text-sm font-bold text-texto">
                  {fase === "cerrada" ? "Pasa a subasta presencial con base de" : "Oferta actual"}
                </p>
                <p className="text-2xl font-extrabold text-tinta tabular-nums">{pesos(obra.ofertaActual)}</p>
              </>
            ) : fase === "cerrada" ? (
              <p className="font-bold text-tinta">Sin ofertas en la etapa virtual</p>
            ) : (
              <>
                <p className="text-sm font-bold text-texto">Sin ofertas</p>
                <p className="text-xl font-extrabold text-tinta tabular-nums">Desde {pesos(obra.precioSalida)}</p>
              </>
            )}
          </div>
          <EstadoChip fase={fase} />
        </div>
      </div>
    </Link>
  );
}
