import { notFound } from "next/navigation";
import { Suspense } from "react";
import { obtenerPagina } from "@/lib/datos/publico";
import type { SlugPagina } from "@/lib/datos/tipos";
import { AvisoProvisorio } from "./Avisos";
import { Cabecera } from "./Cabecera";
import { Markdown } from "./Markdown";

/** Páginas con texto editable desde el panel (cómo participar, bases, destino, privacidad). */
export function PaginaInformativa({ slug }: { slug: SlugPagina }) {
  return (
    <Suspense fallback={<div className="fondo-institucional h-56" aria-busy="true" />}>
      <Contenido slug={slug} />
    </Suspense>
  );
}

async function Contenido({ slug }: { slug: SlugPagina }) {
  const pagina = await obtenerPagina(slug);
  if (!pagina) notFound();
  return (
    <>
      <Cabecera antetitulo="Subasta solidaria" titulo={pagina.titulo} compacta />
      <article className="relative z-10 mx-auto -mt-12 max-w-3xl px-4">
        <div className="superficie-tarjeta p-6 md:p-10">
          {pagina.provisorio && (
            <div className="mb-6">
              <AvisoProvisorio />
            </div>
          )}
          <Markdown texto={pagina.contenido} />
        </div>
      </article>
    </>
  );
}
