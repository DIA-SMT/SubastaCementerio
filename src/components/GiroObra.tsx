"use client";

import Image from "next/image";
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Foto } from "@/lib/datos/tipos";
import {
  MS_FUNDIDO,
  MS_PULSACION,
  MS_VUELTA_AL_FRENTE,
  UMBRAL_MOVIMIENTO_PX,
  posicionDelGiro,
  soltarGiro,
  tomarGiro,
  vistaIntermedia,
} from "@/lib/giro";
import { FotoObra, urlFoto } from "./FotoObra";

/** Estado de cada foto de la secuencia (la portada se muestra siempre). */
type Carga = "pendiente" | "lista" | "fallida";
/** Foto visible y la que queda debajo mientras aparece; `ms`: fundido distinto del habitual. */
type Vista = { actual: number; anterior: number; ms?: number };
/**
 * Quién hizo girar la obra: el mouse se detiene al salir de la tarjeta; el dedo, al soltar;
 * el botón, al volver a tocarlo.
 */
type Origen = "mouse" | "gesto" | "boton";

const CONSULTA_MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";
const reducirMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia(CONSULTA_MENOS_MOVIMIENTO).matches;
const seguirPreferencia = (avisar: () => void) => {
  const consulta = window.matchMedia(CONSULTA_MENOS_MOVIMIENTO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
};

/**
 * Foto de la tarjeta que gira 360° con las fotos tomadas alrededor de la cabeza.
 *
 * - Con mouse: gira mientras el mouse está sobre la tarjeta y, al salir, vuelve al frente.
 * - Con el dedo: mantener presionada la foto unos 300 ms la hace girar; al soltar se detiene y
 *   queda en ese ángulo. Un toque corto abre la ficha; si el dedo se mueve antes, es scroll.
 * - Cada activación da como mucho MAX_ROTATIONS vueltas, de MS_POR_VUELTA cada una.
 * - Entre foto y foto arma vistas intermedias (ver vistaIntermedia): el giro es continuo.
 * - El botón 360° hace girar la obra sin mouse ni gestos (teclado y lectores de pantalla).
 *   Con "reducir movimiento", ese botón pasa de una vista a la siguiente, sin animación.
 * - Gira una sola obra por vez (ver tomarGiro). Se detiene al cambiar de pestaña o de página.
 * - Las fotos se piden al pasar el mouse o al empezar a presionar, y el giro empieza recién
 *   cuando están todas: nunca muestra una foto a medio cargar.
 */
export function GiroObra({
  cuadros,
  tamanos,
  prioridad,
  etiqueta,
  className = "",
}: {
  cuadros: Foto[];
  tamanos: string;
  prioridad?: boolean;
  /** Para el nombre accesible del botón, por ejemplo "la obra N° 6". */
  etiqueta: string;
  /** Clases de la foto (no del contenedor), por ejemplo el zoom al pasar el mouse. */
  className?: string;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLSpanElement>(null);
  const capas = useRef<(HTMLDivElement | null)[]>([]);
  const [pedidas, setPedidas] = useState(false);
  const [cargas, setCargas] = useState<Carga[]>(() => cuadros.map((_, i) => (i === 0 ? "lista" : "pendiente")));
  const [vista, setVista] = useState<Vista>({ actual: 0, anterior: 0 });
  const [origen, setOrigen] = useState<Origen | null>(null);

  const listas = cargas.every((c) => c !== "pendiente");
  // Una foto que no cargó se saltea: el giro sigue con las demás, sin huecos.
  const secuencia = cargas.flatMap((c, i) => (c === "lista" ? [i] : []));
  const girando = origen !== null;
  const animando = girando && listas && secuencia.length > 1;
  const menosMovimiento = useSyncExternalStore(seguirPreferencia, reducirMovimiento, () => false);

  // Lo que leen los manejadores de eventos sin volver a registrarse en cada render.
  const vistaRef = useRef(vista);
  const secuenciaRef = useRef(secuencia);
  useEffect(() => {
    vistaRef.current = vista;
    secuenciaRef.current = secuencia;
  });

  const pedirFotos = useCallback(() => setPedidas(true), []);

  // Detener: misma función durante toda la vida del componente (la usa el control de giro).
  const [detenerGiro] = useState(() => {
    const detenerEsta = () => {
      soltarGiro(detenerEsta);
      setOrigen(null);
    };
    return detenerEsta;
  });

  const girar = useCallback(
    (desde: Origen) => {
      tomarGiro(detenerGiro);
      setPedidas(true);
      setOrigen(desde);
    },
    [detenerGiro],
  );

  // Con "reducir movimiento": una vista más por cada toque del botón, sin animación.
  const siguienteVista = useCallback(() => {
    setPedidas(true);
    // Si las fotos todavía están llegando, avanza igual: la anterior queda visible debajo hasta
    // que la nueva termina de cargar.
    const sec = secuenciaRef.current.length > 1 ? secuenciaRef.current : cuadros.map((_, i) => i);
    if (sec.length < 2) return;
    const actual = vistaRef.current.actual;
    const siguiente = sec[(sec.indexOf(actual) + 1) % sec.length] ?? 0;
    setVista({ actual: siguiente, anterior: actual });
  }, [cuadros]);

  // Mientras gira: cada cuadro de la pantalla (requestAnimationFrame) dibuja la vista
  // intermedia entre dos fotos, a velocidad constante. Escribe directo en el DOM para no
  // volver a renderizar 60 veces por segundo; React solo se entera de qué foto domina.
  // Antes de pintar (layout effect) ya ubica las capas, para que no se vean todas juntas.
  useLayoutEffect(() => {
    if (!animando) return;
    const sec = secuenciaRef.current;
    const inicio = Math.max(sec.indexOf(vistaRef.current.actual), 0);
    const t0 = performance.now();
    let dominante = sec[inicio];
    let usadas: number[] = [];
    let id = 0;

    const ubicar = (el: HTMLDivElement | null | undefined, x: number, grados: number, opacidad: number, z: number) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = `translateX(${x.toFixed(2)}%) rotateY(${grados.toFixed(2)}deg)`;
      el.style.opacity = String(opacidad);
      el.style.zIndex = String(z);
    };

    const paso = (ahora: number) => {
      const p = posicionDelGiro(ahora - t0, inicio, sec.length);
      const sale = sec[p.desde];
      const entra = sec[p.hacia];
      const v = vistaIntermedia(p.t);
      // Oculta las que se usaron en el cuadro anterior y ya no.
      for (const i of usadas) if (i !== sale && i !== entra) ubicar(capas.current[i], 0, 0, 0, 0);
      ubicar(capas.current[sale], v.sale.x, v.sale.grados, 1, 1);
      ubicar(capas.current[entra], v.entra.x, v.entra.grados, p.terminado ? 0 : v.entra.opacidad, 2);
      usadas = [sale, entra];
      barra.current?.style.setProperty("transform", `scaleX(${p.progreso})`);

      const ahoraDomina = v.entra.opacidad >= 0.5 && !p.terminado ? entra : sale;
      if (ahoraDomina !== dominante) {
        const anterior = dominante;
        dominante = ahoraDomina;
        setVista({ actual: ahoraDomina, anterior });
      }
      if (p.terminado) detenerGiro();
      else id = requestAnimationFrame(paso);
    };
    paso(performance.now());

    const lista = capas.current;
    return () => {
      cancelAnimationFrame(id);
      // Devuelve las fotos a su lugar con una transición corta; React vuelve a fijar el resto.
      for (const el of lista) {
        if (!el) continue;
        el.style.transition = `transform ${MS_FUNDIDO * 2}ms ease-out, opacity ${MS_FUNDIDO}ms linear`;
        el.style.transform = "";
      }
    };
  }, [animando, detenerGiro]);

  // Mouse y dedo. Se escucha en la tarjeta entera porque el enlace de la ficha la cubre por
  // encima; las pulsaciones solo cuentan si caen dentro de la foto.
  useEffect(() => {
    const foto = raiz.current;
    const tarjeta = foto?.closest("article");
    if (!foto || !tarjeta) return;

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let precarga: ReturnType<typeof setTimeout> | undefined;
    let puntero: { id: number; x: number; y: number } | null = null;
    let activo = false; // la pulsación prolongada ya hizo girar la obra
    let evitarClic = false; // el clic que sigue a una pulsación prolongada no abre la ficha

    const cancelarEspera = () => {
      clearTimeout(temporizador);
      clearTimeout(precarga);
      temporizador = undefined;
    };
    const terminarGesto = () => {
      cancelarEspera();
      if (activo) detenerGiro();
      activo = false;
      puntero = null;
      tarjeta.style.removeProperty("user-select");
    };

    // Mouse: gira al entrar a la tarjeta y, al salir, se detiene y vuelve al frente.
    const entrar = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setPedidas(true);
      if (!reducirMovimiento()) girar("mouse");
    };
    const salir = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reducirMovimiento()) return;
      detenerGiro();
      setVista((v) => (v.actual === 0 ? v : { actual: 0, anterior: v.actual, ms: MS_VUELTA_AL_FRENTE }));
    };

    // Dedo: pulsación prolongada.
    const presionar = (e: PointerEvent) => {
      evitarClic = false;
      if (!e.isPrimary || e.pointerType === "mouse" || reducirMovimiento()) return;
      if ((e.target as Element).closest("[data-giro-boton]")) return;
      const r = foto.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      terminarGesto();
      // Aprovecha la espera para pedir las fotos, pero no enseguida: un dedo que arranca a
      // hacer scroll se mueve antes, y así deslizar por el catálogo no descarga los giros.
      precarga = setTimeout(() => setPedidas(true), MS_PULSACION / 3);
      puntero = { id: e.pointerId, x: e.clientX, y: e.clientY };
      temporizador = setTimeout(() => {
        temporizador = undefined;
        if (!puntero) return;
        activo = true;
        evitarClic = true;
        tarjeta.style.setProperty("user-select", "none");
        // Captura el puntero: si el dedo sale de la tarjeta, el soltar igual llega acá.
        try {
          tarjeta.setPointerCapture(puntero.id);
        } catch {
          // El puntero ya no existe: se soltó justo ahora.
        }
        girar("gesto");
      }, MS_PULSACION);
    };
    const mover = (e: PointerEvent) => {
      if (!puntero || e.pointerId !== puntero.id || !temporizador) return;
      if (Math.hypot(e.clientX - puntero.x, e.clientY - puntero.y) > UMBRAL_MOVIMIENTO_PX) terminarGesto();
    };
    const soltar = (e: PointerEvent) => {
      if (puntero && e.pointerId === puntero.id) terminarGesto();
    };
    // Solo cuenta si la tarjeta pierde la captura que tomó: al tomarla, el enlace pierde la suya
    // (con el dedo, el navegador se la da al elemento tocado) y ese aviso también llega acá.
    const perderCaptura = (e: PointerEvent) => {
      if (e.target === tarjeta) soltar(e);
    };
    // Después de una pulsación prolongada, soltar no abre la ficha.
    const clic = (e: MouseEvent) => {
      if (!evitarClic) return;
      evitarClic = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // Durante la pulsación: sin menú contextual, sin arrastrar el enlace y sin scroll.
    const bloquear = (e: Event) => {
      if (temporizador || activo) e.preventDefault();
    };
    const bloquearScroll = (e: TouchEvent) => {
      if (activo && e.cancelable) e.preventDefault();
    };
    const alOcultar = () => {
      if (document.visibilityState === "hidden") {
        terminarGesto();
        detenerGiro();
      }
    };
    const alSalir = () => {
      terminarGesto();
      detenerGiro();
    };

    const escuchas: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [tarjeta, "pointerenter", entrar as EventListener],
      [tarjeta, "pointerleave", salir as EventListener],
      [tarjeta, "pointerdown", presionar as EventListener],
      [tarjeta, "pointermove", mover as EventListener],
      [tarjeta, "pointerup", soltar as EventListener],
      [tarjeta, "pointercancel", soltar as EventListener],
      [tarjeta, "lostpointercapture", perderCaptura as EventListener],
      [tarjeta, "click", clic as EventListener, { capture: true }],
      [tarjeta, "contextmenu", bloquear],
      [tarjeta, "dragstart", bloquear],
      [tarjeta, "selectstart", bloquear],
      [tarjeta, "touchmove", bloquearScroll as EventListener, { passive: false }],
      [document, "visibilitychange", alOcultar],
      [window, "pagehide", alSalir],
    ];
    for (const [donde, tipo, fn, op] of escuchas) donde.addEventListener(tipo, fn, op);
    return () => {
      for (const [donde, tipo, fn, op] of escuchas) donde.removeEventListener(tipo, fn, op);
      // Al desmontar (o al ocultarse la página con la navegación) no queda nada girando.
      terminarGesto();
      detenerGiro();
    };
  }, [girar, detenerGiro]);

  const alBoton = () => {
    if (reducirMovimiento()) siguienteVista();
    else if (girando) detenerGiro();
    else girar("boton");
  };

  const marcarCarga = (i: number, estado: Carga) =>
    setCargas((c) => (c[i] === estado ? c : c.map((x, j) => (j === i ? estado : x))));

  // Quieta: la foto visible encima (con fundido), la anterior debajo hasta que termina, el resto
  // oculto. Mientras gira, el efecto de arriba maneja las capas y React no las toca.
  const capa = (i: number): CSSProperties =>
    animando
      ? {}
      : i === vista.actual
        ? {
            opacity: 1,
            zIndex: 2,
            transition: `opacity ${vista.ms ?? MS_FUNDIDO}ms ${vista.ms ? "ease-out" : "linear"}, transform ${MS_FUNDIDO * 2}ms ease-out`,
          }
        : i === vista.anterior
          ? { opacity: 1, zIndex: 1 }
          : { opacity: 0, zIndex: 0 };

  const cargando = girando && !listas;
  const posicion = vista.actual + 1;

  return (
    <div ref={raiz} className="absolute inset-0 select-none">
      {/* isolate: el orden de las fotos (z-index) queda adentro y el enlace de la tarjeta sigue
          encima, así un toque en la foto abre la ficha aunque el mouse no haya pasado antes.
          La perspectiva da profundidad al giro de las vistas intermedias. */}
      <div className={`absolute inset-0 isolate [perspective:1100px] ${className}`}>
        <div
          ref={(el) => {
            capas.current[0] = el;
          }}
          className="absolute inset-0 will-change-transform"
          style={capa(0)}
        >
          <FotoObra foto={cuadros[0]} ajuste="contener" tamanos={tamanos} prioridad={prioridad} />
        </div>
        {pedidas &&
          cuadros.slice(1).map((foto, j) => (
            <div
              key={foto.ruta}
              ref={(el) => {
                capas.current[j + 1] = el;
              }}
              aria-hidden
              className="absolute inset-0 will-change-transform"
              style={capa(j + 1)}
            >
              <Image
                src={urlFoto(foto.ruta)}
                alt=""
                fill
                sizes={tamanos}
                loading="eager"
                decoding="async"
                draggable={false}
                onLoad={() => marcarCarga(j + 1, "lista")}
                onError={() => marcarCarga(j + 1, "fallida")}
                className="object-contain"
              />
            </div>
          ))}
      </div>

      {/* Progreso de las vueltas, arriba de la foto, solo mientras gira. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-smt/15 transition-opacity duration-200 ${animando ? "opacity-100" : "opacity-0"}`}
      >
        <span ref={barra} className="block h-full origin-left scale-x-0 bg-smt" />
      </span>

      <button
        type="button"
        data-giro-boton
        onClick={alBoton}
        onFocus={pedirFotos}
        aria-pressed={girando}
        aria-label={
          menosMovimiento
            ? `Ver otra vista de ${etiqueta} (${posicion} de ${cuadros.length})`
            : girando
              ? `Detener el giro de ${etiqueta}`
              : `Girar 360° ${etiqueta}`
        }
        title={menosMovimiento ? "Ver otra vista" : girando ? "Detener el giro" : "Girar 360°"}
        className={`absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.08em] shadow-suave backdrop-blur-sm transition-colors duration-200 before:absolute before:-inset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${girando ? "bg-smt text-white" : "bg-white/85 text-tinta hover:bg-white"} ${cargando ? "animate-pulse" : ""}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3 w-3 ${animando ? "animate-spin [animation-duration:1.6s]" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
          <path d="M12.2 1.8v2.6H9.6" />
        </svg>
        360°
      </button>

      {/* Solo en pantallas táctiles, mientras está quieta: cómo hacerla girar. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-2 left-1/2 z-10 hidden max-w-[calc(100%-1rem)] -translate-x-1/2 truncate rounded-full bg-white/85 px-2 py-0.5 text-[0.65rem] font-medium whitespace-nowrap text-tinta shadow-suave backdrop-blur-sm transition-opacity duration-200 motion-reduce:!hidden [@media(hover:none)]:block ${girando ? "opacity-0" : "opacity-100"}`}
      >
        {/* En la tarjeta angosta (grilla de dos columnas del celular), la versión corta. */}
        <span className="@min-[15rem]:hidden">Mantené para girar</span>
        <span className="hidden @min-[15rem]:inline">Mantené presionado para girar</span>
      </span>
    </div>
  );
}
