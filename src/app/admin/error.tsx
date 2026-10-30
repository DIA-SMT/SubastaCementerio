"use client";

import Link from "next/link";
import { TituloSeccion } from "@/components/TituloSeccion";

// Errores del layout del panel (la verificación de la sesión, el menú) y del ingreso del
// equipo. Queda dentro del tema del panel, pero sin su menú ni su barra: lleva su propio main.
export default function ErrorDelPanel({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="contenido" className="flex-1">
      <div className="mx-auto max-w-xl px-4 py-16">
        <TituloSeccion nivel={1}>Algo salió mal</TituloSeccion>
        <p className="mt-4 text-lg">
          No pudimos cargar el panel. Probá de nuevo en unos segundos. Si el problema sigue,
          avisá al área técnica.
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
    </main>
  );
}
