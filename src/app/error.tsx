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
      <header className="border-b border-linea bg-white">
        <div className="contenedor flex h-16 items-center md:h-[4.5rem]">
          <p className="font-display text-[1.02rem] font-semibold tracking-[-0.015em] text-tinta">
            Subasta Solidaria <span className="font-sans text-[0.85rem] font-normal tracking-normal text-gris">· Cementerio del Oeste</span>
          </p>
        </div>
      </header>
      <main id="contenido" className="flex-1">
        <div className="mx-auto box-content max-w-xl px-4 py-16 sm:px-6 md:py-24">
          <TituloSeccion nivel={1} antetitulo={"Error"}>Algo salió mal</TituloSeccion>
          <p className="mt-5 text-lg text-texto">No pudimos cargar esta página. Probá de nuevo en unos segundos.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
