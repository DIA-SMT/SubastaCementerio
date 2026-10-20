import type { ReactNode } from "react";

/** Título de sección con la barrita vertical azul-celeste. */
export function TituloSeccion({
  children,
  nivel = 2,
  id,
}: {
  children: ReactNode;
  nivel?: 1 | 2 | 3;
  id?: string;
}) {
  const Etiqueta = `h${nivel}` as const;
  const tamano = nivel === 1 ? "text-3xl md:text-4xl" : nivel === 2 ? "text-2xl" : "text-xl";
  return (
    <Etiqueta id={id} className={`flex items-stretch gap-3 ${tamano}`}>
      <span aria-hidden className="w-1.5 shrink-0 rounded-full bg-linear-to-b from-azul to-celeste" />
      <span>{children}</span>
    </Etiqueta>
  );
}
