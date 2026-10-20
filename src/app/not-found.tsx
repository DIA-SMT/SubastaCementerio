import Link from "next/link";
import { Encabezado } from "@/components/Encabezado";
import { Pie } from "@/components/Pie";
import { TituloSeccion } from "@/components/TituloSeccion";

export default function NoEncontrada() {
  return (
    <>
      <Encabezado />
      <main id="contenido" className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-16">
          <TituloSeccion nivel={1}>No encontramos esta página</TituloSeccion>
          <p className="mt-4 text-lg">Puede que la dirección esté mal escrita o que la obra ya no esté publicada.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/obras" className="boton-primario">
              Ver las obras
            </Link>
            <Link href="/" className="boton-secundario">
              Ir al inicio
            </Link>
          </div>
        </div>
      </main>
      <Pie />
    </>
  );
}
