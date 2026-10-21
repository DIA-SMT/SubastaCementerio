import Link from "next/link";
import { Marca } from "./Marca";
import { Divisor } from "./Ornamentos";

const GRUPOS = [
  {
    titulo: "La subasta",
    enlaces: [
      { href: "/obras", texto: "Obras" },
      { href: "/como-participar", texto: "Cómo participar" },
      { href: "/mis-ofertas", texto: "Mis ofertas" },
    ],
  },
  {
    titulo: "Información",
    enlaces: [
      { href: "/bases-y-condiciones", texto: "Bases y condiciones" },
      { href: "/destino", texto: "Destino de lo recaudado" },
      { href: "/privacidad", texto: "Privacidad" },
    ],
  },
];

export function Pie() {
  return (
    <footer className="border-t border-linea bg-papel">
      <div className="contenedor py-14 md:py-16">
        <Divisor className="mx-auto -mt-2 mb-12 h-4 w-40 text-oro/70" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12 md:gap-x-10">
          <div className="col-span-2 flex items-start gap-4 md:col-span-5">
            <Marca logo="muni-iso" alto={48} />
            <div>
              <p className="font-display font-semibold tracking-[-0.01em] text-tinta">
                Municipalidad de San Miguel de Tucumán
              </p>
              <p className="mt-0.5 text-[0.9rem] text-gris">Dirección de Cementerios</p>
            </div>
          </div>
          {GRUPOS.map((g, i) => (
            <nav
              key={g.titulo}
              aria-label={g.titulo}
              className={i === 0 ? "md:col-span-3 md:col-start-7" : "md:col-span-3"}
            >
              <p className="rotulo">{g.titulo}</p>
              <ul className="mt-2">
                {g.enlaces.map((e) => (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      className="inline-flex min-h-10 items-center text-[0.94rem] text-texto transition-colors duration-200 hover:text-azul"
                    >
                      {e.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-linea pt-6 text-[0.85rem] text-gris sm:flex-row sm:items-center sm:justify-between">
          <p>La plataforma no cobra ni procesa pagos.</p>
          <div className="flex items-center gap-3">
            <p>Desarrollado por la Dirección de Inteligencia Artificial</p>
            <Marca logo="ia" alto={30} />
          </div>
        </div>
      </div>
    </footer>
  );
}
