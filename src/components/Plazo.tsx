import type { EstadoSubasta } from "@/lib/datos/tipos";
import { fechaHoraLarga, fechaLarga } from "@/lib/formato";
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
