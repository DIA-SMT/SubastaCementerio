import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Subasta solidaria · Cementerio del Oeste",
    template: "%s · Subasta solidaria",
  },
  description:
    "Subasta solidaria de las 25 cabezas escultóricas intervenidas por artistas locales. Municipalidad de San Miguel de Tucumán, Dirección de Cementerios.",
};

export const viewport: Viewport = {
  themeColor: "#0d3fb0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-bold text-azul-profundo focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
