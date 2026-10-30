import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel de la subasta" },
  robots: { index: false, follow: false },
};

/**
 * Panel del equipo con la identidad de la Ciudad de San Miguel de Tucumán: la clase `panel` activa
 * su tema (globals.css). El ingreso y las pantallas del panel arman cada uno su estructura.
 */
export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return <div className="panel flex flex-1 flex-col">{children}</div>;
}
