import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Esqueleto, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { opcionesDeArtistas } from "@/lib/datos/admin/artistas";
import { precioSalidaGeneral, siguienteNumeroLibre } from "@/lib/datos/admin/obras";
import { FormularioObra } from "../FormularioObra";

export const metadata: Metadata = { title: "Nueva obra" };

export default function PaginaNuevaObra() {
  return (
    <div className="space-y-6">
      <TituloPanel
        migas={[{ href: "/admin/obras", texto: "Obras" }]}
        titulo="Nueva obra"
        bajada="Completá los datos y elegí la foto principal. Las demás fotos se cargan después de crear la obra."
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const admin = await requerirAdmin();
  const [artistas, precioGeneral, numeroSugerido] = await Promise.all([
    opcionesDeArtistas(admin),
    precioSalidaGeneral(admin),
    siguienteNumeroLibre(admin),
  ]);

  if (artistas.length === 0) {
    return (
      <Tarjeta>
        <p className="text-lg">Antes de cargar una obra, cargá al menos un artista.</p>
        <p className="mt-4">
          <Link href="/admin/artistas/nuevo" className="boton-primario">
            Cargar un artista
          </Link>
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="max-w-4xl">
      <FormularioObra artistas={artistas} precioGeneral={precioGeneral} numeroSugerido={numeroSugerido ?? undefined} />
    </Tarjeta>
  );
}
