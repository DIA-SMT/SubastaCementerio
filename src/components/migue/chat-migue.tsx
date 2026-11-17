"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconoCerrar, IconoEnviar, IconoIrA, IconoReintentar } from "@/components/Iconos";
import type { EnlaceMigue } from "@/lib/migue/enlaces";
import { ESTILO_SOBRE_LA_BARRA, useBurbujaMovible } from "./burbuja-movible";
import { CuerpoMigue, RetratoMigue } from "./retrato-migue";
import { TextoMigue } from "./texto-migue";

/**
 * El chat de Migue (núcleo de Migue, CementerIA src/components/migue/chat-migue.tsx, con la
 * estética de la Subasta): la burbuja flotante abajo a la derecha, que se puede arrastrar, y el
 * panel de unos 390 × 580 px.
 *
 * - **No modal**: no tapa la página ni atrapa el foco; se puede seguir mirando el catálogo.
 *   Esc lo cierra y el foco vuelve a la burbuja; al abrirlo va al campo de la pregunta.
 * - **Accesible**: el historial es una región viva (`aria-live="polite"`), el "Migue está
 *   escribiendo" es un `role="status"`, el error un `role="alert"` con "Reintentar". Con
 *   movimiento reducido, sin animación.
 * - La cabecera, en azul noche municipal con el filete del isologo; el cuerpo, en papel.
 * - La conversación vive en el layout: sobrevive al cambio de página. No se guarda en ningún lado.
 */

