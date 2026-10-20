import Image from "next/image";
import type { Foto } from "@/lib/datos/tipos";
import { IconoObra } from "./Iconos";

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
  ajuste = "cubrir",
  className = "",
}: {
  foto: Foto | null;
  tamanos: string;
  prioridad?: boolean;
  /** cubrir: llena el recuadro (tarjetas). contener: la obra entera, sin recortes (ficha). */
  ajuste?: "cubrir" | "contener";
  className?: string;
}) {
  if (!foto) {
    return (
      // Marcador neutro mientras no se cargue la fotografía real de la obra.
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-piedra p-4 text-center ${className}`}
      >
        <IconoObra className="text-3xl text-gris-suave" />
        <span className="rotulo">Fotografía pendiente</span>
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
      // priority quedó obsoleto en Next 16: las fotos visibles de entrada se piden ya y con prioridad.
      loading={prioridad ? "eager" : undefined}
      fetchPriority={prioridad ? "high" : undefined}
      unoptimized={src.endsWith(".svg")}
      className={`${ajuste === "contener" ? "object-contain" : "object-cover"} ${className}`}
    />
  );
}
