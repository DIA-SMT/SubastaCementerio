"use client";

import Link from "next/link";
import { TituloSeccion } from "@/components/TituloSeccion";

// Errores de las secciones del panel: se muestran dentro del menú y del main#contenido del
// panel. retry() vuelve a pedir los datos al servidor; reset() solo redibujaría.
export default function ErrorDeSeccion({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-xl">
      <TituloSeccion nivel={1}>Algo salió mal</TituloSeccion>
      <p className="mt-4 text-lg">
        No pudimos cargar esta sección del panel. Probá de nuevo en unos segundos. Si el problema
        sigue, avisá al área técnica.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className="boton-primario">
          Probar de nuevo
        </button>
        <Link href="/admin" className="boton-secundario">
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
