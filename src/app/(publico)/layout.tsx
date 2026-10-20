import { Suspense } from "react";
import { FranjaEjemplo } from "@/components/Avisos";
import { Encabezado } from "@/components/Encabezado";
import { Pie } from "@/components/Pie";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <>
      <Encabezado />
      <Suspense fallback={null}>
        <FranjaEjemplo />
      </Suspense>
      <main id="contenido" className="flex-1 pb-24 md:pb-32">
        {children}
      </main>
      <Pie />
    </>
  );
}
