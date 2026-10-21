import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FranjaEjemplo } from "@/components/Avisos";
import { FondoSala } from "@/components/FondoSala";
import { IconoFlecha } from "@/components/Iconos";
import { Marca } from "@/components/Marca";
import { adminActual } from "@/lib/admin/sesion";
import { salirDelPanel } from "./acciones";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel de la subasta" },
  robots: { index: false, follow: false },
};

/**
 * Panel del equipo con la misma identidad que el sitio: la sala de museo de fondo, encabezado
 * marfil translúcido con el logo sobre su sello y el contenido sobre un velo casi opaco (es una
 * herramienta de trabajo: primero se lee).
 */
export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div className="sitio flex flex-1 flex-col">
      <FondoSala />
      <header className="sticky top-0 z-40 border-b border-linea bg-papel/[0.85] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 md:min-h-[4.5rem] lg:px-8">
          <Link href="/admin" className="flex min-w-0 items-center gap-3 md:gap-4">
            <Marca logo="smt-blanco" tinta="var(--color-azul-profundo)" alto={34} />
            <span aria-hidden className="hidden h-8 w-px bg-linea sm:block" />
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-[0.94rem] font-semibold tracking-[-0.015em] text-tinta md:text-[1.02rem]">
                Panel de la subasta
              </span>
              <span className="hidden text-[0.78rem] text-gris sm:block">Subasta Solidaria · Cementerio del Oeste</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="group inline-flex min-h-11 items-center gap-2 px-2 text-[0.94rem] font-medium text-gris transition-colors duration-200 hover:text-tinta"
            >
              Ver el sitio
              <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Suspense fallback={null}>
              <Sesion />
            </Suspense>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <FranjaEjemplo />
      </Suspense>
      <div className="flex flex-1 flex-col bg-papel/[0.93]">{children}</div>
    </div>
  );
}

async function Sesion() {
  const admin = await adminActual();
  if (!admin) return null;
  return (
    <form action={salirDelPanel} className="flex items-center gap-3 border-l border-linea pl-3 sm:pl-4">
      <span className="hidden text-[0.94rem] font-medium text-tinta sm:inline">{admin.nombre}</span>
      <button type="submit" className="inline-flex min-h-10 items-center rounded-md bg-white px-4 text-[0.94rem] font-semibold text-tinta ring-1 ring-[#cfd3d8] transition-[box-shadow] duration-200 ring-inset hover:ring-tinta">
        Salir
      </button>
    </form>
  );
}
