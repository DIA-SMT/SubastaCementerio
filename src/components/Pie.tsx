import Link from "next/link";
import { Marca } from "./Marca";

const ENLACES = [
  { href: "/como-participar", texto: "Cómo participar" },
  { href: "/bases-y-condiciones", texto: "Bases y condiciones" },
  { href: "/destino", texto: "Destino de lo recaudado" },
  { href: "/privacidad", texto: "Privacidad" },
];

export function Pie() {
  return (
    <footer className="mt-16 border-t border-linea bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Información">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {ENLACES.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="enlace">
                  {e.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 flex flex-col gap-6 border-t border-linea pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Marca logo="muni-iso" />
            <p className="font-bold text-tinta">
              Municipalidad de San Miguel de Tucumán · Dirección de Cementerios
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-gris">Desarrollado por la Dirección de Inteligencia Artificial</p>
            <Marca logo="ia" />
          </div>
        </div>
      </div>
    </footer>
  );
}
