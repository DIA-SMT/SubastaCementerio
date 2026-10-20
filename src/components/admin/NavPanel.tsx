"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SECCIONES_PANEL = [
  { href: "/admin", texto: "Tablero" },
  { href: "/admin/obras", texto: "Obras" },
  { href: "/admin/artistas", texto: "Artistas" },
  { href: "/admin/ofertas", texto: "Ofertas" },
  { href: "/admin/oferentes", texto: "Oferentes" },
  { href: "/admin/configuracion", texto: "Configuración" },
  { href: "/admin/textos", texto: "Textos" },
  { href: "/admin/exportar", texto: "Listado final" },
  { href: "/admin/qr", texto: "Carteles QR" },
  { href: "/admin/auditoria", texto: "Auditoría" },
] as const;

/** Menú del panel con la sección actual marcada. Va dentro de <Suspense> (lee la URL). */
export function NavPanel() {
  return <ListaPanel ruta={usePathname()} />;
}

/** Mismo menú sin marcar la sección: se muestra mientras se resuelve la URL. */
export function NavPanelBase() {
  return <ListaPanel ruta={null} />;
}

/** Menú del panel: columna en computadora, fila desplazable en el celular. */
function ListaPanel({ ruta }: { ruta: string | null }) {
  return (
    <nav aria-label="Panel" className="border-b border-linea bg-white xl:w-60 xl:shrink-0 xl:border-r xl:border-b-0">
      <ul className="flex gap-1 overflow-x-auto px-2 py-2 xl:sticky xl:top-0 xl:flex-col xl:px-3 xl:py-6">
        {SECCIONES_PANEL.map((s) => {
          const activa = ruta != null && (s.href === "/admin" ? ruta === "/admin" : ruta === s.href || ruta.startsWith(`${s.href}/`));
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 font-bold whitespace-nowrap ${
                  activa ? "bg-azul text-white" : "text-azul-profundo hover:bg-fondo"
                }`}
              >
                {s.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
