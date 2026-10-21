import Link from "next/link";
import { BarraNavegacion } from "./BarraNavegacion";
import { Marca } from "./Marca";

const ENLACES = [
  { href: "/obras", texto: "Obras" },
  { href: "/como-participar", texto: "Cómo participar" },
  { href: "/mis-ofertas", texto: "Mis ofertas" },
];

/**
 * Encabezado institucional: el logo oficial en una sola tinta (azul profundo), sin fondo; a su
 * lado, separado por un filete, el nombre de la plataforma. Fijo arriba.
 */
export function Encabezado() {
  return (
    <BarraNavegacion
      enlaces={ENLACES}
      marca={
        <Link href="/" className="flex min-w-0 items-center gap-3 md:gap-4">
          <Marca logo="smt-blanco" tinta="var(--color-azul-profundo)" alto={34} />
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
