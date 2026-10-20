import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecera } from "@/components/Cabecera";
import { PlazoDestacado } from "@/components/Plazo";
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
      <Cabecera
        antetitulo="Catálogo"
        titulo="Las obras"
        bajada={`${obras.length} cabezas escultóricas intervenidas por artistas locales. Tocá una para ver sus fotos, su historia y ofertar.`}
        lateral={<PlazoDestacado estado={estado} claro />}
      />
      <div className="mx-auto max-w-6xl px-4 pt-10">
        {obras.length === 0 ? (
          <p className="superficie-tarjeta p-6 text-lg">Todavía no hay obras publicadas.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {obras.map((obra, i) => (
              <li key={obra.id}>
                <TarjetaObra obra={obra} fase={estado.fase} prioridad={i < 3} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {estado.fase === "abierta" && <RefrescoPeriodico segundos={30} />}
    </>
  );
}

function EsqueletoCatalogo() {
  return (
    <>
      <div className="fondo-institucional h-56" aria-busy="true" />
      <ul className="mx-auto grid max-w-6xl gap-6 px-4 pt-10 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando obras">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="aspect-[4/6] animate-pulse rounded-3xl bg-linea" />
        ))}
      </ul>
    </>
  );
}
