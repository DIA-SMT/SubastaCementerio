import { Suspense } from "react";
import { Esqueleto } from "@/components/admin/Panel";
import { NavPanel, NavPanelBase } from "@/components/admin/NavPanel";
import { requerirAdmin } from "@/lib/admin/sesion";

// Primera barrera: sin sesión del equipo, redirige al ingreso. Cada página, acción y
// ruta de descarga vuelve a verificar con requerirAdmin().
export default function LayoutPanel({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col xl:flex-row">
      <Suspense fallback={<NavPanelBase />}>
        <NavPanel />
      </Suspense>
      <main id="contenido" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <Suspense fallback={<Esqueleto />}>
          <Guardia>{children}</Guardia>
        </Suspense>
      </main>
    </div>
  );
}

async function Guardia({ children }: { children: React.ReactNode }) {
  await requerirAdmin();
  return children;
}
