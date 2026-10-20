"use client";

import { useRef, useState } from "react";
import type { Foto } from "@/lib/datos/tipos";
import { FotoObra, urlFoto } from "./FotoObra";
import { IconoAmpliar, IconoAnterior, IconoCerrar, IconoSiguiente } from "./Iconos";

/**
 * Fotos de la obra: la obra se ve entera (sin recortes) sobre fondo piedra. Se deslizan con el
 * dedo; en computadora, con flechas y miniaturas. "Ampliar" la abre a pantalla completa.
 */
export function Galeria({ fotos, titulo }: { fotos: Foto[]; titulo: string }) {
  const pista = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState(0);
  const [ampliada, setAmpliada] = useState(0);
  const lista = fotos.length > 0 ? fotos : [null];
  const varias = lista.length > 1;

  const ir = (i: number) => {
    const el = pista.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const ampliar = () => {
    setAmpliada(actual);
    dialogo.current?.showModal();
  };

  const mover = (delta: number) => setAmpliada((i) => (i + delta + lista.length) % lista.length);

  const flecha =
    "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-tinta shadow-suave ring-1 ring-tinta/5 transition-[opacity,background-color] duration-200 hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:inline-flex";

  return (
    <div>
      <div className="relative overflow-hidden bg-piedra sm:rounded-sm">
        <div
          ref={pista}
          onScroll={(e) => {
            const el = e.currentTarget;
            setActual(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] lg:aspect-auto lg:h-[min(calc(100svh-13rem),50rem)]"
          aria-label={`Fotos de ${titulo}`}
          role="region"
          tabIndex={0}
        >
          {lista.map((foto, i) => (
            <div key={foto?.ruta ?? i} className="relative h-full w-full shrink-0 snap-center">
              <FotoObra
                foto={foto}
                ajuste="contener"
                tamanos="(min-width: 1024px) 720px, 100vw"
                prioridad={i === 0}
              />
            </div>
          ))}
        </div>

        {varias && (
          <>
            <button type="button" onClick={() => ir(actual - 1)} disabled={actual === 0} className={`${flecha} left-4`} aria-label="Foto anterior">
              <IconoAnterior />
            </button>
            <button
              type="button"
              onClick={() => ir(actual + 1)}
              disabled={actual === lista.length - 1}
              className={`${flecha} right-4`}
              aria-label="Foto siguiente"
            >
              <IconoSiguiente />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-3 sm:p-4">
          {varias ? (
            <p className="rounded-full bg-tinta/75 px-3 py-1 text-[0.8rem] font-medium text-white tabular-nums" aria-live="polite">
              Foto {actual + 1} de {lista.length}
            </p>
          ) : (
            <span />
          )}
          {fotos.length > 0 && (
            <button
              type="button"
              onClick={ampliar}
              className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full bg-white/90 px-3.5 text-[0.85rem] font-semibold text-tinta shadow-suave ring-1 ring-tinta/5 transition-colors duration-200 hover:bg-white"
            >
              <IconoAmpliar />
              Ampliar
            </button>
          )}
        </div>
      </div>

      {varias && (
        <ul className="mt-3 flex gap-2.5 px-4 sm:px-0">
          {fotos.map((foto, i) => (
            <li key={foto.ruta}>
              <button
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ver la foto ${i + 1}`}
                aria-current={i === actual ? "true" : undefined}
                className={`relative block h-[4.5rem] w-14 overflow-hidden rounded-[3px] bg-piedra ring-offset-2 ring-offset-papel transition-[opacity,box-shadow] duration-200 ${
                  i === actual ? "ring-1 ring-tinta" : "opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura decorativa del mismo archivo */}
                <img src={urlFoto(foto.ruta)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Vista ampliada. El diálogo nativo atrapa el foco y se cierra con Escape. */}
      <dialog
        ref={dialogo}
        aria-label={`${titulo}: foto ampliada`}
        // Al cerrar, la galería queda en la foto que se estaba mirando.
        onClose={() => pista.current?.scrollTo({ left: ampliada * pista.current.clientWidth })}
        onKeyDown={(e) => {
          if (!varias) return;
          if (e.key === "ArrowLeft") mover(-1);
          if (e.key === "ArrowRight") mover(1);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#111214] p-0 text-white backdrop:bg-black/80 open:flex open:flex-col"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="truncate text-[0.9rem] text-white/80">
            {titulo}
            {varias && <span className="tabular-nums"> · {ampliada + 1} de {lista.length}</span>}
          </p>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[0.9rem] font-semibold text-white hover:bg-white/10"
          >
            <IconoCerrar className="text-lg" />
            Cerrar
          </button>
        </div>
        <div className="relative flex-1">
          {fotos[ampliada] && (
            <FotoObra key={fotos[ampliada].ruta} foto={fotos[ampliada]} ajuste="contener" tamanos="100vw" />
          )}
          {varias && (
            <>
              <button
                type="button"
                onClick={() => mover(-1)}
                className="absolute top-1/2 left-3 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
                aria-label="Foto anterior"
              >
                <IconoAnterior />
              </button>
              <button
                type="button"
                onClick={() => mover(1)}
                className="absolute top-1/2 right-3 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
                aria-label="Foto siguiente"
              >
                <IconoSiguiente />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
