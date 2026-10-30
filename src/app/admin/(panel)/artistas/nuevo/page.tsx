import type { Metadata } from "next";
import { Suspense } from "react";
import { Esqueleto, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { FormularioArtista } from "../FormularioArtista";

export const metadata: Metadata = { title: "Cargar un artista" };

export default function PaginaNuevoArtista() {
  return (
    <div className="space-y-6">
      <TituloPanel
        migas={[{ href: "/admin/artistas", texto: "Artistas" }]}
        titulo="Cargar un artista"
        bajada="Completá los datos. Cuando lo cargues, vas a poder subir su foto."
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  await requerirAdmin();
  return (
    <Tarjeta className="max-w-4xl">
      <FormularioArtista />
    </Tarjeta>
  );
}
