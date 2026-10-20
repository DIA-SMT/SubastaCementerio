import type { Fase } from "@/lib/datos/tipos";

const ESTADOS: Record<Fase, { texto: string; punto: string }> = {
  abierta: { texto: "Abierta", punto: "bg-verde" },
  cerrada: { texto: "Cerrada", punto: "bg-gris-suave" },
  antes: { texto: "Próximamente", punto: "bg-ambar" },
  por_confirmar: { texto: "Fechas a confirmar", punto: "bg-ambar" },
};

/** Estado de la subasta: punto de color y texto en tinta, sin caja (contraste AA). */
export function EstadoChip({ fase, texto }: { fase: Fase; texto?: string }) {
  const e = ESTADOS[fase];
  return (
    <span className="inline-flex items-center gap-2 text-[0.85rem] font-medium text-tinta">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.punto}`} />
      {texto ?? e.texto}
    </span>
  );
}
