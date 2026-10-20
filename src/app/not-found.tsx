import { AvisoNoEncontrada } from "@/components/AvisoNoEncontrada";
import { Encabezado } from "@/components/Encabezado";
import { Pie } from "@/components/Pie";

// Direcciones que no existen fuera del sitio público: acá no hay layout que ponga encabezado y pie.
export default function NoEncontrada() {
  return (
    <>
      <Encabezado />
      <main id="contenido" className="flex-1">
        <AvisoNoEncontrada />
      </main>
      <Pie />
    </>
  );
}
