import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/PaginaInformativa";

export const metadata: Metadata = { title: "Cómo participar" };

export default function Pagina() {
  return <PaginaInformativa slug="como-participar" />;
}
