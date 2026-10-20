"use client";

import { useRef, useState } from "react";
import type { Foto } from "@/lib/datos/tipos";
import { FotoObra, urlFoto } from "./FotoObra";

/** Fotos de la obra: se deslizan con el dedo; en computadora, con flechas y miniaturas. */
export function Galeria({ fotos }: { fotos: Foto[] }) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const lista = fotos.length > 0 ? fotos : [null];

  const ir = (i: number) => {
    const el = pista.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const flecha =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl font-bold text-azul-profundo shadow-elevada transition hover:scale-105 disabled:opacity-0";

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-white shadow-suave ring-1 ring-linea/70">
        <div
          ref={pista}
          onScroll={(e) => {
            const el = e.currentTarget;
            setActual(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          aria-label="Fotos de la obra"
          role="region"
          tabIndex={0}
        >
          {lista.map((foto, i) => (
            <div key={foto?.ruta ?? i} className="relative aspect-[4/5] w-full shrink-0 snap-center">
              <FotoObra foto={foto} tamanos="(min-width: 1024px) 55vw, 100vw" prioridad={i === 0} />
            </div>
          ))}
        </div>
        {lista.length > 1 && (
          <>
            <button type="button" onClick={() => ir(actual - 1)} disabled={actual === 0} className={`${flecha} left-3`} aria-label="Foto anterior">
              ‹
            </button>
            <button
              type="button"
              onClick={() => ir(actual + 1)}
              disabled={actual === lista.length - 1}
              className={`${flecha} right-3`}
              aria-label="Foto siguiente"
            >
              ›
            </button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-tinta/80 px-3 py-1 text-sm font-bold text-white" aria-live="polite">
              Foto {actual + 1} de {lista.length}
            </p>
          </>
        )}
      </div>
      {fotos.length > 1 && (
        <ul className="mt-3 flex gap-3">
          {fotos.map((foto, i) => (
            <li key={foto.ruta}>
              <button
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ver la foto ${i + 1}`}
                aria-current={i === actual ? "true" : undefined}
                className={`relative block h-20 w-16 overflow-hidden rounded-xl ring-2 transition ${
                  i === actual ? "ring-azul" : "ring-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura decorativa del mismo archivo */}
                <img src={urlFoto(foto.ruta)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
