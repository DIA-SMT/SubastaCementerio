import type { EstadoSubasta, Fase } from "@/lib/datos/tipos";
import { fechaHoraLarga, fechaLarga, horaConSegundos } from "@/lib/formato";
import { CuentaBloques } from "./CuentaBloques";
import { CuentaRegresiva } from "./CuentaRegresiva";

export function textoPresencial(estado: EstadoSubasta) {
  if (!estado.fechaPresencial) return "La fecha de la subasta presencial está por confirmarse.";
  return `La subasta presencial es el ${fechaLarga(estado.fechaPresencial)}.${
    estado.detallePresencial ? ` ${estado.detallePresencial}` : ""
  }`;
}

/** "Si alguien oferta en los últimos 3 minutos, …", o vacío si la extensión no está habilitada. */
export function textoExtension(estado: EstadoSubasta, deQue = "de esa obra") {
  if (!estado.extension) return "";
  const m = estado.extension.minutos;
  const minutos = m === 1 ? "el último minuto" : `los últimos ${m} minutos`;
  return `Si alguien oferta en ${minutos}, el cierre ${deQue} se extiende ${m === 1 ? "1 minuto" : `${m} minutos`} desde esa oferta.`;
}

const TIEMPO_EXTRA =
  "Terminó el horario general. Algunas obras siguen abiertas unos minutos más por ofertas de último momento.";
const FIN_HORARIO_GENERAL =
  "Terminó el horario general. Las obras con ofertas de último momento pueden seguir abiertas unos minutos.";

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
      if (estado.enExtension) {
        return (
          <div className="space-y-1">
            <p className="text-xl">
              <CuentaRegresiva
                objetivo={estado.cierreFinal.toISOString()}
                ahoraServidor={ahora}
                prefijo="Tiempo extra: la última obra abierta cierra en"
                alTerminar="La etapa virtual cerró."
              />
            </p>
            <p className="text-texto">
              {TIEMPO_EXTRA} Cierre general: {fechaHoraLarga(estado.cierre)} (hora de Tucumán).
            </p>
          </div>
        );
      }
      return (
        <div className="space-y-1">
          <p className="text-xl">
            <CuentaRegresiva
              objetivo={estado.cierre.toISOString()}
              ahoraServidor={ahora}
              prefijo="Cierra en"
              alTerminar={estado.extension ? FIN_HORARIO_GENERAL : "La etapa virtual cerró."}
            />
          </p>
          <p className="text-texto">
            Cierre: {fechaHoraLarga(estado.cierre)} (hora de Tucumán).{" "}
            {textoExtension(estado, "de cada obra")}
          </p>
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

/** Datos de una obra para su plazo: si su cierre se extendió, manda el de la obra. */
type PlazoDeObra = { cierre: Date; fase: Fase };

/** Rótulo, objetivo de la cuenta regresiva (si hay) y detalle del plazo según la fase. */
function datosPlazo(estado: EstadoSubasta, obra?: PlazoDeObra) {
  const fase = obra ? obra.fase : estado.fase;
  switch (fase) {
    case "por_confirmar":
      return { rotulo: "Fechas a confirmar", detalle: "Las fechas de la etapa virtual están por confirmarse." };
    case "antes":
      return {
        rotulo: "La subasta virtual comienza en",
        objetivo: estado.inicio,
        alTerminar: "La subasta virtual ya comenzó.",
        detalle: [`Inicio: ${fechaHoraLarga(estado.inicio)} (hora de Tucumán).`, textoExtension(estado, "de cada obra")]
          .filter(Boolean)
          .join(" "),
      };
    case "abierta":
      if (obra && obra.cierre > estado.cierre) {
        return {
          rotulo: "Tiempo extra: esta obra cierra en",
          objetivo: obra.cierre,
          alTerminar: "La subasta virtual de esta obra finalizó.",
          detalle:
            `Una oferta de último momento extendió el cierre de esta obra hasta las ${horaConSegundos(obra.cierre)} ` +
            "(hora de Tucumán). Si alguien vuelve a ofertar antes, el cierre se corre otra vez.",
        };
      }
      if (!obra && estado.enExtension) {
        return {
          rotulo: "Tiempo extra",
          objetivo: estado.cierreFinal,
          alTerminar: "La subasta virtual finalizó.",
          detalle: TIEMPO_EXTRA,
        };
      }
      return {
        rotulo: "La subasta virtual finaliza en",
        objetivo: estado.cierre,
        alTerminar: estado.extension ? FIN_HORARIO_GENERAL : "La subasta virtual finalizó.",
        detalle: [
          `Cierre: ${fechaHoraLarga(estado.cierre)} (hora de Tucumán).`,
          textoExtension(estado, obra ? "de esta obra" : "de cada obra"),
        ]
          .filter(Boolean)
          .join(" "),
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

/** Plazo compacto: catálogo y ficha de la obra (con `obra`, el plazo es el de esa obra). */
export function PlazoCompacto({ estado, obra }: { estado: EstadoSubasta; obra?: PlazoDeObra }) {
  const d = datosPlazo(estado, obra);
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
