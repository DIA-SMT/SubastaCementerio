import type { ReactNode } from "react";

const ANCHOS = {
  angosto: "max-w-xl",
  medio: "max-w-3xl",
} as const;

/**
 * Cabecera editorial de las páginas interiores, sobre el blanco cálido: antetítulo, título y
 * bajada. Va alineada con la columna de contenido de la página (angosta para formularios,
 * media para textos).
 */
export function Cabecera({
  titulo,
  antetitulo,
  bajada,
  ancho = "medio",
}: {
  titulo: ReactNode;
  antetitulo?: ReactNode;
  bajada?: ReactNode;
  ancho?: keyof typeof ANCHOS;
}) {
  return (
    <header className={`mx-auto px-4 pt-10 pb-8 md:pt-16 md:pb-10 ${ANCHOS[ancho]} box-content sm:px-6`}>
      {antetitulo && <p className="antetitulo">{antetitulo}</p>}
      <h1 className="mt-3 text-titulo">{titulo}</h1>
      {bajada && <div className="mt-4 text-lg text-texto">{bajada}</div>}
    </header>
  );
}

/** Columna de contenido alineada con la Cabecera del mismo ancho. */
export function Columna({ ancho = "medio", children }: { ancho?: keyof typeof ANCHOS; children: ReactNode }) {
  return <div className={`mx-auto box-content px-4 sm:px-6 ${ANCHOS[ancho]}`}>{children}</div>;
}
