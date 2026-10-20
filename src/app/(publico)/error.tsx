"use client";

import Link from "next/link";
import { TituloSeccion } from "@/components/TituloSeccion";

// Errores de las páginas del sitio: se muestran dentro del layout público (encabezado, pie y
// main#contenido). retry() vuelve a pedir los datos al servidor; reset() solo redibujaría.
export default function ErrorDelSitio({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto box-content max-w-xl px-4 py-16 sm:px-6 md:py-24">
      <TituloSeccion nivel={1} antetitulo={"Error"}>Algo salió mal</TituloSeccion>
      <p className="mt-5 text-lg text-texto">No pudimos cargar esta página. Probá de nuevo en unos segundos.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className="boton-primario">
          Probar de nuevo
        </button>
        <Link href="/obras" className="boton-secundario">
          Ver las obras
        </Link>
        <Link href="/" className="boton-secundario">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
