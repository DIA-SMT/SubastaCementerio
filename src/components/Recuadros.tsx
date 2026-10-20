import type { ReactNode } from "react";

// Recuadros de aviso sin dependencias de servidor: se pueden usar también desde el cliente
// (por ejemplo, en la vista previa del editor de textos del panel).

type Tono = "info" | "exito" | "alerta" | "error";

const TONOS: Record<Tono, { caja: string; punto: string }> = {
  info: { caja: "bg-fondo ring-azul/15", punto: "bg-azul" },
  exito: { caja: "bg-verde-suave ring-verde/25", punto: "bg-verde" },
  alerta: { caja: "bg-ambar-suave ring-ambar/30", punto: "bg-ambar" },
  error: { caja: "bg-rojo-suave ring-rojo/25", punto: "bg-rojo" },
};

/** Aviso con fondo suave y punto de color; el texto siempre en tinta (contraste AA). */
export function Recuadro({
  tono = "info",
  titulo,
  children,
  rol,
}: {
  tono?: Tono;
  titulo?: ReactNode;
  children?: ReactNode;
  rol?: "alert" | "status" | "note";
}) {
  const t = TONOS[tono];
  return (
    <div role={rol} className={`flex gap-3 rounded-md px-4 py-3.5 text-tinta ring-1 ring-inset ${t.caja}`}>
      <span aria-hidden className={`mt-[0.6em] h-2 w-2 shrink-0 rounded-full ${t.punto}`} />
      <div>
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/** Marca de texto provisorio, pendiente de aprobación. */
export function AvisoProvisorio({ children }: { children?: ReactNode }) {
  return (
    <Recuadro tono="alerta" titulo="Texto provisorio" rol="note">
      {children ?? "Este contenido está pendiente de aprobación y puede cambiar."}
    </Recuadro>
  );
}

/** Pastilla chica de "Texto provisorio" para encabezados. */
export function PastillaProvisorio() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ambar-suave px-3 py-1 text-[0.8rem] font-semibold text-tinta ring-1 ring-ambar/30 ring-inset">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ambar" />
      Texto provisorio
    </span>
  );
}
