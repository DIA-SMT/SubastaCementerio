import { Marca } from "@/components/Marca";

/**
 * Pie compacto del panel. El pie del sitio (con sus enlaces públicos) no va acá: además, el menú
 * lateral queda fijo hasta el borde inferior de la pantalla y lo taparía.
 */
export function PiePanel() {
  return (
    <footer className="mt-16 flex flex-col gap-3 border-t border-linea pt-6 text-[0.85rem] text-gris sm:flex-row sm:items-center sm:justify-between">
      <p>Municipalidad de San Miguel de Tucumán · Dirección de Cementerios</p>
      <div className="flex items-center gap-3">
        <p>Desarrollado por la Dirección de Inteligencia Artificial</p>
        <Marca logo="ia" alto={26} />
      </div>
    </footer>
  );
}
