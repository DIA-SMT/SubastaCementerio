import type { Metadata } from "next";
import { Suspense } from "react";
import { Plazo } from "@/components/Plazo";
import { RefrescoPeriodico } from "@/components/RefrescoPeriodico";
import { TarjetaObra } from "@/components/TarjetaObra";
import { TituloSeccion } from "@/components/TituloSeccion";
import { usuarioActual } from "@/lib/auth";
import { estadoSubasta, listarObras } from "@/lib/datos/publico";

export const metadata: Metadata = { title: "Obras" };

export default function Catalogo() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <TituloSeccion nivel={1}>Las obras</TituloSeccion>
      <Suspense fallback={<EsqueletoCatalogo />}>
        <Listado />
      </Suspense>
    </div>
  );
}

async function Listado() {
  const usuario = await usuarioActual();
  const [estado, obras] = await Promise.all([estadoSubasta(), listarObras(usuario?.id)]);
  return (
    <>
      <div className="mt-4 rounded-2xl bg-fondo p-4">
        <Plazo estado={estado} />
      </div>
      {obras.length === 0 ? (
        <p className="mt-8 text-lg">Todavía no hay obras publicadas.</p>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {obras.map((obra, i) => (
            <li key={obra.id}>
              <TarjetaObra obra={obra} fase={estado.fase} prioridad={i < 2} />
            </li>
          ))}
        </ul>
      )}
      {estado.fase === "abierta" && <RefrescoPeriodico segundos={30} />}
    </>
  );
}

function EsqueletoCatalogo() {
  return (
    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando obras">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="aspect-[4/6] animate-pulse rounded-2xl bg-linea" />
      ))}
    </ul>
  );
}
