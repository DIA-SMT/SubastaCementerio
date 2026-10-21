import type { EstadoSubasta } from "@/lib/datos/tipos";
import { fechaHoraLarga, fechaLarga } from "@/lib/formato";
import { CuentaBloques } from "./CuentaBloques";
import { CuentaRegresiva } from "./CuentaRegresiva";

export function textoPresencial(estado: EstadoSubasta) {
  if (!estado.fechaPresencial) return "La fecha de la subasta presencial está por confirmarse.";
  return `La subasta presencial es el ${fechaLarga(estado.fechaPresencial)}.${
    estado.detallePresencial ? ` ${estado.detallePresencial}` : ""
  }`;
}

/** Plazo de la etapa virtual según la fase, con cuenta regresiva cuando corresponde. */
export function Plazo({ estado }: { estado: EstadoSubasta }) {
  const ahora = estado.ahora.toISOString();
  switch (estado.fase) {
    case "por_confirmar":
      return <p>Las fechas de la etapa virtual están por confirmarse.</p>;
    case "antes":
      return (
        <div className="space-y-1">
          <p className="text-xl">
            <CuentaRegresiva
              objetivo={estado.inicio.toISOString()}
              ahoraServidor={ahora}
              prefijo="La etapa virtual empieza en"
              alTerminar="La etapa virtual ya empezó."
            />
          </p>
          <p className="text-texto">Inicio: {fechaHoraLarga(estado.inicio)} (hora de Tucumán)</p>
        </div>
      );
    case "abierta":
      return (
        <div className="space-y-1">
          <p className="text-xl">
            <CuentaRegresiva
              objetivo={estado.cierre.toISOString()}
              ahoraServidor={ahora}
              prefijo="Cierra en"
              alTerminar="La etapa virtual cerró."
            />
          </p>
          <p className="text-texto">Cierre: {fechaHoraLarga(estado.cierre)} (hora de Tucumán)</p>
        </div>
      );
    case "cerrada":
      return (
        <div className="space-y-1">
          <p className="text-xl font-bold text-tinta">La etapa virtual cerró.</p>
          <p>{textoPresencial(estado)}</p>
        </div>
      );
  }
}

/** Rótulo, objetivo de la cuenta regresiva (si hay) y detalle del plazo según la fase. */
function datosPlazo(estado: EstadoSubasta) {
  switch (estado.fase) {
    case "por_confirmar":
      return { rotulo: "Fechas a confirmar", detalle: "Las fechas de la etapa virtual están por confirmarse." };
    case "antes":
      return {
        rotulo: "La subasta virtual comienza en",
        objetivo: estado.inicio,
        alTerminar: "La subasta virtual ya comenzó.",
        detalle: `Inicio: ${fechaHoraLarga(estado.inicio)} (hora de Tucumán)`,
      };
    case "abierta":
      return {
        rotulo: "La subasta virtual finaliza en",
        objetivo: estado.cierre,
        alTerminar: "La subasta virtual finalizó.",
        detalle: `Cierre: ${fechaHoraLarga(estado.cierre)} (hora de Tucumán)`,
      };
    case "cerrada":
      return { rotulo: "La subasta virtual finalizó", detalle: textoPresencial(estado) };
  }
}

/** Franja horizontal con la cuenta regresiva, debajo del hero de la portada. */
export function FranjaPlazo({ estado }: { estado: EstadoSubasta }) {
  const d = datosPlazo(estado);
  return (
    <section aria-labelledby="titulo-plazo" className="border-y border-white/50 bg-papel/[0.4] backdrop-blur-xl">
      <div className="contenedor flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between md:gap-10 md:py-10">
        <div>
          <h2 id="titulo-plazo" className="antetitulo">
            {d.rotulo}
          </h2>
          <p className={`mt-2 ${d.objetivo ? "text-texto" : "max-w-2xl text-lg text-tinta"}`}>{d.detalle}</p>
        </div>
        {d.objetivo && (
          <CuentaBloques
            objetivo={d.objetivo.toISOString()}
            ahoraServidor={estado.ahora.toISOString()}
            etiqueta={d.rotulo}
            alTerminar={d.alTerminar}
          />
        )}
      </div>
    </section>
  );
}

/** Plazo compacto: catálogo y ficha de la obra. */
export function PlazoCompacto({ estado }: { estado: EstadoSubasta }) {
  const d = datosPlazo(estado);
  return (
    <div>
      <p className="rotulo">{d.rotulo}</p>
      {d.objetivo && (
        <div className="mt-3">
          <CuentaBloques
            objetivo={d.objetivo.toISOString()}
            ahoraServidor={estado.ahora.toISOString()}
            etiqueta={d.rotulo}
            alTerminar={d.alTerminar}
            tamano="compacto"
          />
        </div>
      )}
      <p className={d.objetivo ? "mt-3 text-[0.88rem] text-gris" : "mt-2 text-tinta"}>{d.detalle}</p>
    </div>
  );
}
