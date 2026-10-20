import Link from "next/link";
import { BarraNavegacion } from "./BarraNavegacion";
import { Marca } from "./Marca";

const ENLACES = [
  { href: "/obras", texto: "Obras" },
  { href: "/como-participar", texto: "Cómo participar" },
  { href: "/mis-ofertas", texto: "Mis ofertas" },
];

/**
 * Encabezado institucional: el logo oficial (blanco) va sin modificar sobre un sello en azul
 * profundo; a su lado, separado por un filete, el nombre de la plataforma. Fijo arriba.
 */
export function Encabezado() {
  return (
    <BarraNavegacion
      enlaces={ENLACES}
      marca={
        <Link href="/" className="flex min-w-0 items-center gap-3 md:gap-4">
          <span className="fondo-institucional flex h-10 shrink-0 items-center rounded-[3px] px-2.5 md:h-11 md:px-3">
            <Marca logo="smt-blanco" claro alto={28} />
          </span>
          <span aria-hidden className="hidden h-8 w-px bg-linea sm:block" />
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-[0.94rem] font-semibold tracking-[-0.015em] text-tinta md:text-[1.02rem]">
              Subasta Solidaria
            </span>
            <span className="hidden text-[0.78rem] text-gris sm:block">Cementerio del Oeste</span>
          </span>
        </Link>
      }
    />
  );
}
