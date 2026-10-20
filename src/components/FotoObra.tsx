import Image from "next/image";
import type { Foto } from "@/lib/datos/tipos";

const BASE_STORAGE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/obras/`
  : "/subidas/";

/** Rutas que empiezan con "/" son archivos de /public (ejemplos); el resto, del bucket "obras". */
export function urlFoto(ruta: string) {
  return ruta.startsWith("/") ? ruta : `${BASE_STORAGE}${ruta}`;
}

export function FotoObra({
  foto,
  tamanos,
  prioridad = false,
  className = "",
}: {
  foto: Foto | null;
  tamanos: string;
  prioridad?: boolean;
  className?: string;
}) {
  if (!foto) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-linea text-texto ${className}`}>
        Foto pendiente
      </div>
    );
  }
  const src = urlFoto(foto.ruta);
  return (
    <Image
      src={src}
      alt={foto.alt}
      fill
      sizes={tamanos}
      priority={prioridad}
      unoptimized={src.endsWith(".svg")}
      className={`object-cover ${className}`}
    />
  );
}
