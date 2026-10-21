import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/PaginaInformativa";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Pagina() {
  return <PaginaInformativa slug="privacidad" />;
}
