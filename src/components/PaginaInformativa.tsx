import { notFound } from "next/navigation";
import { Suspense } from "react";
import { obtenerPagina } from "@/lib/datos/publico";
import type { SlugPagina } from "@/lib/datos/tipos";
import { AvisoProvisorio } from "./Avisos";
import { Markdown } from "./Markdown";
import { TituloSeccion } from "./TituloSeccion";

/** Páginas con texto editable desde el panel (cómo participar, bases, destino, privacidad). */
export function PaginaInformativa({ slug }: { slug: SlugPagina }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-linea" aria-busy="true" />}>
        <Contenido slug={slug} />
      </Suspense>
    </div>
  );
}

async function Contenido({ slug }: { slug: SlugPagina }) {
  const pagina = await obtenerPagina(slug);
  if (!pagina) notFound();
  return (
    <article>
      <TituloSeccion nivel={1}>{pagina.titulo}</TituloSeccion>
      {pagina.provisorio && (
        <div className="mt-5">
          <AvisoProvisorio />
        </div>
      )}
      <div className="mt-6">
        <Markdown texto={pagina.contenido} />
      </div>
    </article>
  );
}
