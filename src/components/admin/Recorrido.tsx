"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { IconoAyuda } from "@/components/Iconos";
import { recorridoPara, type Paso, type Recorrido } from "./recorridos";

// Recorrido guiado del panel. Resalta un elemento por paso (selector CSS) y muestra al lado una
// tarjeta con el texto. Si el elemento no está a la vista (por ejemplo, el menú lateral en el
// celular), la tarjeta va centrada; los pasos marcados como `soloConElemento` se saltean.
// Se maneja con el teclado: flechas, Tab dentro de la tarjeta y Escape para salir.

const CLAVE_VISTO = "panel:recorrido-general-visto";
const MARGEN = 8; // aire alrededor del elemento resaltado (px)
const SEPARACION = 14; // entre el elemento y la tarjeta (px)

const leerVisto = () => {
  try {
    return localStorage.getItem(CLAVE_VISTO) === "1";
  } catch {
    return true; // sin almacenamiento, no se ofrece solo (se puede abrir con el botón)
  }
};
const guardarVisto = () => {
  try {
    localStorage.setItem(CLAVE_VISTO, "1");
  } catch {}
};

/** Primer elemento visible que coincide con el selector (el menú lateral existe dos veces). */
function buscar(selector?: string): HTMLElement | null {
  if (!selector) return null;
  let candidatos: HTMLElement[];
  try {
    candidatos = [...document.querySelectorAll<HTMLElement>(selector)];
  } catch {
    return null;
  }
  return candidatos.find((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0) ?? null;
}

const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Rect = { top: number; left: number; width: number; height: number };

/** Botón del encabezado ("Cómo se usa") y el recorrido de la pantalla actual. */
export function GuiaPanel() {
  const ruta = usePathname();
  const [activo, setActivo] = useState<{
    recorrido: Recorrido;
    pasos: Paso[];
  } | null>(null);
  const [indice, setIndice] = useState(0);
  const boton = useRef<HTMLButtonElement>(null);

  const empezar = useCallback((recorrido: Recorrido) => {
    // Pasos que dependen de un elemento que no está a la vista (por ejemplo, en el celular): afuera.
    const pasos = recorrido.pasos.filter((p) => !p.soloConElemento || buscar(p.elemento));
    if (pasos.length === 0) return;
    setIndice(0);
    setActivo({ recorrido, pasos });
  }, []);

  const terminar = useCallback(() => {
    if (activo?.recorrido.clave === "general") guardarVisto();
    setActivo(null);
    boton.current?.focus();
  }, [activo]);

  // La primera vez que alguien entra al tablero desde este navegador, el recorrido general
  // arranca solo (con una pausa breve para que la página termine de mostrarse).
  useEffect(() => {
    if (ruta !== "/admin" || leerVisto()) return;
    const espera = window.setTimeout(() => empezar(recorridoPara("/admin")), 700);
    return () => window.clearTimeout(espera);
  }, [ruta, empezar]);

  // Al cambiar de pantalla, el recorrido que estaba abierto ya no corresponde.
  const rutaAnterior = useRef(ruta);
  useEffect(() => {
    if (rutaAnterior.current !== ruta) setActivo(null);
    rutaAnterior.current = ruta;
  }, [ruta]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => empezar(recorridoPara(ruta))}
        data-recorrido="ayuda"
        className="inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 text-[0.94rem] font-medium text-gris transition-colors duration-200 hover:text-tinta"
      >
        <IconoAyuda className="text-[1.15rem]" />
        <span className="max-sm:sr-only">Cómo se usa</span>
      </button>
      {activo && (
        <TarjetaRecorrido
          recorrido={activo.recorrido}
          pasos={activo.pasos}
          indice={indice}
          irA={setIndice}
          terminar={terminar}
        />
      )}
    </>
  );
}

/**
 * Velo con un hueco sobre el elemento: cuatro paneles alrededor (una sombra gigante no se
 * dibuja en todos los navegadores) y un marco en oro.
 */
function Foco({ rect }: { rect: Rect }) {
  const top = rect.top - MARGEN;
  const left = rect.left - MARGEN;
  const ancho = rect.width + MARGEN * 2;
  const alto = rect.height + MARGEN * 2;
  const panel = "pointer-events-none absolute bg-noche/55";
  return (
    <div aria-hidden>
      <div className={`${panel} inset-x-0 top-0`} style={{ height: Math.max(0, top) }} />
      <div className={`${panel} inset-x-0 bottom-0`} style={{ top: top + alto }} />
      <div className={`${panel} left-0`} style={{ top, height: alto, width: Math.max(0, left) }} />
      <div className={`${panel} right-0`} style={{ top, height: alto, left: left + ancho }} />
      <div
        className="pointer-events-none absolute rounded-lg outline-2 outline-oro outline-solid"
        style={{ top, left, width: ancho, height: alto }}
      />
    </div>
  );
}

