import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconoObra } from "@/components/Iconos";
import { PlazoCompacto } from "@/components/Plazo";
import { RefrescoPeriodico } from "@/components/RefrescoPeriodico";
import { TarjetaObra } from "@/components/TarjetaObra";
import { usuarioActual } from "@/lib/auth";
import { estadoSubasta, listarObras } from "@/lib/datos/publico";
import type { ObraResumen } from "@/lib/datos/tipos";

export const metadata: Metadata = { title: "Obras" };

/** Filtros del catálogo (?ver=...). Sin parámetro, o con uno desconocido, se ven todas. */
const FILTROS = [
  { clave: "todas", texto: "Todas", incluye: () => true },
  { clave: "sin-ofertas", texto: "Sin ofertas", incluye: (o: ObraResumen) => o.ofertaActual == null },
  { clave: "con-ofertas", texto: "Con ofertas", incluye: (o: ObraResumen) => o.ofertaActual != null },
] as const;

export default function Catalogo({ searchParams }: PageProps<"/obras">) {
  return (
    <Suspense fallback={<EsqueletoCatalogo />}>
      <Listado searchParams={searchParams} />
    </Suspense>
  );
}

async function Listado({ searchParams }: Pick<PageProps<"/obras">, "searchParams">) {
  const { ver } = await searchParams;
  const filtro = FILTROS.find((f) => f.clave === ver) ?? FILTROS[0];
  const usuario = await usuarioActual();
  const [estado, todas] = await Promise.all([estadoSubasta(), listarObras(usuario?.id)]);
  const obras = todas.filter(filtro.incluye);
  return (
    <>
      <header className="contenedor pt-10 pb-10 md:pt-16 md:pb-14">
        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="antetitulo">Catálogo</p>
            <span aria-hidden className="filete mt-4" />
            <h1 className="mt-5 text-titulo">Las obras</h1>
            <p className="mt-5 max-w-xl text-lg text-texto">
              {todas.length} cabezas escultóricas intervenidas por artistas locales. Elegí una para ver sus fotos, su
              historia y ofertar.
            </p>
          </div>
          <div className="lg:col-span-5 lg:justify-self-end">
            <PlazoCompacto estado={estado} />
          </div>
        </div>
      </header>

      <div className="contenedor">
        {todas.length === 0 ? (
          <div className="flex flex-col items-center border-t border-tinta py-24 text-center">
            <IconoObra className="text-4xl text-gris-suave" />
            <h2 className="mt-5 text-subtitulo">Todavía no hay obras publicadas</h2>
            <p className="mt-2 max-w-md text-gris">Cuando el equipo las publique, las vas a ver acá.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-tinta py-4 text-[0.88rem] text-gris">
              <nav aria-label="Filtrar obras">
                <ul className="flex flex-wrap gap-2">
                  {FILTROS.map((f) => (
                    <li key={f.clave}>
                      <Link
                        href={f.clave === "todas" ? "/obras" : `/obras?ver=${f.clave}`}
                        aria-current={f === filtro ? "page" : undefined}
                        scroll={false}
                        className="inline-flex min-h-10 items-center rounded-full px-4 font-medium text-texto ring-1 ring-linea transition-colors duration-200 ring-inset hover:text-tinta hover:ring-tinta aria-[current=page]:bg-smt aria-[current=page]:text-white aria-[current=page]:ring-smt"
                      >
                        {f.texto}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <span aria-live="polite">
                {obras.length} {obras.length === 1 ? "obra" : "obras"} · por número de obra
              </span>
            </div>
            {obras.length === 0 && (
              <p className="py-16 text-center text-texto">
                Ninguna obra coincide con este filtro.{" "}
                <Link href="/obras" className="enlace">
                  Ver todas las obras
                </Link>
              </p>
            )}
            <ul className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
              {obras.map((obra, i) => (
                <li key={obra.id} className={i < 6 ? "" : "revelar"}>
                  <TarjetaObra obra={obra} fase={obra.fase} prioridad={i < 3} />
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
