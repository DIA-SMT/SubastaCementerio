import type { Metadata } from "next";
import { Divisor, OrnamentoOlivo } from "@/components/Ornamentos";
import { PaginaInformativa } from "@/components/PaginaInformativa";
import { PasosParticipar } from "@/components/PasosParticipar";

export const metadata: Metadata = { title: "Cómo participar" };

export default function Pagina() {
  return (
    <PaginaInformativa
      slug="como-participar"
      antes={
        // Los cuatro pasos, a todo el ancho; debajo sigue el texto editable desde el panel.
        <section aria-labelledby="titulo-pasos" className="relative mb-14 overflow-hidden border-y border-linea bg-white/55 md:mb-20">
          <OrnamentoOlivo className="pointer-events-none absolute -top-6 -right-12 w-56 text-dorado-suave/40 md:w-72" />
          <div className="contenedor relative py-14 md:py-20">
            <h2 id="titulo-pasos" className="sr-only">
              Los cuatro pasos
            </h2>
            <PasosParticipar />
          </div>
          <Divisor className="mx-auto mb-8 h-4 w-40 text-oro/70" />
        </section>
      }
    />
  );
}
