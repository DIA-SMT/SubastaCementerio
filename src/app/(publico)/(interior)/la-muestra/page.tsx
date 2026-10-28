import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/PaginaInformativa";

export const metadata: Metadata = {
  title: "La muestra",
  description: "Memorias del futuro: presentación, texto curatorial, las 24 obras con sus artistas y los créditos de la muestra.",
};

export default function Pagina() {
  return <PaginaInformativa slug="la-muestra" />;
}
