import type { Metadata } from "next";
import { Suspense } from "react";
import { Esqueleto, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { buscarOferentes } from "@/lib/datos/admin/oferentes";
import { BuscadorOferentes } from "./BuscadorOferentes";

export const metadata: Metadata = { title: "Oferentes" };

export default function Pagina() {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Oferentes"
        bajada="Personas registradas para ofertar. Sus datos personales solo se ven en el panel: no los copies en mensajes ni planillas fuera del equipo."
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

// El listado completo sale del servidor. La búsqueda va por POST (ver BuscadorOferentes):
// la dirección no lleva el texto buscado, que puede ser un DNI o un correo.
async function Contenido() {
  const admin = await requerirAdmin();
  const todos = await buscarOferentes(admin, "");
  return <BuscadorOferentes todos={todos} />;
}
