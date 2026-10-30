import { IconoCampana, IconoGrilla, IconoMartillo, IconoObra } from "./Iconos";

const PASOS = [
  {
    titulo: "Explorá la colección",
    texto: "Entrá a Obras para recorrer el catálogo completo y conocer cada pieza en detalle.",
    Icono: IconoGrilla,
  },
  {
    titulo: "Elegí una obra",
    texto: "En su ficha encontrás las fotos, la historia, la oferta actual y el monto mínimo para superarla.",
    Icono: IconoObra,
  },
  {
    titulo: "Realizá tu oferta",
    texto: "Ingresá con tu correo y el código que te enviamos. Revisá el monto y confirmalo antes de registrarlo.",
    Icono: IconoMartillo,
  },
  {
    titulo: "Seguí el resultado",
    texto: "Si alguien supera tu oferta, te avisamos por correo. También podés seguirla desde Mis ofertas.",
    Icono: IconoCampana,
  },
];

/**
 * Los cuatro pasos para participar, numerados en grande. En computadora van en una fila unida
 * por un filete; en el celular, uno debajo del otro con el filete a la izquierda.
 */
export function PasosParticipar() {
  return (
    <ol className="relative grid gap-y-10 lg:grid-cols-4 lg:gap-x-8">
      {/* Filete que une los pasos (detrás de los círculos). */}
      <span aria-hidden className="absolute top-0 bottom-0 left-7 w-px bg-smt/25 lg:top-7 lg:right-[12.5%] lg:bottom-auto lg:left-[12.5%] lg:h-px lg:w-auto" />
      {PASOS.map(({ titulo, texto, Icono }, i) => (
        <li key={titulo} className="revelar relative grid grid-cols-[3.5rem_1fr] gap-x-5 lg:flex lg:flex-col lg:items-center lg:text-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-papel text-[1.45rem] text-smt ring-1 ring-smt/35">
            <Icono />
          </span>
          <div className="lg:mt-6">
            <p className="font-display text-[2.1rem] leading-none font-semibold tracking-[-0.03em] text-smt tabular-nums lg:text-[2.6rem]">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-3 text-subtitulo">{titulo}</h3>
            <p className="mt-2 text-texto lg:mx-auto lg:max-w-[15rem]">{texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
