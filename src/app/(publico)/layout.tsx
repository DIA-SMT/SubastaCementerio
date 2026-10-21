import { Suspense } from "react";
import { FranjaEjemplo } from "@/components/Avisos";
import { Encabezado } from "@/components/Encabezado";
import { FondoSala } from "@/components/FondoSala";
import { Pie } from "@/components/Pie";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <div className="sitio flex flex-1 flex-col">
      <FondoSala />
      <Encabezado />
      <Suspense fallback={null}>
        <FranjaEjemplo />
      </Suspense>
      {/* El velo de las páginas interiores lo pone (interior)/layout.tsx; la portada maneja sus capas. */}
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <Pie />
    </div>
  );
}
