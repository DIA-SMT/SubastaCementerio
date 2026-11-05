"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Foto } from "@/lib/datos/tipos";
import { FotoObra, urlFoto } from "./FotoObra";

/** Milisegundos por cuadro: con 8 cuadros, una vuelta completa dura algo más de un segundo. */
const MS_POR_CUADRO = 140;

/**
 * Foto de la tarjeta que gira 360° mientras el mouse está sobre la tarjeta. Los cuadros (fotos
 * tomadas alrededor de la cabeza) se piden recién al primer paso del mouse, así el catálogo no
 * descarga ocho veces más de lo que muestra. Al salir, termina la vuelta y se detiene de frente.
 * En pantallas táctiles, o con "reducir movimiento", queda la portada fija.
 */
export function GiroObra({
  cuadros,
  tamanos,
  prioridad,
  className = "",
}: {
  cuadros: Foto[];
  tamanos: string;
  prioridad?: boolean;
  className?: string;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [pedidos, setPedidos] = useState(false);
  const [cargados, setCargados] = useState(0);
  const [girando, setGirando] = useState(false);
  const [cuadro, setCuadro] = useState(0);
  const total = cuadros.length;
  const listos = cargados >= total - 1;

  // Escucha a la tarjeta entera: el enlace del título la cubre y taparía a la foto.
  useEffect(() => {
    const tarjeta = raiz.current?.closest("article") ?? raiz.current;
    if (!tarjeta) return;
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const entrar = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || sinMovimiento.matches) return;
      setPedidos(true);
      setGirando(true);
    };
    const salir = () => setGirando(false);
    tarjeta.addEventListener("pointerenter", entrar);
    tarjeta.addEventListener("pointerleave", salir);
    return () => {
      tarjeta.removeEventListener("pointerenter", entrar);
      tarjeta.removeEventListener("pointerleave", salir);
    };
  }, []);

  // Avanza un cuadro por vez: mientras el mouse sigue encima, o hasta volver al frente.
  useEffect(() => {
    if (!listos || (!girando && cuadro === 0)) return;
    const t = setTimeout(() => setCuadro((c) => (c + 1) % total), MS_POR_CUADRO);
    return () => clearTimeout(t);
  }, [listos, girando, cuadro, total]);

  return (
    <div ref={raiz} className="absolute inset-0">
      <FotoObra
        foto={cuadros[0]}
        ajuste="contener"
        tamanos={tamanos}
        prioridad={prioridad}
        className={`${className} ${cuadro === 0 ? "" : "opacity-0"}`}
      />
      {pedidos &&
        cuadros.slice(1).map((foto, i) => (
          <Image
            key={foto.ruta}
            src={urlFoto(foto.ruta)}
            alt=""
            aria-hidden
            fill
            sizes={tamanos}
            loading="eager"
            onLoad={() => setCargados((n) => n + 1)}
            // Un cuadro que no carga no frena el giro: queda en blanco ese instante.
            onError={() => setCargados((n) => n + 1)}
            className={`object-contain ${className} ${cuadro === i + 1 ? "" : "opacity-0"}`}
          />
        ))}
      <span
        aria-hidden
        className={`pointer-events-none absolute top-2.5 right-2.5 z-10 rounded-full bg-white/85 px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.08em] text-tinta shadow-suave backdrop-blur-sm transition-opacity duration-300 ${girando && !listos ? "animate-pulse" : ""}`}
      >
        360°
      </span>
    </div>
  );
}
