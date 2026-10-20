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
    <footer className="mt-20 border-t border-linea bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Marca logo="muni-iso" />
            <div>
              <p className="font-extrabold text-tinta">Municipalidad de San Miguel de Tucumán</p>
              <p className="text-texto">Dirección de Cementerios</p>
            </div>
          </div>
          <nav aria-label="Información">
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {ENLACES.map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    className="inline-flex min-h-11 items-center font-bold text-azul-profundo hover:underline hover:underline-offset-4"
                  >
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-linea pt-6 text-texto sm:flex-row sm:items-center sm:justify-between">
          <p>La plataforma no cobra ni procesa pagos.</p>
          <div className="flex items-center gap-3">
            <p>Desarrollado por la Dirección de Inteligencia Artificial</p>
            <Marca logo="ia" />
          </div>
        </div>
      </div>
    </footer>
  );
}
