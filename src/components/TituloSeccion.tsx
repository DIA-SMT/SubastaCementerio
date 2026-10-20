import type { ReactNode } from "react";

/** Título de sección con la barrita vertical azul-celeste. Opcional: antetítulo encima. */
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
  const tamano = nivel === 1 ? "text-4xl md:text-5xl" : nivel === 2 ? "text-2xl md:text-3xl" : "text-xl";
  return (
    <div>
      {antetitulo && <p className="antetitulo mb-2 pl-4">{antetitulo}</p>}
      <Etiqueta id={id} className={`flex items-start gap-3 ${tamano}`}>
        <span aria-hidden className="mt-[0.18em] h-[0.85em] w-1 shrink-0 rounded-full bg-linear-to-b from-azul to-celeste" />
        <span>{children}</span>
      </Etiqueta>
    </div>
  );
}
