import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

// Manrope para títulos y cifras; Inter para textos e interfaz. next/font las sirve desde el
// propio sitio: el navegador no le pide nada a Google.
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Memorias del futuro · Subasta solidaria · Cementerio del Oeste",
    template: "%s · Subasta solidaria",
  },
  description:
    "Memorias del futuro. Artistas en diálogo con el patrimonio: subasta solidaria de las 25 cabezas escultóricas intervenidas por artistas, a beneficio del Cottolengo Don Orione. Municipalidad de San Miguel de Tucumán, Dirección de Cementerios.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${manrope.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-md bg-white px-4 py-2 font-semibold text-azul shadow-elevada focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