export interface MensajeChat {
  rol: "usuario" | "migue";
  texto: string;
  enlaces?: EnlaceMigue[];
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul";

export function ChatMigue({
  endpoint,
  clavePosicion,
  subtitulo,
  bienvenida,
  sugerencias,
  maximo,
}: {
  endpoint: string;
  /** Dónde guarda el navegador la posición de la burbuja. */
  clavePosicion: string;
  subtitulo: string;
  bienvenida: ReactNode;
  sugerencias: readonly string[];
  /** El largo máximo de la pregunta (src/lib/migue/limites.ts). */
  maximo: number;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorUltima, setErrorUltima] = useState<string | null>(null);
  const burbuja = useBurbujaMovible(clavePosicion);
  const botonRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  // Lo nuevo, a la vista: una respuesta de Migue se muestra desde la pregunta que la pidió (así
  // no queda cortada arriba); lo demás, el fondo de la lista.
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const ultima = mensajes.at(-1);
    const burbujas = lista.querySelectorAll<HTMLElement>("[data-mensaje]");
    const elemento = burbujas[burbujas.length - 2] ?? burbujas[burbujas.length - 1];
    if (ultima?.rol === "migue" && !cargando && errorUltima === null && elemento) {
      lista.scrollTo({ top: Math.max(0, elemento.getBoundingClientRect().top - lista.getBoundingClientRect().top + lista.scrollTop - 12) });
    } else {
      lista.scrollTo({ top: lista.scrollHeight });
    }
  }, [mensajes, cargando, errorUltima]);

  // Al abrir, el foco va al campo (después de pintar: el panel recién deja de estar oculto).
  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => campoRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [abierto]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    window.setTimeout(() => botonRef.current?.focus(), 0);
  }, []);

  const enviar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.replace(/\s+/g, " ").trim();
      if (!limpia || cargando) return;
      setErrorUltima(null);
      setTexto("");
      // Los turnos anteriores, sin el actual (que va en `pregunta`).
      const historial = mensajes.slice(-8).map((m) => ({ rol: m.rol, texto: m.texto }));
      setMensajes((prev) => [...prev, { rol: "usuario", texto: limpia }]);
      setCargando(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pregunta: limpia, historial }),
        });
        const datos = (await res.json().catch(() => null)) as { respuesta?: string; enlaces?: EnlaceMigue[]; error?: string } | null;
        if (res.status === 400 && datos?.error) {
          setMensajes((prev) => [...prev, { rol: "migue", texto: datos.error ?? "" }]);
          return;
        }
        if (!res.ok || typeof datos?.respuesta !== "string") throw new Error(String(res.status));
        setMensajes((prev) => [
          ...prev,
          { rol: "migue", texto: datos.respuesta ?? "", enlaces: Array.isArray(datos.enlaces) ? datos.enlaces.slice(0, 3) : [] },
        ]);
      } catch {
        setErrorUltima(limpia);
      } finally {
        setCargando(false);
        campoRef.current?.focus();
      }
    },
    [cargando, endpoint, mensajes],
  );

  const hechas = new Set(mensajes.filter((m) => m.rol === "usuario").map((m) => m.texto));
  const pendientes = sugerencias.filter((s) => !hechas.has(s));
  const mostrarSugerencias = !cargando && mensajes.length === 0 && pendientes.length > 0;
  const claseEnlace = `inline-flex min-h-8 items-center gap-1 rounded-md border border-linea bg-white px-2.5 text-[0.8125rem] font-semibold text-smt-intenso transition-colors hover:border-smt hover:bg-smt-suave ${FOCO}`;

  return (
    <div data-migue="" className="print:hidden">
      {!abierto ? (
        <button
          ref={botonRef}
          type="button"
          aria-label="Abrir el chat con Migue, el asistente de la Subasta solidaria"
          aria-expanded={false}
          aria-controls={`${id}-panel`}
          title="Tocá para preguntar; arrastrá para moverla"
          style={burbuja.style}
          {...burbuja.handlers}
          onClick={(e) => {
            burbuja.handlers.onClick(e);
            if (!e.defaultPrevented) setAbierto(true);
          }}
          className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-marino text-white shadow-elevada ring-2 ring-white/80 transition-[background-color,transform] duration-150 hover:bg-marino-claro active:scale-95 sm:h-auto sm:w-auto sm:gap-2.5 sm:py-1.5 sm:pr-4 sm:pl-1.5 ${FOCO}`}
        >
          <RetratoMigue prioridad className="h-11 w-11 ring-2 ring-amarillo/80" />
          <span className="hidden text-sm font-semibold sm:inline">Preguntale a Migue</span>
        </button>
      ) : null}

      <section
        id={`${id}-panel`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-subtitulo`}
        inert={!abierto}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            cerrar();
          }
        }}
        style={{ transformOrigin: "bottom right", ...ESTILO_SOBRE_LA_BARRA }}
        className={`fixed right-4 z-50 flex h-[min(580px,calc(100dvh-2rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-linea bg-papel text-texto shadow-elevada transition-[opacity,transform,visibility] duration-200 ease-suave motion-reduce:transition-none ${
          abierto ? "visible translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible translate-y-2 scale-95 opacity-0"
        }`}
      >
        <header className="relative flex items-center gap-3 bg-marino px-4 py-3 text-white">
          <RetratoMigue className="h-10 w-10 ring-2 ring-white/30" />
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-titulo`} className="font-display text-base leading-tight font-semibold">
              Migue
            </h2>
            <p id={`${id}-subtitulo`} className="truncate text-xs text-marino-tenue">
              {subtitulo}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar el chat con Migue"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-marino-claro hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amarillo"
          >
            <IconoCerrar className="text-xl" />
          </button>
          {/* El filete del isologo: azul, celeste y amarillo. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,var(--color-smt)_0_46%,var(--color-celeste)_46%_78%,var(--color-amarillo)_78%)]"
          />
        </header>

        <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {mensajes.length === 0 ? (
            <div className="flex items-end gap-3">
              <CuerpoMigue className="h-36 w-auto" />
              <div className="mb-2 flex-1 text-[0.9375rem] leading-relaxed text-tinta">{bienvenida}</div>
            </div>
          ) : null}

          {mensajes.map((m, i) => (
            <div
              key={i}
              data-mensaje=""
              className={`max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                m.rol === "usuario" ? "ml-auto bg-smt text-white" : "mr-auto border border-linea bg-white text-tinta shadow-suave"
              }`}
            >
              <span className="sr-only">{m.rol === "migue" ? "Migue: " : "Vos: "}</span>
              {/* Lo de Migue, con su formato (negritas, listas); lo de la persona, tal cual lo escribió. */}
              {m.rol === "migue" ? <TextoMigue texto={m.texto} /> : <p className="whitespace-pre-wrap">{m.texto}</p>}
              {m.enlaces?.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {m.enlaces.map((e) => (
                    <li key={e.href}>
                      {e.href.startsWith("/") ? (
                        <Link href={e.href} className={claseEnlace}>
                          {e.etiqueta}
                          <IconoIrA className="text-[0.95rem]" />
                        </Link>
                      ) : (
                        <a href={e.href} target="_blank" rel="noopener noreferrer" className={claseEnlace}>
                          {e.etiqueta}
                          <span className="sr-only"> (se abre en otra pestaña)</span>
                          <IconoIrA className="text-[0.95rem]" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {cargando ? (
            <p role="status" className="mr-auto flex items-center gap-1.5 rounded-lg border border-linea bg-white px-3.5 py-3 text-gris">
              <span className="sr-only">Migue está escribiendo</span>
              <span aria-hidden className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms] motion-reduce:animate-none" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms] motion-reduce:animate-none" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms] motion-reduce:animate-none" />
              </span>
            </p>
          ) : null}

          {errorUltima !== null ? (
            <div role="alert" className="mr-auto max-w-[88%] rounded-lg border border-rojo/30 bg-rojo-suave px-3.5 py-2.5 text-sm text-rojo">
              <p>No pude responder por un problema de conexión.</p>
              <button
                type="button"
                onClick={() => {
                  setMensajes((prev) => prev.slice(0, -1));
                  void enviar(errorUltima);
                }}
                className={`mt-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-2 ${FOCO}`}
              >
                <IconoReintentar className="text-[0.95rem]" />
                Reintentar
              </button>
            </div>
          ) : null}

          {mostrarSugerencias ? (
            <section aria-label="Preguntas sugeridas" className="pt-1">
              <ul className="grid gap-2">
                {pendientes.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => void enviar(s)}
                      className={`w-full rounded-md border border-linea bg-white px-3.5 py-2.5 text-left text-sm text-tinta transition-colors duration-150 hover:border-smt hover:bg-smt-suave ${FOCO}`}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <form
          className="flex items-end gap-2 border-t border-linea bg-superficie px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(texto);
          }}
        >
          <label htmlFor={`${id}-campo`} className="sr-only">
            Escribí tu pregunta para Migue
          </label>
          <textarea
            id={`${id}-campo`}
            ref={campoRef}
            rows={1}
            value={texto}
            maxLength={maximo}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envía; Shift+Enter, otra línea.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void enviar(texto);
              }
            }}
            placeholder="Escribí tu pregunta…"
            autoComplete="off"
            className={`max-h-28 min-h-10 flex-1 resize-none rounded-md border border-gris-suave bg-white px-3 py-2 text-sm text-tinta placeholder:text-gris ${FOCO}`}
          />
          <button
            type="submit"
            disabled={cargando || texto.trim() === ""}
            aria-label="Enviar la pregunta"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-smt text-white transition-colors hover:bg-smt-intenso disabled:opacity-40 ${FOCO}`}
          >
            <IconoEnviar className="text-lg" />
          </button>
        </form>
      </section>
    </div>
  );
}
