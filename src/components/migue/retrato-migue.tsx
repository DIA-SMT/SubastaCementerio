/**
 * Las imágenes de Migue (public/migue/, recortadas de la hoja de personaje de la Subasta con
 * scripts/migue-recortes.mjs; la hoja está en docs/migue/hoja-personaje.webp). Con un `<img>`
 * común: son archivos chicos y fijos, no hace falta el optimizador.
 *
 * El `alt` va vacío a propósito: Migue acompaña siempre a un texto que ya dice "Migue" (el
 * nombre accesible del botón, el título del panel), y un lector de pantalla que anuncia
 * "Migue" dos veces seguidas estorba.
 */

/** La cara (retrato.webp, 320×320), opaca: recortada en círculo se ve igual sobre cualquier fondo. */
export function RetratoMigue({ className = "", prioridad = false }: { className?: string; prioridad?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- archivo estático chico de public/migue.
    <img
      src="/migue/retrato.webp"
      alt=""
      width={320}
      height={320}
      loading={prioridad ? "eager" : "lazy"}
      decoding="async"
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

/**
 * Migue entero, de frente (cuerpo.webp, 200×490), con el azul de la ilustración de fondo: va
 * en una tarjeta redondeada, para la bienvenida del chat vacío.
 */
export function CuerpoMigue({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- archivo estático chico de public/migue.
    <img
      src="/migue/cuerpo.webp"
      alt=""
      width={200}
      height={490}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-lg object-cover shadow-suave ring-1 ring-marino/10 ${className}`}
    />
  );
}
