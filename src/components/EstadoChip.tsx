import type { Fase } from "@/lib/datos/tipos";

const ESTADOS: Record<Fase, { texto: string; clases: string; punto: string }> = {
  abierta: { texto: "Abierta", clases: "bg-verde-suave", punto: "bg-verde" },
  cerrada: { texto: "Cerrada", clases: "bg-linea", punto: "bg-gris" },
  antes: { texto: "Próximamente", clases: "bg-ambar-suave", punto: "bg-ambar" },
  por_confirmar: { texto: "Fechas a confirmar", clases: "bg-ambar-suave", punto: "bg-ambar" },
};

/** Estado de la obra. El color va de fondo; el texto siempre en tinta (contraste AA). */
export function EstadoChip({ fase }: { fase: Fase }) {
  const e = ESTADOS[fase];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-bold text-tinta ${e.clases}`}>
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${e.punto}`} />
      {e.texto}
    </span>
  );
}
