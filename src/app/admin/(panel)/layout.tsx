import Link from "next/link";
import { Suspense } from "react";
import { FranjaEjemplo } from "@/components/Avisos";
import { IconoSalir, IconoVer } from "@/components/Iconos";
import { Marca } from "@/components/Marca";
import { Esqueleto } from "@/components/admin/Panel";
import { BotonMenuPanel, NavPanel, NavPanelBase } from "@/components/admin/NavPanel";
import { PiePanel } from "@/components/admin/PiePanel";
import { GuiaPanel } from "@/components/admin/Recorrido";
import { adminActual, requerirAdmin } from "@/lib/admin/sesion";
import { salirDelPanel } from "../acciones";

/**
 * Estructura del panel: menú lateral en azul noche municipal con el logo a color, barra superior
 * blanca con el nombre de la muestra y la sesión, y el contenido sobre blanco cálido.
 * Primera barrera: sin sesión del equipo, redirige al ingreso. Cada página, acción y ruta de
 * descarga vuelve a verificar con requerirAdmin().
 */
export default function LayoutPanel({ children }: LayoutProps<"/admin">) {
  const logos = { logo: <Marca logo="smt-color" alto={42} />, isologo: <Marca logo="muni-iso" alto={36} /> };
  return (
    <div className="flex flex-1">
      <Suspense fallback={<NavPanelBase {...logos} />}>
        <NavPanel {...logos} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior />
        <Suspense fallback={null}>
          <FranjaEjemplo />
        </Suspense>
        <main id="contenido" className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-4 pt-6 pb-8 md:px-6 lg:px-10 lg:pt-8">
          <div className="contenido-panel">
            <Suspense fallback={<Esqueleto />}>
              <Guardia>{children}</Guardia>
            </Suspense>
          </div>
          <div className="mt-auto">
            <PiePanel />
          </div>
        </main>
      </div>
    </div>
  );
}

async function Guardia({ children }: { children: React.ReactNode }) {
  await requerirAdmin();
  return children;
}

function BarraSuperior() {
  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-white/[0.88] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-2 px-4 sm:gap-3 md:px-6 lg:h-[4.5rem] lg:px-10">
        <BotonMenuPanel />
        <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-sm">
          <span className="hidden shrink-0 sm:block lg:hidden">
            <Marca logo="muni-iso" alto={30} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[1rem] font-semibold tracking-[-0.02em] text-marino sm:text-[1.08rem] md:text-[1.2rem]">
              Memorias del futuro
            </span>
            <span className="hidden truncate text-[0.8rem] text-gris sm:block">Subasta Solidaria · Cementerio del Oeste</span>
          </span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Suspense fallback={null}>
            <Sesion />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function Sesion() {
  const admin = await adminActual();
  if (!admin) return null;
  const inicial = admin.nombre.trim().charAt(0).toUpperCase();
  return (
    <>
      {/* Recorrido guiado: solo con sesión del equipo. */}
      <GuiaPanel />
      <Link
        href="/"
        className="hidden min-h-10 items-center gap-2 rounded-md px-2.5 text-[0.94rem] font-medium text-gris transition-colors duration-200 hover:text-tinta xl:inline-flex"
      >
        <IconoVer className="text-[1.15rem]" />
        Ver el sitio
      </Link>
      <form action={salirDelPanel} className="flex items-center gap-3 border-l border-linea pl-2 sm:pl-4">
        {inicial && (
          <span
            aria-hidden
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marino text-[0.95rem] font-semibold text-white ring-2 ring-smt-suave sm:flex"
          >
            {inicial}
          </span>
        )}
        <span className="hidden min-w-0 leading-tight xl:block">
          <span className="block max-w-44 truncate text-[0.92rem] font-semibold text-tinta">{admin.nombre}</span>
          <span className="block max-w-44 truncate text-[0.78rem] text-gris">{admin.email}</span>
        </span>
        <button type="submit" className="boton-tabla">
          <IconoSalir className="text-[1.05rem]" />
          <span className="max-sm:sr-only">Salir</span>
        </button>
      </form>
    </>
  );
}
