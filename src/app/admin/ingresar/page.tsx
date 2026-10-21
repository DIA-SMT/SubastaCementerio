import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PiePanel } from "@/components/admin/PiePanel";
import { adminActual } from "@/lib/admin/sesion";
import { FormularioIngresoPanel } from "./FormularioIngresoPanel";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPanel() {
  return (
    <main id="contenido" className="mx-auto box-content w-full max-w-md flex-1 px-4 pt-12 pb-8 sm:px-6 md:pt-20">
      <p className="antetitulo">Panel de la subasta</p>
      <h1 className="mt-3 text-titulo">Ingreso del equipo</h1>
      <p className="mt-4 text-lg text-texto">Solo para el equipo autorizado de la Dirección de Cementerios.</p>
      <div className="superficie-tarjeta mt-8 p-6 md:p-8">
        <Suspense fallback={null}>
          <SiYaIngreso />
        </Suspense>
        <FormularioIngresoPanel />
      </div>
      <PiePanel />
    </main>
  );
}

async function SiYaIngreso() {
  if (await adminActual()) redirect("/admin");
  return null;
}
