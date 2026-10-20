import type { ReactNode } from "react";
import type { EstadoAccion } from "@/lib/admin/acciones";

// Piezas comunes de las pantallas del panel. Componentes de servidor (sin hooks).

/** Encabezado de cada pantalla del panel: título con barrita, bajada y acciones. */
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
        <h1 className="flex items-stretch gap-3 text-3xl">
          <span aria-hidden className="w-1.5 shrink-0 rounded-full bg-linear-to-b from-azul to-celeste" />
          <span>{titulo}</span>
        </h1>
        {bajada && <p className="mt-2 text-gris">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
    </div>
  );
}

/** Bloque con borde para agrupar contenido dentro de una pantalla. */
export function Tarjeta({ titulo, children, className = "" }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-linea bg-white p-5 ${className}`}>
      {titulo && <h2 className="mb-4 text-xl">{titulo}</h2>}
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
        <p id={`${id}-error`} className="mt-1.5 font-bold text-tinta">
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
      <p role="alert" className="rounded-xl border-l-8 border-rojo bg-rojo-suave px-4 py-3 font-bold text-tinta">
        {estado.error}
      </p>
    );
  }
  if (estado.ok && estado.mensaje) {
    return (
      <p role="status" className="rounded-xl border-l-8 border-verde bg-verde-suave px-4 py-3 font-bold text-tinta">
        {estado.mensaje}
      </p>
    );
  }
  return null;
}

/** Contenedor de tabla con desplazamiento horizontal en pantallas chicas. */
export function TablaContenedor({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-linea bg-white" role="region" aria-label={etiqueta} tabIndex={0}>
      <table className="w-full min-w-[40rem] text-left text-base [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:px-4 [&_th]:py-3 [&_th]:font-bold [&_th]:text-tinta [&_thead]:bg-fondo [&_tr]:border-b [&_tr]:border-linea">
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
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-bold whitespace-nowrap text-tinta ${fondo}`}>{children}</span>;
}

export function Esqueleto({ alto = "h-64" }: { alto?: string }) {
  return <div className={`${alto} animate-pulse rounded-2xl bg-linea`} aria-busy="true" aria-label="Cargando" />;
}
