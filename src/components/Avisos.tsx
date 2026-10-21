import { estadoSubasta } from "@/lib/datos/publico";

export { Recuadro } from "./Recuadros";

/** Franja que aparece en todo el sitio mientras se muestran datos de ejemplo. */
export async function FranjaEjemplo() {
  const { modoEjemplo } = await estadoSubasta();
  if (!modoEjemplo) return null;
  return (
    <div role="note" className="border-b border-ambar/25 bg-ambar-suave">
      <p className="contenedor flex items-center justify-center gap-2.5 py-2 text-center text-[0.85rem] font-medium text-tinta">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ambar" />
        Datos de ejemplo: las obras, artistas y ofertas que ves no son reales.
      </p>
    </div>
  );
}
