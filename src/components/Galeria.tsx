"use client";

import { useRef, useState } from "react";
import type { Foto } from "@/lib/datos/tipos";
import { FotoObra } from "./FotoObra";

/** Fotos de la obra: se deslizan con el dedo; en computadora, con los botones. */
export function Galeria({ fotos }: { fotos: Foto[] }) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const lista = fotos.length > 0 ? fotos : [null];

  const ir = (i: number) => {
    const el = pista.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={pista}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActual(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-linea [scrollbar-width:none]"
        aria-label="Fotos de la obra"
        role="region"
        tabIndex={0}
      >
        {lista.map((foto, i) => (
          <div key={foto?.ruta ?? i} className="relative aspect-[4/5] w-full shrink-0 snap-center">
            <FotoObra foto={foto} tamanos="(min-width: 768px) 50vw, 100vw" prioridad={i === 0} />
          </div>
        ))}
      </div>
      {lista.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => ir(Math.max(0, actual - 1))}
            disabled={actual === 0}
            className="boton-secundario min-h-12 px-4"
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <p className="text-gris" aria-live="polite">
            Foto {actual + 1} de {lista.length}
          </p>
          <button
            type="button"
            onClick={() => ir(Math.min(lista.length - 1, actual + 1))}
            disabled={actual === lista.length - 1}
            className="boton-secundario min-h-12 px-4"
            aria-label="Foto siguiente"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
