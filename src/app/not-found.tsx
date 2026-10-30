import { AvisoNoEncontrada } from "@/components/AvisoNoEncontrada";
import { Encabezado } from "@/components/Encabezado";
import { FondoSala } from "@/components/FondoSala";
import { Pie } from "@/components/Pie";

// Direcciones que no existen fuera del sitio público: acá no hay layout que ponga encabezado y pie.
export default function NoEncontrada() {
  return (
    <div className="flex flex-1 flex-col">
      <FondoSala />
      <Encabezado />
      <main id="contenido" className="flex-1 bg-papel/[0.93]">
        <AvisoNoEncontrada />
      </main>
      <Pie />
    </div>
  );
}
