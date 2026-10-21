"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { IconoCheck } from "@/components/Iconos";
import { horaConSegundos, pesos, numeroConPuntos } from "@/lib/formato";
import { MONTO_MAXIMO, montoDesdeTexto } from "@/lib/validacion";
import { confirmarOferta, type ResultadoOferta } from "./acciones";

type Props = {
  obraId: string;
  numero: number;
  descripcion: string;
  ofertaActual: number | null;
  minimo: number;
  incremento: number;
  email: string;
  /** Si la persona tiene activados los avisos por correo (se cambia en Mis ofertas). */
  avisos: boolean;
};

const MONTO_MUY_ALTO = `El monto máximo es de ${pesos(MONTO_MAXIMO)}. Revisá que no sobre ningún cero.`;

const MENSAJES: Record<string, string> = {
  ya_es_la_mas_alta: "Ya tenés la oferta más alta de esta obra.",
  cerrada: "La etapa virtual ya cerró. No se aceptan más ofertas.",
  no_empezo: "La etapa virtual todavía no empezó.",
  bloqueado: "Tu cuenta no puede ofertar. Comunicate con la Dirección de Cementerios.",
  demasiadas_ofertas: "Hiciste muchas ofertas seguidas. Esperá un minuto y probá de nuevo.",
  monto_invalido: "Revisá el monto: escribí solo números.",
  monto_muy_alto: MONTO_MUY_ALTO,
  obra_inexistente: "No encontramos esta obra.",
  sin_sesion: "Tu sesión terminó. Volvé a ingresar con tu correo.",
  sin_registro: "Antes de ofertar tenés que completar tus datos.",
  correo_sin_verificar: "Antes de ofertar tenés que confirmar tu correo.",
};

/** Explica por qué el monto ya no alcanza, según lo que cambió desde que se mostró la obra. */
function motivoMontoInsuficiente(mostrada: number | null, actual: number | null, minimo: number) {
  if (actual == null) {
    return `Cambió el monto mínimo para ofertar por esta obra. Ahora tenés que ofertar al menos ${pesos(minimo)}.`;
  }
  if (actual === mostrada) {
    return `Cambió el incremento mínimo. Para superar la oferta actual de ${pesos(actual)}, ofertá al menos ${pesos(minimo)}.`;
  }
  return `Alguien ofertó antes que vos. La oferta actual es de ${pesos(actual)}; para superarla, ofertá al menos ${pesos(minimo)}.`;
}

