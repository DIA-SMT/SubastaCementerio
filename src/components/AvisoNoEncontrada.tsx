import Link from "next/link";
import { TituloSeccion } from "./TituloSeccion";

/** Contenido de la página 404 (sin encabezado ni pie: los pone quien la usa). */
export function AvisoNoEncontrada() {
  return (
    <div className="mx-auto box-content max-w-xl px-4 py-16 sm:px-6 md:py-24">
      <TituloSeccion nivel={1} antetitulo="Error 404">
        No encontramos esta página
      </TituloSeccion>
      <p className="mt-5 text-lg text-texto">Puede que la dirección esté mal escrita o que la obra ya no esté publicada.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/obras" className="boton-primario">
          Ver las obras
        </Link>
        <Link href="/" className="boton-secundario">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
