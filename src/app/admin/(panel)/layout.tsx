import { Suspense } from "react";
import { Esqueleto } from "@/components/admin/Panel";
import { NavPanel, NavPanelBase } from "@/components/admin/NavPanel";
import { PiePanel } from "@/components/admin/PiePanel";
import { requerirAdmin } from "@/lib/admin/sesion";

// Primera barrera: sin sesión del equipo, redirige al ingreso. Cada página, acción y
// ruta de descarga vuelve a verificar con requerirAdmin().
export default function LayoutPanel({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col lg:flex-row">
      <Suspense fallback={<NavPanelBase />}>
        <NavPanel />
      </Suspense>
      <main id="contenido" className="flex min-w-0 flex-1 flex-col px-4 pt-6 pb-8 lg:px-10 lg:pt-8">
        <Suspense fallback={<Esqueleto />}>
          <Guardia>{children}</Guardia>
        </Suspense>
        <div className="mt-auto">
          <PiePanel />
        </div>
      </main>
    </div>
  );
}

async function Guardia({ children }: { children: React.ReactNode }) {
  await requerirAdmin();
  return children;
}
