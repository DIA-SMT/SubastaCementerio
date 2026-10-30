import Link from "next/link";
import { BarraNavegacion } from "./BarraNavegacion";
import { Marca } from "./Marca";

const ENLACES = [
  { href: "/obras", texto: "Obras" },
  { href: "/como-participar", texto: "Cómo participar" },
  { href: "/mis-ofertas", texto: "Mis ofertas", destacado: true },
];

/**
 * Encabezado institucional en azul noche: el logo oficial a color (versión para fondos oscuros); a
 * su lado, separado por un filete, el nombre de la plataforma. Fijo arriba.
 */
export function Encabezado() {
  return (
    <BarraNavegacion
      enlaces={ENLACES}
      marca={
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-sm md:gap-4">
          <Marca logo="smt-color" alto={38} />
          <span aria-hidden className="hidden h-8 w-px bg-white/20 sm:block" />
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-[0.94rem] font-semibold tracking-[-0.015em] text-white md:text-[1.02rem]">
              Subasta Solidaria
            </span>
            <span className="hidden text-[0.78rem] text-marino-tenue sm:block">Cementerio del Oeste</span>
          </span>
        </Link>
      }
    />
  );
}
