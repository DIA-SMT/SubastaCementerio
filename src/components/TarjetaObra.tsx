import Link from "next/link";
import type { Fase, ObraResumen } from "@/lib/datos/tipos";
import { pesos, tituloObra } from "@/lib/formato";
import { EstadoChip } from "./EstadoChip";
import { FotoObra } from "./FotoObra";

export function TarjetaObra({ obra, fase, prioridad }: { obra: ObraResumen; fase: Fase; prioridad?: boolean }) {
  return (
    <Link
      href={`/obras/${obra.numero}`}
      className="group block overflow-hidden rounded-2xl border border-linea bg-white shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/5] bg-linea">
        <FotoObra
          foto={obra.portada}
          tamanos="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          prioridad={prioridad}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1 font-bold text-tinta shadow">
          N° {obra.numero}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xl font-extrabold text-tinta">{obra.artistaNombre}</p>
        <p className={obra.titulo ? "text-texto" : "text-gris italic"}>{tituloObra(obra.titulo)}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {/* Los mismos textos que la ficha de la obra (PanelOferta). */}
            {obra.ofertaActual != null ? (
              <>
                <p className="text-base text-gris">
                  {fase === "cerrada" ? "Pasa a subasta presencial con base de" : "Oferta actual"}
                </p>
                <p className="text-2xl font-bold text-tinta">{pesos(obra.ofertaActual)}</p>
              </>
            ) : fase === "cerrada" ? (
              <p className="font-bold text-tinta">Sin ofertas en la etapa virtual</p>
            ) : (
              <>
                <p className="text-base text-gris">Sin ofertas</p>
                <p className="font-bold text-tinta">Desde {pesos(obra.precioSalida)}</p>
              </>
            )}
          </div>
          <EstadoChip fase={fase} />
        </div>
      </div>
    </Link>
  );
}
