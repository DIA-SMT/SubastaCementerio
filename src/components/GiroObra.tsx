"use client";

import Image from "next/image";
import { type CSSProperties, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Foto } from "@/lib/datos/tipos";
import {
  MS_PULSACION,
  UMBRAL_MOVIMIENTO_PX,
  msFundido,
  posicionDelGiro,
  soltarGiro,
  tomarGiro,
} from "@/lib/giro";
import { FotoObra, urlFoto } from "./FotoObra";

/** Estado de cada foto de la secuencia (la portada se muestra siempre). */
type Carga = "pendiente" | "lista" | "fallida";
/** Foto visible y la que queda debajo mientras aparece la nueva. */
type Vista = { actual: number; anterior: number };
/** Quién hizo girar la obra: el gesto se detiene al soltar; el botón, al volver a tocarlo. */
type Origen = "gesto" | "boton";

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
 * - Mantener presionada la foto (dedo o clic izquierdo) unos 300 ms la hace girar; al soltar se
 *   detiene y queda en ese ángulo. Gira como mucho MAX_ROTATIONS vueltas por pulsación.
 * - Un toque corto sigue abriendo la ficha. Si el dedo se mueve antes de activarse, es scroll.
 * - El botón 360° hace lo mismo sin mantener presionado (teclado y lectores de pantalla).
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
  const [pedidas, setPedidas] = useState(false);
  const [cargas, setCargas] = useState<Carga[]>(() => cuadros.map((_, i) => (i === 0 ? "lista" : "pendiente")));
  const [vista, setVista] = useState<Vista>({ actual: 0, anterior: 0 });
  const [origen, setOrigen] = useState<Origen | null>(null);

  const listas = cargas.every((c) => c !== "pendiente");
  // Una foto que no cargó se saltea: el giro sigue con las demás, sin huecos.
  const secuencia = cargas.flatMap((c, i) => (c === "lista" ? [i] : []));
  const girando = origen !== null;
  const fundido = msFundido(secuencia.length);
  const menosMovimiento = useSyncExternalStore(seguirPreferencia, reducirMovimiento, () => false);
  const posicion = vista.actual + 1;

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

  const girar = useCallback((desde: Origen) => {
    tomarGiro(detenerGiro);
    setPedidas(true);
    setOrigen(desde);
  }, [detenerGiro]);

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

  // Mientras gira: avanza con requestAnimationFrame a ritmo constante (la vuelta dura lo mismo
  // con 8 o con 36 fotos) y se detiene sola al completar las vueltas.
  useEffect(() => {
    if (!girando || !listas) return;
    const sec = secuenciaRef.current;
    if (sec.length < 2) {
      detenerGiro();
      return;
    }
    const inicio = Math.max(sec.indexOf(vistaRef.current.actual), 0);
    let ultimo = -1;
    // El tiempo corre desde la activación (no desde el primer cuadro dibujado): si el navegador
    // demora los cuadros, el giro no se estira.
    const t0 = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const p = posicionDelGiro(ahora - t0, inicio, sec.length);
      if (p.pasos !== ultimo) {
        ultimo = p.pasos;
        const cuadro = sec[p.cuadro];
        setVista((v) => (v.actual === cuadro ? v : { actual: cuadro, anterior: v.actual }));
        barra.current?.style.setProperty("transform", `scaleX(${p.progreso})`);
      }
      if (p.terminado) detenerGiro();
      else id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [girando, listas, detenerGiro]);

  // Pulsación prolongada sobre la foto. Se escucha en la tarjeta entera porque el enlace de la
  // ficha la cubre por encima; solo cuentan las pulsaciones que caen dentro de la foto.
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

    const presionar = (e: PointerEvent) => {
      evitarClic = false;
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0) || reducirMovimiento()) return;
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
        // Captura el puntero: si se arrastra fuera de la tarjeta, el soltar igual llega acá.
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
    const precargar = (e: PointerEvent) => {
      if (e.pointerType === "mouse") setPedidas(true);
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

    tarjeta.addEventListener("pointerenter", precargar);
    tarjeta.addEventListener("pointerdown", presionar);
    tarjeta.addEventListener("pointermove", mover);
    tarjeta.addEventListener("pointerup", soltar);
    tarjeta.addEventListener("pointercancel", soltar);
    tarjeta.addEventListener("lostpointercapture", perderCaptura);
    tarjeta.addEventListener("click", clic, true);
    tarjeta.addEventListener("contextmenu", bloquear);
    tarjeta.addEventListener("dragstart", bloquear);
    tarjeta.addEventListener("selectstart", bloquear);
    tarjeta.addEventListener("touchmove", bloquearScroll, { passive: false });
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", alSalir);
    return () => {
      tarjeta.removeEventListener("pointerenter", precargar);
      tarjeta.removeEventListener("pointerdown", presionar);
      tarjeta.removeEventListener("pointermove", mover);
      tarjeta.removeEventListener("pointerup", soltar);
      tarjeta.removeEventListener("pointercancel", soltar);
      tarjeta.removeEventListener("lostpointercapture", perderCaptura);
      tarjeta.removeEventListener("click", clic, true);
      tarjeta.removeEventListener("contextmenu", bloquear);
      tarjeta.removeEventListener("dragstart", bloquear);
      tarjeta.removeEventListener("selectstart", bloquear);
      tarjeta.removeEventListener("touchmove", bloquearScroll);
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", alSalir);
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

  // La foto visible aparece encima con un fundido corto; la anterior queda debajo hasta que
  // termina (así nunca se ve el fondo); el resto, oculto.
  const capa = (i: number): CSSProperties =>
    i === vista.actual
      ? { opacity: 1, zIndex: 2, transition: `opacity ${fundido}ms linear` }
      : i === vista.anterior
        ? { opacity: 1, zIndex: 1 }
        : { opacity: 0, zIndex: 0 };

  const cargando = girando && !listas;

  return (
    <div ref={raiz} className="absolute inset-0 select-none">
      {/* isolate: el orden de las fotos (z-index) queda adentro y el enlace de la tarjeta sigue
          encima, así un toque en la foto abre la ficha aunque el mouse no haya pasado antes. */}
      <div className={`absolute inset-0 isolate ${className}`}>
        <div className="absolute inset-0" style={capa(0)}>
          <FotoObra foto={cuadros[0]} ajuste="contener" tamanos={tamanos} prioridad={prioridad} />
        </div>
        {pedidas &&
          cuadros.slice(1).map((foto, j) => (
            <div key={foto.ruta} aria-hidden className="absolute inset-0" style={capa(j + 1)}>
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
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-smt/15 transition-opacity duration-200 ${girando && listas ? "opacity-100" : "opacity-0"}`}
      >
        <span ref={barra} className="block h-full origin-left scale-x-0 bg-smt" />
      </span>

      <button
        type="button"
        data-giro-boton
        onClick={alBoton}
        onPointerEnter={pedirFotos}
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
          className={`h-3 w-3 ${girando && listas ? "animate-spin [animation-duration:1.6s]" : ""}`}
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
