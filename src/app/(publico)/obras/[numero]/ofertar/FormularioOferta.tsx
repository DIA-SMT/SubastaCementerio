"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { pesos, numeroConPuntos } from "@/lib/formato";
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
      <div className="rounded-2xl border-l-8 border-verde bg-verde-suave p-5 text-tinta">
        <h2 ref={tituloOkRef} tabIndex={-1} aria-describedby="oferta-registrada" className="text-2xl">
          Listo, registramos tu oferta
        </h2>
        <div id="oferta-registrada">
          <p className="mt-2 text-3xl font-extrabold">{pesos(resultado.monto)}</p>
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
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
      <form action={enviar} className="space-y-5">
        <input type="hidden" name="obraId" value={props.obraId} />
        <input type="hidden" name="monto" value={monto} />
        <div>
          <h2
            ref={tituloConfirmarRef}
            tabIndex={-1}
            aria-describedby="monto-a-confirmar"
            className="text-2xl"
          >
            Confirmá tu oferta
          </h2>
          <div id="monto-a-confirmar">
            <p className="mt-3 text-5xl font-extrabold text-tinta">{pesos(monto)}</p>
            <p className="mt-2 text-lg">por la {props.descripcion}.</p>
          </div>
        </div>
        {muyAlto && (
          <div role="alert" className="rounded-xl border-l-8 border-ambar bg-ambar-suave px-4 py-3 text-tinta">
            <p className="font-bold">Revisá el monto</p>
            <p>
              Es más del triple {ofertaActual != null ? `de la oferta actual (${pesos(ofertaActual)})` : `del mínimo (${pesos(minimo)})`}.
              Fijate que no sobre ningún cero.
            </p>
          </div>
        )}
        <p className="rounded-xl bg-fondo px-4 py-3 text-lg text-tinta">
          Una vez confirmada, la oferta queda registrada y no se puede editar ni borrar desde el sitio. Las
          condiciones de la subasta están en las{" "}
          <Link href="/bases-y-condiciones" className="enlace" target="_blank">
            bases y condiciones (se abren en otra pestaña)
          </Link>
          .
        </p>
        <div className="flex flex-col gap-3">
          <button type="submit" className="boton-primario text-xl" disabled={enviando}>
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
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (monto == null) return rechazar("Escribí el monto de tu oferta.");
        if (monto < minimo) return rechazar(`La oferta mínima es de ${pesos(minimo)}.`);
        if (monto > MONTO_MAXIMO) return rechazar(MONTO_MUY_ALTO);
        setError(null);
        setPaso("confirmar");
      }}
    >
      <div className="rounded-2xl bg-fondo p-4">
        <p className="text-lg">
          {ofertaActual != null ? (
            <>
              Oferta más alta: <strong className="text-tinta">{pesos(ofertaActual)}</strong>
            </>
          ) : (
            "Todavía no hay ofertas para esta obra."
          )}
        </p>
        <p className="text-lg">
          Tu oferta tiene que ser de al menos <strong className="text-tinta">{pesos(minimo)}</strong>.
        </p>
      </div>

      <div>
        <label htmlFor="monto" className="etiqueta text-xl">
          ¿Cuánto ofrecés?
        </label>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-tinta" aria-hidden>
            $
          </span>
          <input
            ref={montoRef}
            id="monto"
            name="monto"
            inputMode="numeric"
            autoComplete="off"
            className="campo text-3xl font-bold"
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
          className="rounded-xl border-l-8 border-rojo bg-rojo-suave px-4 py-3 font-bold text-tinta"
        >
          {error}
        </p>
      )}

      <button type="submit" className="boton-primario w-full text-xl">
        Continuar
      </button>
    </form>
  );
}
