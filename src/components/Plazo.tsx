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

/**
 * Plazo destacado: cuenta regresiva en bloques (portada, catálogo y ficha).
 * Con `claro`, para usar sobre el degradé institucional.
 */
export function PlazoDestacado({ estado, claro = false }: { estado: EstadoSubasta; claro?: boolean }) {
  const ahora = estado.ahora.toISOString();
  const secundario = claro ? "text-white" : "text-texto";
  switch (estado.fase) {
    case "por_confirmar":
      return <p className={`text-xl font-bold ${claro ? "text-white" : "text-tinta"}`}>Las fechas de la etapa virtual están por confirmarse.</p>;
    case "antes":
      return (
        <div className="space-y-2">
          <CuentaBloques
            objetivo={estado.inicio.toISOString()}
            ahoraServidor={ahora}
            etiqueta="La etapa virtual empieza en"
            alTerminar="La etapa virtual ya empezó."
            claro={claro}
          />
          <p className={secundario}>Inicio: {fechaHoraLarga(estado.inicio)} (hora de Tucumán)</p>
        </div>
      );
    case "abierta":
      return (
        <div className="space-y-2">
          <CuentaBloques
            objetivo={estado.cierre.toISOString()}
            ahoraServidor={ahora}
            etiqueta="La etapa virtual cierra en"
            alTerminar="La etapa virtual cerró."
            claro={claro}
          />
          <p className={secundario}>Cierre: {fechaHoraLarga(estado.cierre)} (hora de Tucumán)</p>
        </div>
      );
    case "cerrada":
      return (
        <div className="space-y-1">
          <p className={`text-xl font-bold ${claro ? "text-white" : "text-tinta"}`}>La etapa virtual cerró.</p>
          <p className={secundario}>{textoPresencial(estado)}</p>
        </div>
      );
  }
}
