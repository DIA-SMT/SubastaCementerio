import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FranjaEjemplo } from "@/components/Avisos";
import { Marca } from "@/components/Marca";
import { Pie } from "@/components/Pie";
import { adminActual } from "@/lib/admin/sesion";
import { salirDelPanel } from "./acciones";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel de la subasta" },
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="fondo-institucional text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" aria-label="Ciudad SMT, inicio del panel">
              <Marca logo="smt-blanco" claro />
            </Link>
            <p className="text-lg font-extrabold">Panel de la subasta</p>
          </div>
          {/* A la derecha el degradé es más claro: todo en texto grande (20 px en negrita), que pide 3:1. */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-white underline underline-offset-4">
              Ver el sitio
            </Link>
            <Suspense fallback={null}>
              <Sesion />
            </Suspense>
          </div>
        </div>
        <div aria-hidden className="flex h-1.5">
          <span className="w-[22%] bg-amarillo" />
          <span className="flex-1 bg-celeste" />
        </div>
      </header>
      <Suspense fallback={null}>
        <FranjaEjemplo />
      </Suspense>
      {children}
      <Pie />
    </>
  );
}

async function Sesion() {
  const admin = await adminActual();
  if (!admin) return null;
  return (
    <form action={salirDelPanel} className="flex items-center gap-3">
      <span className="hidden text-lg font-bold sm:inline">{admin.nombre}</span>
      <button type="submit" className="min-h-11 rounded-lg border-2 border-white px-3 text-lg font-bold text-white hover:bg-azul-oscuro focus-visible:bg-azul-oscuro">
        Salir
      </button>
    </form>
  );
}
