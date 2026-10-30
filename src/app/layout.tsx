import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Poppins, la tipografía de la identidad de Ciudad SMT, en textos, interfaz, cifras y títulos.
// next/font la sirve desde el propio sitio: el navegador no le pide nada a Google.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: "Memorias del futuro · Subasta solidaria · Cementerio del Oeste",
    template: "%s · Subasta solidaria",
  },
  description:
    "Memorias del futuro. Artistas en diálogo con el patrimonio: subasta solidaria de las 24 cabezas escultóricas intervenidas por artistas, a beneficio del Cottolengo Don Orione. Municipalidad de San Miguel de Tucumán, Dirección de Cementerios.",
};

export const viewport: Viewport = {
  themeColor: "#062b6f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={poppins.variable}>
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