function TarjetaRecorrido({
  recorrido,
  pasos,
  indice,
  irA,
  terminar,
}: {
  recorrido: Recorrido;
  pasos: Paso[];
  indice: number;
  irA: (i: number) => void;
  terminar: () => void;
}) {
  const id = useId();
  const paso = pasos[indice];
  const ultimo = indice === pasos.length - 1;
  const [rect, setRect] = useState<Rect | null>(null);
  const [tarjeta, setTarjeta] = useState<{ top: number; left: number } | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Lleva el elemento a la vista y sigue su posición mientras se desplaza o cambia el tamaño.
  useLayoutEffect(() => {
    const el = buscar(paso.elemento);
    if (el)
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: movimientoReducido() ? "auto" : "smooth",
      });
    let cuadro = 0;
    const medir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const r = el?.getBoundingClientRect();
        setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
      });
    };
    medir();
    // Durante el desplazamiento suave, la posición cambia: se vuelve a medir un rato.
    const repetir = window.setInterval(medir, 120);
    const corte = window.setTimeout(() => window.clearInterval(repetir), 900);
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearInterval(repetir);
      window.clearTimeout(corte);
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [paso]);

  // Ubica la tarjeta: debajo del elemento si entra, si no arriba; sin elemento, centrada.
  useLayoutEffect(() => {
    const c = caja.current;
    if (!c) return;
    const ancho = c.offsetWidth;
    const alto = c.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setTarjeta({
        top: Math.max(16, (vh - alto) / 2),
        left: Math.max(16, (vw - ancho) / 2),
      });
      return;
    }
    // Elemento angosto con lugar a su derecha (el menú lateral): la tarjeta va al costado.
    const derecha = rect.left + rect.width + MARGEN + SEPARACION;
    if (rect.width < 320 && derecha + ancho <= vw - 16) {
      setTarjeta({ top: Math.min(Math.max(16, rect.top - MARGEN), vh - alto - 16), left: derecha });
      return;
    }
    const abajo = rect.top + rect.height + MARGEN + SEPARACION;
    const arriba = rect.top - MARGEN - SEPARACION - alto;
    // Elemento muy alto (una tabla, un formulario) o sin lugar arriba ni abajo: la tarjeta va
    // a la esquina inferior derecha, encima de una parte del elemento resaltado.
    if (rect.height > vh * 0.6 || (abajo + alto > vh - 16 && arriba < 16)) {
      setTarjeta({ top: Math.max(16, vh - alto - 16), left: Math.max(16, vw - ancho - 16) });
      return;
    }
    const top = abajo + alto <= vh - 16 ? abajo : arriba;
    const left = Math.min(Math.max(16, rect.left), vw - ancho - 16);
    setTarjeta({ top, left: Math.max(16, left) });
  }, [rect, indice]);

  // Cada paso nuevo se anuncia: el foco va al título de la tarjeta.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, [indice]);

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      terminar();
    } else if (e.key === "ArrowRight" && !ultimo) {
      irA(indice + 1);
    } else if (e.key === "ArrowLeft" && indice > 0) {
      irA(indice - 1);
    } else if (e.key === "Tab") {
      // El foco queda dentro de la tarjeta mientras el recorrido está abierto.
      const enfocables = [...(caja.current?.querySelectorAll<HTMLElement>("button") ?? [])];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const final = enfocables[enfocables.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === titulo.current)) {
        e.preventDefault();
        final.focus();
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault();
        primero.focus();
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" onKeyDown={alTeclear}>
      {/* Velo: bloquea el resto de la página mientras dura el recorrido (los clics no pasan). */}
      <div aria-hidden className="absolute inset-0" />
      {rect ? <Foco rect={rect} /> : <div aria-hidden className="absolute inset-0 bg-noche/55" />}

      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        className="absolute w-[min(23rem,calc(100vw-2rem))] rounded-lg bg-white p-5 text-texto shadow-elevada ring-1 ring-linea"
        style={tarjeta ?? { top: -9999, left: -9999 }}
      >
        <p className="flex items-center justify-between gap-3 text-[0.8rem] font-semibold tracking-[0.08em] text-dorado uppercase">
          <span>{recorrido.nombre}</span>
          <span className="tabular-nums" aria-label={`Paso ${indice + 1} de ${pasos.length}`}>
            {indice + 1} / {pasos.length}
          </span>
        </p>
        <h2
          ref={titulo}
          id={`${id}-titulo`}
          tabIndex={-1}
          data-recorrido-titulo
          className="mt-2 text-xl leading-snug text-tinta"
        >
          {paso.titulo}
        </h2>
        <p id={`${id}-texto`} className="mt-2 text-base">
          {paso.texto}
        </p>

        {/* Progreso: un punto por paso. */}
        <div aria-hidden className="mt-4 flex flex-wrap gap-1">
          {pasos.map((p, i) => (
            <span key={p.titulo} className={`h-1.5 rounded-full ${i === indice ? "w-5 bg-oro" : "w-1.5 bg-linea"}`} />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={terminar}
            className="text-[0.94rem] font-medium text-gris underline-offset-4 hover:text-tinta hover:underline"
          >
            {ultimo ? "Cerrar" : "Salir del recorrido"}
          </button>
          <div className="flex gap-2">
            {indice > 0 && (
              <button type="button" onClick={() => irA(indice - 1)} className="boton-secundario min-h-10 px-4">
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? terminar() : irA(indice + 1))}
              className="boton-primario min-h-10 px-4"
            >
              {ultimo ? "Terminar" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