export function FormularioOferta(props: Props) {
  const [paso, setPaso] = useState<"monto" | "confirmar">("monto");
  const [minimo, setMinimo] = useState(props.minimo);
  const [ofertaActual, setOfertaActual] = useState(props.ofertaActual);
  const [texto, setTexto] = useState(numeroConPuntos(props.minimo));
  const [error, setError] = useState<string | null>(null);
  // Cambia con cada error para que el aviso se vuelva a anunciar aunque el texto se repita.
  const [vezError, setVezError] = useState(0);

  const montoRef = useRef<HTMLInputElement>(null);
  const tituloConfirmarRef = useRef<HTMLHeadingElement>(null);
  const tituloOkRef = useRef<HTMLHeadingElement>(null);

  const [resultado, enviar, enviando] = useActionState<ResultadoOferta, FormData>(async (previo, datos) => {
    const r = await confirmarOferta(previo, datos);
    if (r.estado !== "error") return r;
    // Si el mínimo cambió, el servidor devuelve el nuevo: volvemos al primer paso.
    if (r.codigo === "monto_insuficiente" && r.minimo) {
      setError(motivoMontoInsuficiente(ofertaActual, r.ofertaActual ?? null, r.minimo));
      setMinimo(r.minimo);
      setOfertaActual(r.ofertaActual ?? null);
      setTexto(numeroConPuntos(r.minimo));
    } else {
      setError(MENSAJES[r.codigo] ?? "No pudimos registrar la oferta. Probá de nuevo en unos minutos.");
    }
    setVezError((v) => v + 1);
    setPaso("monto");
    return r;
  }, { estado: "inicial" });

  // Al cambiar de paso, el bloque que tenía el foco desaparece: lo llevamos al título del paso
  // nuevo, o al campo cuando hay un error (ya asociado con aria-describedby), para que el lector
  // de pantalla lo anuncie. En la carga inicial no se mueve el foco: solo cuando cambia algo
  // respecto del render anterior.
  const anterior = useRef({ paso, estado: resultado.estado, vezError });
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { paso, estado: resultado.estado, vezError };
    if (antes.paso === paso && antes.estado === resultado.estado && antes.vezError === vezError) return;
    if (resultado.estado === "ok") tituloOkRef.current?.focus();
    else if (paso === "confirmar") tituloConfirmarRef.current?.focus();
    else montoRef.current?.focus();
  }, [paso, resultado.estado, vezError]);

  const monto = montoDesdeTexto(texto);

  if (resultado.estado === "ok") {
    return (
      <div className="text-tinta">
        <span
          aria-hidden
          className="confirmacion flex h-14 w-14 items-center justify-center rounded-full bg-verde-suave text-[1.7rem] text-verde ring-1 ring-verde/25 ring-inset"
        >
          <IconoCheck />
        </span>
        <h2 ref={tituloOkRef} tabIndex={-1} aria-describedby="oferta-registrada" className="mt-5 text-seccion">
          Listo, registramos tu oferta
        </h2>
        <div id="oferta-registrada">
          <p className="mt-4 font-display text-[2.6rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {pesos(resultado.monto)}
          </p>
          <p className="mt-1 text-lg">por la {props.descripcion}.</p>
          <p className="mt-3 text-lg">
            {props.avisos ? (
              <>
                Ahora tenés la oferta más alta. Si alguien la supera, te avisamos a <strong>{props.email}</strong>.
              </>
            ) : (
              <>
                Ahora tenés la oferta más alta. Tenés los avisos por correo desactivados; podés activarlos en{" "}
                <Link href="/mis-ofertas" className="enlace">
                  Mis ofertas
                </Link>
                .
              </>
            )}
          </p>
          {resultado.cierreExtendido && (
            <p className="mt-3 rounded-md bg-superficie px-4 py-3.5 text-tinta">
              Ofertaste en los últimos minutos, así que el cierre de esta obra se extendió: ahora cierra a las{" "}
              <strong className="tabular-nums">{horaConSegundos(new Date(resultado.cierreExtendido))}</strong> (hora de
              Tucumán).
            </p>
          )}
        </div>
        <div className="mt-7 flex flex-col gap-3 border-t border-linea pt-6 sm:flex-row">
          <Link href={`/obras/${props.numero}`} className="boton-primario">
            Volver a la obra
          </Link>
          <Link href="/obras" className="boton-secundario">
            Ver otras obras
          </Link>
        </div>
      </div>
    );
  }

  const ajustar = (delta: number) => {
    const base = monto ?? minimo;
    setTexto(numeroConPuntos(Math.max(minimo, base + delta)));
    setError(null);
  };

  if (paso === "confirmar" && monto != null) {
    const muyAlto = ofertaActual != null ? monto > ofertaActual * 3 : monto > minimo * 3;
    return (
      <form action={enviar} className="space-y-6">
        <input type="hidden" name="obraId" value={props.obraId} />
        <input type="hidden" name="monto" value={monto} />
        <IndicadorPasos actual={2} />
        <div>
          <h2
            ref={tituloConfirmarRef}
            tabIndex={-1}
            aria-describedby="monto-a-confirmar"
            className="text-seccion"
          >
            Confirmá tu oferta
          </h2>
          <div id="monto-a-confirmar">
            <p className="mt-3 font-display text-5xl font-semibold tracking-[-0.03em] text-tinta tabular-nums">{pesos(monto)}</p>
            <p className="mt-3 text-lg text-texto">por la {props.descripcion}.</p>
          </div>
        </div>
        {muyAlto && (
          <div role="alert" className="rounded-md border-l-2 border-ambar bg-ambar-suave px-4 py-3 text-tinta">
            <p className="font-semibold">Revisá el monto</p>
            <p>
              Es más del triple {ofertaActual != null ? `de la oferta actual (${pesos(ofertaActual)})` : `del mínimo (${pesos(minimo)})`}.
              Fijate que no sobre ningún cero.
            </p>
          </div>
        )}
        <p className="rounded-md bg-superficie px-4 py-3.5 text-tinta">
          Una vez confirmada, la oferta queda registrada y no se puede editar ni borrar desde el sitio. Las
          condiciones de la subasta están en las{" "}
          <Link href="/bases-y-condiciones" className="enlace" target="_blank">
            bases y condiciones (se abren en otra pestaña)
          </Link>
          .
        </p>
        <div className="flex flex-col gap-3">
          <button type="submit" className="boton-primario" disabled={enviando}>
            {enviando && (
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {enviando ? "Registrando tu oferta…" : "Confirmar oferta"}
          </button>
          <button type="button" className="boton-secundario" onClick={() => setPaso("monto")} disabled={enviando}>
            Cambiar el monto
          </button>
        </div>
      </form>
    );
  }

  const rechazar = (mensaje: string) => {
    setError(mensaje);
    setVezError((v) => v + 1);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (monto == null) return rechazar("Escribí el monto de tu oferta.");
        if (monto < minimo) return rechazar(`La oferta mínima es de ${pesos(minimo)}.`);
        if (monto > MONTO_MAXIMO) return rechazar(MONTO_MUY_ALTO);
        setError(null);
        setPaso("confirmar");
      }}
    >
      <IndicadorPasos actual={1} />
      <dl className="grid grid-cols-2 divide-x divide-linea rounded-md bg-superficie py-4">
        <div className="px-4">
          <dt className="rotulo">Oferta más alta</dt>
          <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-tinta tabular-nums">
            {ofertaActual != null ? pesos(ofertaActual) : "Sin ofertas"}
          </dd>
        </div>
        <div className="px-4">
          <dt className="rotulo">Oferta mínima</dt>
          <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-tinta tabular-nums">{pesos(minimo)}</dd>
        </div>
      </dl>

      <div>
        <label htmlFor="monto" className="etiqueta text-xl">
          ¿Cuánto ofrecés?
        </label>
        <div className="flex items-center gap-2">
          <span className="font-display text-3xl font-medium text-gris" aria-hidden>
            $
          </span>
          <input
            ref={montoRef}
            id="monto"
            name="monto"
            inputMode="numeric"
            autoComplete="off"
            className="campo min-h-16 font-display text-3xl font-semibold tracking-[-0.02em] tabular-nums"
            value={texto}
            onChange={(e) => {
              const n = montoDesdeTexto(e.target.value);
              // Con más cifras de las que acepta el campo, se ignora la tecla en lugar de borrar todo.
              if (n == null && /\d/.test(e.target.value)) return;
              setTexto(n == null ? "" : numeroConPuntos(n));
              setError(null);
            }}
            aria-describedby={error ? "ayuda-monto error-monto" : "ayuda-monto"}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <p id="ayuda-monto" className="mt-2 text-gris">
          En pesos, sin centavos. Podés escribirlo o usar los botones.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" className="boton-secundario" onClick={() => ajustar(-props.incremento)}>
            − {pesos(props.incremento)}
          </button>
          <button type="button" className="boton-secundario" onClick={() => ajustar(props.incremento)}>
            + {pesos(props.incremento)}
          </button>
        </div>
      </div>

      {error && (
        <p
          key={vezError}
          id="error-monto"
          role="alert"
          className="rounded-md border-l-2 border-rojo bg-rojo-suave px-4 py-3 font-medium text-tinta"
        >
          {error}
        </p>
      )}

      <button type="submit" className="boton-primario w-full">
        Continuar
      </button>
    </form>
  );
}

/** Paso 1 (monto) y paso 2 (confirmación) del ofrecimiento. */
function IndicadorPasos({ actual }: { actual: 1 | 2 }) {
  return (
    <div>
      <p className="rotulo">
        Paso {actual} de 2 · {actual === 1 ? "Monto" : "Confirmación"}
      </p>
      <div aria-hidden className="mt-2.5 grid grid-cols-2 gap-1.5">
        <span className="h-0.5 rounded-full bg-azul" />
        <span className={`h-0.5 rounded-full transition-colors duration-300 ${actual === 2 ? "bg-azul" : "bg-linea"}`} />
      </div>
    </div>
  );
}
