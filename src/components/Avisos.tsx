import { estadoSubasta } from "@/lib/datos/publico";

export { AvisoProvisorio, PastillaProvisorio, Recuadro } from "./Recuadros";

/** Franja que aparece en todo el sitio mientras se muestran datos de ejemplo. */
export async function FranjaEjemplo() {
  const { modoEjemplo } = await estadoSubasta();
  if (!modoEjemplo) return null;
  return (
    <div role="note" className="bg-ambar-suave">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-base font-bold text-tinta">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-ambar" />
        Datos de ejemplo: las obras, artistas y ofertas que ves no son reales.
      </p>
    </div>
  );
}
