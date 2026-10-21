import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PiePanel } from "@/components/admin/PiePanel";
import { IngresoDividido } from "@/components/IngresoDividido";
import { adminActual } from "@/lib/admin/sesion";
import { FormularioIngresoPanel } from "./FormularioIngresoPanel";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPanel() {
  return (
    <main id="contenido" className="flex-1 pb-8">
      <IngresoDividido
        antetitulo="Panel de la subasta"
        titulo="Ingreso del equipo"
        bajada="Solo para el equipo autorizado de la Dirección de Cementerios."
        imagen="galeria"
      >
        <Suspense fallback={null}>
          <SiYaIngreso />
        </Suspense>
        <FormularioIngresoPanel />
      </IngresoDividido>
      <div className="contenedor">
        <PiePanel />
      </div>
    </main>
  );
}

async function SiYaIngreso() {
  if (await adminActual()) redirect("/admin");
  return null;
}
