import Link from "next/link";
import { Marca } from "./Marca";

const ENLACES = [
  { href: "/obras", texto: "Obras" },
  { href: "/como-participar", texto: "Cómo participar" },
  { href: "/mis-ofertas", texto: "Mis ofertas" },
];

export function Encabezado() {
  return (
    <header>
      <div className="fondo-institucional text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 md:py-4">
          {/* El nombre empieza con el texto del logo, para que se pueda nombrar por voz. */}
          <Link href="/" className="inline-flex items-center gap-3 py-1" aria-label="Ciudad SMT, inicio de la subasta">
            <Marca logo="smt-blanco" claro />
          </Link>
          {/* En pantallas anchas el menú va sobre el degradé, en texto grande (contraste AA).
              El fondo del hover y del foco oscurece: un velo blanco bajaría el contraste. */}
          <nav aria-label="Principal" className="hidden md:block">
            <ul className="flex gap-2">
              {ENLACES.map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    className="inline-flex min-h-12 items-center rounded-lg px-3 text-lg font-bold text-white hover:bg-azul-oscuro focus-visible:bg-azul-oscuro"
                  >
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {/* Línea de cierre: 22 % amarillo, el resto celeste. */}
        <div aria-hidden className="flex h-1.5">
          <span className="w-[22%] bg-amarillo" />
          <span className="flex-1 bg-celeste" />
        </div>
      </div>
      {/* En el celular, el menú va en una barra blanca debajo del encabezado. Entra en una fila
          desde 360 px; más angosto (o con el texto agrandado) pasa a dos filas, sin desbordar. */}
      <nav aria-label="Principal" className="border-b border-linea bg-white md:hidden">
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
