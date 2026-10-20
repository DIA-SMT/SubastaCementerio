import type { ReactNode } from "react";

// Recuadros de aviso sin dependencias de servidor: se pueden usar también desde el cliente
// (por ejemplo, en la vista previa del editor de textos del panel).

/** Marca de texto provisorio, pendiente de aprobación. */
export function AvisoProvisorio({ children }: { children?: ReactNode }) {
  return (
    <div role="note" className="rounded-xl border-l-8 border-ambar bg-ambar-suave px-4 py-3 text-tinta">
      <p className="font-bold">Texto provisorio</p>
      <p>{children ?? "Este contenido está pendiente de aprobación y puede cambiar."}</p>
    </div>
  );
}

type Tono = "info" | "exito" | "alerta" | "error";

const TONOS: Record<Tono, string> = {
  info: "border-azul bg-fondo",
  exito: "border-verde bg-verde-suave",
  alerta: "border-ambar bg-ambar-suave",
  error: "border-rojo bg-rojo-suave",
};

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
  return (
    <div role={rol} className={`rounded-xl border-l-8 px-4 py-3 text-tinta ${TONOS[tono]}`}>
      {titulo && <p className="font-bold">{titulo}</p>}
      {children && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
