import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { adminActual } from "@/lib/admin/sesion";
import { FormularioIngresoPanel } from "./FormularioIngresoPanel";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPanel() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="flex items-stretch gap-3 text-3xl">
        <span aria-hidden className="w-1.5 shrink-0 rounded-full bg-linear-to-b from-azul to-celeste" />
        <span>Ingreso del equipo</span>
      </h1>
      <p className="mt-3 text-lg">Solo para el equipo autorizado de la Dirección de Cementerios.</p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <SiYaIngreso />
        </Suspense>
        <FormularioIngresoPanel />
      </div>
    </main>
  );
}

async function SiYaIngreso() {
  if (await adminActual()) redirect("/admin");
  return null;
}
