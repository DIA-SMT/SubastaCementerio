import Image from "next/image";
import type { ReactNode } from "react";
import { OrnamentoArco } from "./Ornamentos";

// Imágenes del paquete de recursos de la muestra: son ilustrativas (generadas), no fotografías
// del Cementerio del Oeste ni de las obras. Por eso van chicas, como detalle, y con su leyenda.
const IMAGENES = {
  angel: { src: "/assets/memorias/fotografia/escultura-angel.jpg", ancho: 408, alto: 648 },
  galeria: { src: "/assets/memorias/fotografia/galeria-arcos.jpg", ancho: 831, alto: 648 },
} as const;

/**
 * Pantalla de ingreso en dos columnas: a la izquierda el título y el formulario; a la derecha
 * (solo en computadora) un panel en azul noche con una imagen ilustrativa dentro de un arco.
 * En el celular y la tablet queda solo el formulario.
 */
export function IngresoDividido({
  antetitulo,
  titulo,
  bajada,
  imagen,
  children,
}: {
  antetitulo: ReactNode;
  titulo: ReactNode;
  bajada?: ReactNode;
  imagen: keyof typeof IMAGENES;
  children: ReactNode;
}) {
  const img = IMAGENES[imagen];
  return (
    <div className="contenedor grid gap-10 pt-10 md:pt-16 lg:grid-cols-12 lg:items-stretch lg:gap-14">
      <div className="mx-auto w-full max-w-xl lg:col-span-6 lg:mx-0 lg:max-w-none lg:py-6 xl:col-span-6">
        <p className="antetitulo">{antetitulo}</p>
        <span aria-hidden className="filete-oro mt-4" />
        <h1 className="mt-5 text-titulo">{titulo}</h1>
        {bajada && <div className="mt-4 max-w-lg text-lg text-texto">{bajada}</div>}
        <div className="superficie-tarjeta mt-8 p-6 md:p-8">{children}</div>
      </div>

      <figure className="fondo-noche relative hidden overflow-hidden rounded-lg lg:col-span-6 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-10 lg:py-14 xl:col-span-5 xl:col-start-8">
        <div className="relative w-full max-w-[17rem]">
          {/* Marco de arco: la imagen se recorta con la misma forma que el ornamento. */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full ring-1 ring-oro/60 ring-offset-8 ring-offset-noche">
            <Image
              src={img.src}
              alt=""
              width={img.ancho}
              height={img.alto}
              sizes="272px"
              className="h-full w-full object-cover"
            />
          </div>
          <OrnamentoArco aria-hidden className="pointer-events-none absolute -inset-x-10 -top-10 -bottom-6 m-auto h-[calc(100%+4rem)] text-oro/35" />
        </div>
        <figcaption className="mt-10 max-w-xs text-center text-[0.82rem] text-oro-claro">
          Imagen ilustrativa. No es una fotografía del Cementerio del Oeste ni de las obras de la muestra.
        </figcaption>
      </figure>
    </div>
  );
}
