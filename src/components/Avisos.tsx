import { estadoSubasta } from "@/lib/datos/publico";

export { AvisoProvisorio, Recuadro } from "./Recuadros";

/** Franja que aparece en todo el sitio mientras se muestran datos de ejemplo. */
export async function FranjaEjemplo() {
  const { modoEjemplo } = await estadoSubasta();
  if (!modoEjemplo) return null;
  return (
    <div role="note" className="border-b-4 border-ambar bg-ambar-suave">
      <p className="mx-auto max-w-6xl px-4 py-2 text-center font-bold text-tinta">
        Datos de ejemplo: las obras, artistas y ofertas que ves no son reales.
      </p>
    </div>
  );
}
