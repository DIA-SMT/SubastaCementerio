import type { ReactNode } from "react";

/** Título de sección editorial, con antetítulo opcional encima. */
export function TituloSeccion({
  children,
  nivel = 2,
  id,
  antetitulo,
}: {
  children: ReactNode;
  nivel?: 1 | 2 | 3;
  id?: string;
  antetitulo?: ReactNode;
}) {
  const Etiqueta = `h${nivel}` as const;
  const tamano = nivel === 1 ? "text-titulo" : nivel === 2 ? "text-seccion" : "text-subtitulo";
  return (
    <div>
      {antetitulo && <p className="antetitulo mb-3">{antetitulo}</p>}
      <Etiqueta id={id} className={tamano}>
        {children}
      </Etiqueta>
    </div>
  );
}
