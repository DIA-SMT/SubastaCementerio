import Image from "next/image";

/**
 * Fondo fijo del sitio público: una sala de museo. Queda quieta mientras el contenido se
 * desplaza por encima; cada sección decide cuánto la deja ver.
 */
export function FondoSala() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-papel">
      <Image
        src="/fondo/sala-museo.webp"
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="object-cover object-[42%_60%]"
      />
    </div>
  );
}
