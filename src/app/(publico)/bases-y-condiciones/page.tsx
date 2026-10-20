import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/PaginaInformativa";

export const metadata: Metadata = { title: "Bases y condiciones" };

export default function Pagina() {
  return <PaginaInformativa slug="bases-y-condiciones" />;
}
