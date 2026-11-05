"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { Foto } from "@/lib/datos/tipos";
import { FotoObra, urlFoto } from "./FotoObra";

/**
 * Tiempo que dura cada cuadro. El fundido al siguiente ocupa todo ese tiempo, así el giro es
 * continuo y no a saltos: con 8 cuadros, una vuelta completa tarda unos 3 segundos.
 */
const MS_POR_CUADRO = 380;
/** Al sacar el mouse, vuelve al frente con un fundido algo más largo. */
const MS_VUELTA_AL_FRENTE = 450;

type Vista = { actual: number; anterior: number; fundido: number };

/**
 * Foto de la tarjeta que gira 360° mientras el mouse está sobre la tarjeta. Los cuadros (fotos
 * tomadas alrededor de la cabeza) se piden recién al primer paso del mouse, así el catálogo no
 * descarga ocho veces más de lo que muestra. Cada cuadro aparece con un fundido sobre el
 * anterior, que queda visible debajo hasta que el nuevo termina de aparecer: así no se ve el
 * fondo entre uno y otro. Al salir, vuelve al frente con un fundido.
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
  const [vista, setVista] = useState<Vista>({ actual: 0, anterior: 0, fundido: 0 });
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
    const salir = () => {
      setGirando(false);
      setVista((v) => (v.actual === 0 ? v : { actual: 0, anterior: v.actual, fundido: MS_VUELTA_AL_FRENTE }));
    };
    tarjeta.addEventListener("pointerenter", entrar);
    tarjeta.addEventListener("pointerleave", salir);
    return () => {
      tarjeta.removeEventListener("pointerenter", entrar);
      tarjeta.removeEventListener("pointerleave", salir);
    };
  }, []);

  // Mientras el mouse sigue encima, pasa al cuadro siguiente a ritmo constante.
  useEffect(() => {
    if (!listos || !girando) return;
    const avanzar = () =>
      setVista((v) => ({ actual: (v.actual + 1) % total, anterior: v.actual, fundido: MS_POR_CUADRO }));
    avanzar();
    const t = setInterval(avanzar, MS_POR_CUADRO);
    return () => clearInterval(t);
  }, [listos, girando, total]);

  // El cuadro actual aparece encima con un fundido; el anterior queda visible debajo; el resto, oculto.
  const capa = (i: number): CSSProperties =>
    i === vista.actual
      ? { opacity: 1, zIndex: 2, transition: `opacity ${vista.fundido}ms ease-in-out` }
      : i === vista.anterior
        ? { opacity: 1, zIndex: 1 }
        : { opacity: 0, zIndex: 0 };

  return (
    <div ref={raiz} className={`absolute inset-0 ${className}`}>
      <div className="absolute inset-0" style={capa(0)}>
        <FotoObra foto={cuadros[0]} ajuste="contener" tamanos={tamanos} prioridad={prioridad} />
      </div>
      {pedidos &&
        cuadros.slice(1).map((foto, i) => (
          <div key={foto.ruta} aria-hidden className="absolute inset-0" style={capa(i + 1)}>
            <Image
              src={urlFoto(foto.ruta)}
              alt=""
              fill
              sizes={tamanos}
              loading="eager"
              onLoad={() => setCargados((n) => n + 1)}
              // Un cuadro que no carga no frena el giro: queda en blanco ese instante.
              onError={() => setCargados((n) => n + 1)}
              className="object-contain"
            />
          </div>
        ))}
      <span
        aria-hidden
        className={`pointer-events-none absolute top-2.5 right-2.5 z-10 rounded-full bg-white/85 px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.08em] text-tinta shadow-suave backdrop-blur-sm ${girando && !listos ? "animate-pulse" : ""}`}
      >
        360°
      </span>
    </div>
  );
}
