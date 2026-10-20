"use client";

import { useEffect, useState } from "react";
import type { Foto } from "@/lib/datos/tipos";
import { FotoObra } from "./FotoObra";

/**
 * Fondo del hero: las fotos de las obras van pasando despacio (como en el Bus Turístico).
 * Con "reducir movimiento" queda fija la primera.
 */
export function FondoHero({ fotos }: { fotos: Foto[] }) {
  const [actual, setActual] = useState(0);

  useEffect(() => {
    if (fotos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActual((i) => (i + 1) % fotos.length), 6500);
    return () => window.clearInterval(id);
  }, [fotos.length]);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-azul-oscuro">
      {fotos.map((foto, i) => (
        <div
          key={foto.ruta}
          className={`absolute inset-0 transition-[opacity,transform] duration-[1600ms,8000ms] ease-out motion-reduce:transition-none ${
            i === actual ? "scale-105 opacity-100" : "scale-100 opacity-0"
          }`}
        >
          <FotoObra foto={{ ...foto, alt: "" }} tamanos="100vw" prioridad={i === 0} />
        </div>
      ))}
      {/* Velo institucional: degradé a 112° más denso a la izquierda, donde va el texto. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(112deg, rgb(13 63 176 / 0.94) 0%, rgb(13 63 176 / 0.86) 38%, rgb(18 111 245 / 0.55) 68%, rgb(37 137 234 / 0.25) 100%), linear-gradient(180deg, rgb(5 22 46 / 0) 55%, rgb(5 22 46 / 0.45) 100%)",
        }}
      />
    </div>
  );
}
