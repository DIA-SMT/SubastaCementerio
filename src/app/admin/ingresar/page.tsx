import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FranjaEjemplo } from "@/components/Avisos";
import { IconoAnterior } from "@/components/Iconos";
import { Marca } from "@/components/Marca";
import { PiePanel } from "@/components/admin/PiePanel";
import { adminActual } from "@/lib/admin/sesion";
import { FormularioIngresoPanel } from "./FormularioIngresoPanel";

export const metadata: Metadata = { title: "Ingresar" };

/**
 * Ingreso del equipo en dos mitades: a la izquierda, la imagen patrimonial con el logo a color sobre
 * azul noche; a la derecha, el formulario. En el celular, la imagen queda como franja arriba.
 * La imagen es ilustrativa (paquete de recursos de la muestra) y lo dice su leyenda: cuando haya
 * fotografías reales y autorizadas del Cementerio del Oeste, se reemplaza acá.
 */
export default function IngresarPanel() {
  return (
    <main id="contenido" className="grid flex-1 lg:min-h-dvh lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)]">
      <section className="fondo-marino relative isolate flex flex-col overflow-hidden px-5 py-5 sm:min-h-80 sm:px-8 sm:py-6 lg:min-h-0 lg:px-12 lg:py-10">
        <Image
          src="/assets/memorias/fotografia/galeria-arcos.jpg"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="-z-20 object-cover object-[50%_40%]"
        />
        {/* Velo en azul noche, más denso abajo (donde va el texto), y una luz celeste muy suave arriba. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-marino via-marino/75 to-marino/25" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(60_180_240/0.28),transparent)]"
        />

        {/* El contenedor evita que el logo se estire a todo el ancho de la columna. */}
        <div className="self-start">
          <Marca logo="smt-color" alto={48} />
        </div>

        <div className="mt-auto max-w-lg pt-6 sm:pt-10">
          <p className="hidden items-center gap-2.5 text-[0.74rem] font-semibold tracking-[0.2em] text-marino-tenue uppercase sm:flex">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amarillo" />
            Subasta solidaria
          </p>
          <p className="font-display text-[clamp(1.75rem,1.3rem+2vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-white sm:mt-3">
            Memorias del futuro
          </p>
          <p className="mt-3 hidden text-white/85 sm:block lg:text-lg">Artistas en diálogo con el patrimonio · Cementerio del Oeste</p>
          <p className="mt-3 max-w-sm text-[0.78rem] text-marino-tenue sm:mt-6 lg:mt-10">
            Imagen ilustrativa. No es una fotografía del Cementerio del Oeste ni de las obras de la muestra.
          </p>
        </div>
      </section>

      <section className="flex flex-col">
        <Suspense fallback={null}>
          <FranjaEjemplo />
        </Suspense>
        <div className="flex flex-1 flex-col px-4 pt-8 pb-8 sm:px-8 sm:pt-10 lg:px-14">
          <div className="mx-auto w-full max-w-md lg:my-auto">
            <p className="flex items-center gap-2.5 text-[0.74rem] font-semibold tracking-[0.14em] text-smt-intenso uppercase">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amarillo ring-2 ring-amarillo/30" />
              Panel de la subasta
            </p>
            <h1 className="mt-3 text-[clamp(1.9rem,1.6rem+1vw,2.5rem)] leading-[1.08] tracking-[-0.025em] text-marino">Ingreso del equipo</h1>
            <p className="mt-3 text-gris">Solo para el equipo autorizado de la Dirección de Cementerios.</p>
            <div className="tarjeta-panel mt-8 p-6 md:p-8">
              <Suspense fallback={null}>
                <SiYaIngreso />
              </Suspense>
              <FormularioIngresoPanel />
            </div>
            <p className="mt-6">
              <Link href="/" className="enlace-sutil text-[0.94rem] text-gris">
                <IconoAnterior />
                Volver al sitio
              </Link>
            </p>
          </div>
          <PiePanel />
        </div>
      </section>
    </main>
  );
}

async function SiYaIngreso() {
  if (await adminActual()) redirect("/admin");
  return null;
}
