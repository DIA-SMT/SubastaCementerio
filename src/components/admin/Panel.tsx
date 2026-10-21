import type { ReactNode } from "react";
import type { EstadoAccion } from "@/lib/admin/acciones";

// Piezas comunes de las pantallas del panel. Componentes de servidor (sin hooks).

/** Encabezado de cada pantalla del panel: título en serif, bajada y acciones. */
export function TituloPanel({
  titulo,
  bajada,
  acciones,
}: {
  titulo: ReactNode;
  bajada?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="antetitulo flex items-center gap-3">
          <span aria-hidden className="h-px w-6 bg-oro" />
          Panel
        </p>
        <h1 className="mt-1.5 text-[clamp(1.9rem,1.5rem+1vw,2.5rem)] leading-[1.05]">{titulo}</h1>
        {bajada && <p className="mt-2 text-gris">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
    </div>
  );
}

/** Bloque con borde para agrupar contenido dentro de una pantalla. */
export function Tarjeta({ titulo, children, className = "" }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg bg-white p-5 shadow-suave ring-1 ring-linea md:p-6 ${className}`}>
      {titulo && <h2 className="mb-4 text-[1.45rem] leading-tight">{titulo}</h2>}
      {children}
    </section>
  );
}

/** Campo de formulario con etiqueta, ayuda y error. Pasar el control (input, select, textarea) como hijo. */
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
      </label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1 text-base text-gris">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 font-semibold text-tinta">
          <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rojo" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Aviso de resultado de un Server Action (éxito o error general). */
export function MensajeAccion({ estado }: { estado: EstadoAccion }) {
  if (estado.error) {
    return (
      <p role="alert" className="rounded-md border-l-2 border-rojo bg-rojo-suave px-4 py-3 font-semibold text-tinta">
        {estado.error}
      </p>
    );
  }
  if (estado.ok && estado.mensaje) {
    return (
      <p role="status" className="rounded-md border-l-2 border-verde bg-verde-suave px-4 py-3 font-semibold text-tinta">
        {estado.mensaje}
      </p>
    );
  }
  return null;
}

/** Contenedor de tabla con desplazamiento horizontal en pantallas chicas. */
export function TablaContenedor({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <div className="relative overflow-x-auto rounded-lg bg-white shadow-suave ring-1 ring-linea" role="region" aria-label={etiqueta} tabIndex={0}>
      <table className="w-full min-w-[40rem] text-left text-base [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-tinta [&_thead]:bg-superficie [&_thead_th]:text-[0.8rem] [&_thead_th]:tracking-[0.08em] [&_thead_th]:uppercase [&_tr]:border-b [&_tr]:border-linea">
        {children}
      </table>
    </div>
  );
}

/** Etiqueta de estado con fondo de color y texto en tinta (contraste AA). */
export function Etiqueta({ tono, children }: { tono: "verde" | "ambar" | "rojo" | "gris" | "azul"; children: ReactNode }) {
  const fondo = {
    verde: "bg-verde-suave",
    ambar: "bg-ambar-suave",
    rojo: "bg-rojo-suave",
    gris: "bg-linea",
    azul: "bg-fondo",
  }[tono];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap text-tinta ${fondo}`}>{children}</span>;
}

export function Esqueleto({ alto = "h-64" }: { alto?: string }) {
  return <div className={`${alto} esqueleto rounded-lg`} aria-busy="true" aria-label="Cargando" />;
}
