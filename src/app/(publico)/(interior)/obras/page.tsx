import type { Metadata } from "next";
import { Suspense } from "react";
import { IconoObra } from "@/components/Iconos";
import { PlazoCompacto } from "@/components/Plazo";
import { RefrescoPeriodico } from "@/components/RefrescoPeriodico";
import { TarjetaObra } from "@/components/TarjetaObra";
import { usuarioActual } from "@/lib/auth";
import { estadoSubasta, listarObras } from "@/lib/datos/publico";

export const metadata: Metadata = { title: "Obras" };

export default function Catalogo() {
  return (
    <Suspense fallback={<EsqueletoCatalogo />}>
      <Listado />
    </Suspense>
  );
}

async function Listado() {
  const usuario = await usuarioActual();
  const [estado, obras] = await Promise.all([estadoSubasta(), listarObras(usuario?.id)]);
  return (
    <>
      <header className="contenedor pt-10 pb-10 md:pt-16 md:pb-14">
        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="antetitulo">Catálogo</p>
            <h1 className="mt-3 text-titulo">Las obras</h1>
            <p className="mt-5 max-w-xl text-lg text-texto">
              {obras.length} cabezas escultóricas intervenidas por artistas locales. Elegí una para ver sus fotos, su
              historia y ofertar.
            </p>
          </div>
          <div className="lg:col-span-5 lg:justify-self-end">
            <PlazoCompacto estado={estado} />
          </div>
        </div>
      </header>

      <div className="contenedor">
        {obras.length === 0 ? (
          <div className="flex flex-col items-center border-t border-tinta py-24 text-center">
            <IconoObra className="text-4xl text-gris-suave" />
            <h2 className="mt-5 text-subtitulo">Todavía no hay obras publicadas</h2>
            <p className="mt-2 max-w-md text-gris">Cuando el equipo las publique, las vas a ver acá.</p>
          </div>
        ) : (
          <>
            <p className="flex items-center justify-between gap-4 border-t border-tinta py-4 text-[0.88rem] text-gris">
              <span>
                {obras.length} {obras.length === 1 ? "obra" : "obras"}
              </span>
              <span>Por número de obra</span>
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
              {obras.map((obra, i) => (
                <li key={obra.id} className={i < 6 ? "" : "revelar"}>
                  <TarjetaObra obra={obra} fase={estado.fase} prioridad={i < 3} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {estado.fase === "abierta" && <RefrescoPeriodico segundos={30} />}
    </>
  );
}

function EsqueletoCatalogo() {
  return (
    <div aria-busy="true" aria-label="Cargando obras">
      <div className="contenedor space-y-4 pt-10 pb-10 md:pt-16 md:pb-14">
        <div className="esqueleto h-4 w-24" />
        <div className="esqueleto h-14 w-72" />
        <div className="esqueleto h-6 w-full max-w-xl" />
      </div>
      <ul className="contenedor grid grid-cols-2 gap-x-3.5 gap-y-8 border-t border-linea pt-8 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-lg bg-white ring-1 ring-linea">
            <div className="esqueleto aspect-[4/5] rounded-none" />
            <div className="space-y-2.5 p-5">
              <div className="esqueleto h-4 w-16" />
              <div className="esqueleto h-5 w-3/4" />
              <div className="esqueleto h-4 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
