import { notFound } from "next/navigation";
import { Suspense } from "react";
import { obtenerPagina } from "@/lib/datos/publico";
import type { SlugPagina } from "@/lib/datos/tipos";
import { AvisoProvisorio } from "./Avisos";
import { Cabecera, Columna } from "./Cabecera";
import { Markdown } from "./Markdown";

/** Páginas con texto editable desde el panel (cómo participar, bases, destino, privacidad). */
export function PaginaInformativa({ slug }: { slug: SlugPagina }) {
  return (
    <Suspense fallback={<EsqueletoPagina />}>
      <Contenido slug={slug} />
    </Suspense>
  );
}

async function Contenido({ slug }: { slug: SlugPagina }) {
  const pagina = await obtenerPagina(slug);
  if (!pagina) notFound();
  return (
    <>
      <Cabecera antetitulo="Subasta Solidaria" titulo={pagina.titulo} />
      <Columna>
        {pagina.provisorio && (
          <div className="mb-8">
            <AvisoProvisorio />
          </div>
        )}
        <article className="border-t border-tinta pt-8 md:pt-10">
          <Markdown texto={pagina.contenido} />
        </article>
      </Columna>
    </>
  );
}

function EsqueletoPagina() {
  return (
    <Columna>
      <div className="space-y-4 pt-10 md:pt-16" aria-busy="true">
        <div className="esqueleto h-4 w-32" />
        <div className="esqueleto h-14 w-2/3" />
        <div className="esqueleto mt-10 h-64" />
      </div>
    </Columna>
  );
}
