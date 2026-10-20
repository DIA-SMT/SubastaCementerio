import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/PaginaInformativa";

export const metadata: Metadata = { title: "Destino de lo recaudado" };

export default function Pagina() {
  return <PaginaInformativa slug="destino" />;
}
