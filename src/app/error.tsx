"use client";

import Link from "next/link";
import { TituloSeccion } from "@/components/TituloSeccion";

// Último recurso: errores en los layouts del sitio o del panel (que este límite reemplaza).
// Los errores de las páginas los toman (publico)/error.tsx, admin/error.tsx y
// admin/(panel)/error.tsx, que conservan el encabezado y el pie. Acá no se puede usar
// Encabezado ni Pie: Marca lee los logos del disco y este es un componente de cliente.
export default function ErrorGeneral({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <header className="fondo-institucional text-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <p className="text-lg font-extrabold">Subasta solidaria · Cementerio del Oeste</p>
        </div>
        <div aria-hidden className="flex h-1.5">
          <span className="w-[22%] bg-amarillo" />
          <span className="flex-1 bg-celeste" />
        </div>
      </header>
      <main id="contenido" className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-16">
          <TituloSeccion nivel={1}>Algo salió mal</TituloSeccion>
          <p className="mt-4 text-lg">No pudimos cargar esta página. Probá de nuevo en unos segundos.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => retry()} className="boton-primario">
              Probar de nuevo
            </button>
            <Link href="/" className="boton-secundario">
              Ir al inicio
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
