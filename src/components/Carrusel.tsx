"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fila de tarjetas que se desliza con el dedo; en computadora, también con flechas. */
export function Carrusel({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const pista = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });

  const medir = () => {
    const el = pista.current;
    if (!el) return;
    setBordes({ inicio: el.scrollLeft < 8, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const mover = (sentido: number) => {
    const el = pista.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const flecha =
    "absolute top-[38%] z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-2xl font-bold text-azul-profundo shadow-elevada ring-1 ring-azul/20 transition hover:scale-105 disabled:opacity-0 md:inline-flex";

  return (
    <div className="relative">
      <button type="button" className={`${flecha} left-2`} onClick={() => mover(-1)} disabled={bordes.inicio} aria-label="Obras anteriores">
        ‹
      </button>
      <div
        ref={pista}
        onScroll={medir}
        role="region"
        aria-label={etiqueta}
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-1 pb-6 [scrollbar-width:none] md:mx-0 md:px-1"
      >
        {children}
      </div>
      <button type="button" className={`${flecha} right-2`} onClick={() => mover(1)} disabled={bordes.fin} aria-label="Obras siguientes">
        ›
      </button>
    </div>
  );
}
