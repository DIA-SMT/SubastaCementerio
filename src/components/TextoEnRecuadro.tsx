"use client";

import { useId, useRef, type ReactNode } from "react";
import { IconoCerrar } from "./Iconos";

/**
 * Enlace a un texto (bases, privacidad) que se abre en un recuadro sobre la página, sin salir
 * del formulario. El diálogo nativo atrapa el foco, se cierra con Escape y lo devuelve al
 * enlace. Con `alAceptar`, el pie trae «Leí y acepto», que marca la casilla correspondiente.
 */
export function TextoEnRecuadro({
  etiqueta,
  titulo,
  href,
  alAceptar,
  children,
}: {
  /** Texto del enlace dentro de la oración. */
  etiqueta: string;
  titulo: string;
  /** Página completa del texto, para abrirla aparte si hace falta. */
  href: string;
  alAceptar?: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-haspopup="dialog"
        className="enlace cursor-pointer text-left"
      >
        {etiqueta}
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={`${id}-titulo`}
        // Un clic en el fondo (fuera del recuadro) también lo cierra.
        onClick={(e) => {
          if (e.target === e.currentTarget) cerrar();
        }}
        className="m-auto max-h-[min(85dvh,46rem)] w-[min(42rem,calc(100vw-2rem))] max-w-none flex-col overflow-hidden rounded-lg bg-white p-0 text-base text-texto shadow-elevada backdrop:bg-marino/55 open:flex"
      >
        <div className="flex items-center justify-between gap-4 border-b border-linea px-5 py-4 md:px-6">
          <h2 id={`${id}-titulo`} className="font-display text-[1.35rem] leading-tight font-semibold text-tinta">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-gris transition-colors duration-200 hover:bg-superficie hover:text-tinta"
          >
            <IconoCerrar />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6 md:px-6">{children}</div>
        <div className="flex flex-col-reverse gap-3 border-t border-linea px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <a href={href} target="_blank" className="enlace-sutil text-[0.94rem]">
            Abrir en otra pestaña
          </a>
          {alAceptar ? (
            <button
              type="button"
              onClick={() => {
                alAceptar();
                cerrar();
              }}
              className="boton-primario"
            >
              Leí y acepto
            </button>
          ) : (
            <button type="button" onClick={cerrar} className="boton-primario">
              Cerrar
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
