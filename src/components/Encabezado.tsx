import Link from "next/link";
import { Marca } from "./Marca";

const ENLACES = [
  { href: "/obras", texto: "Obras" },
  { href: "/como-participar", texto: "Cómo participar" },
  { href: "/mis-ofertas", texto: "Mis ofertas" },
];

/**
 * Encabezado institucional (degradé a 112°, logo blanco y línea amarilla/celeste), fijo arriba
 * como en el Bus Turístico. Los textos sobre el degradé van en tamaño grande (contraste AA).
 */
export function Encabezado() {
  return (
    <header className="z-40 shadow-[0_8px_24px_rgb(12_28_46/0.12)] md:sticky md:top-0">
      <div className="fondo-institucional text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-3 py-1" aria-label="Ciudad SMT, inicio de la subasta">
            <Marca logo="smt-blanco" claro />
            <span aria-hidden className="hidden h-8 w-px bg-white/40 sm:block" />
            <span className="hidden text-lg leading-tight font-extrabold sm:block">Subasta solidaria</span>
          </Link>
          <nav aria-label="Principal" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {ENLACES.map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-lg font-bold text-white hover:bg-azul-oscuro/70 focus-visible:bg-azul-oscuro"
                  >
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/obras"
            className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-lg font-bold text-azul-profundo shadow-sm hover:bg-fondo md:hidden"
          >
            Ver obras
          </Link>
        </div>
        {/* Línea de cierre: 22 % amarillo, el resto celeste. */}
        <div aria-hidden className="flex h-1.5">
          <span className="w-[22%] bg-amarillo" />
          <span className="flex-1 bg-celeste" />
        </div>
      </div>
      {/* En el celular, el menú va en una barra blanca debajo del encabezado. Entra en una fila
          desde 360 px; más angosto (o con el texto agrandado) pasa a dos filas, sin desbordar. */}
      <nav aria-label="Principal" className="border-b border-linea bg-white/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-evenly px-1">
          {ENLACES.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="inline-flex min-h-12 items-center px-2 font-bold whitespace-nowrap text-azul-profundo"
              >
                {e.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
