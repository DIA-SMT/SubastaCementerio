/**
 * Resultado común de los Server Actions del panel, para usar con useActionState.
 *  - ok + mensaje: se muestra un aviso de éxito.
 *  - error: aviso general de error.
 *  - errores: mensajes por campo (clave = name del input).
 */
export type EstadoAccion = {
  ok?: boolean;
  mensaje?: string;
  error?: string;
  errores?: Record<string, string>;
  /** Para devolver los valores cargados cuando hay errores. */
  valores?: Record<string, string>;
};

export const estadoInicial: EstadoAccion = {};

/** Traduce errores de Postgres frecuentes a mensajes para el equipo. */
export function mensajeDeErrorDb(error: unknown): string {
  const e = error as { code?: string; message?: string; constraint_name?: string; constraint?: string };
  const restriccion = e.constraint_name ?? e.constraint ?? "";
  switch (e.code) {
    case "23505":
      if (restriccion.includes("numero")) return "Ya hay otra obra con ese número.";
      return "Ya existe un registro con esos datos.";
    case "23503": // foreign_key_violation
    case "23001": // restrict_violation (ON DELETE RESTRICT en Postgres 18)
      return "No se puede borrar porque tiene datos asociados (por ejemplo, ofertas u obras).";
    case "23514":
      if (restriccion.includes("cierre_posterior")) return "El cierre tiene que ser posterior al inicio.";
      return "Hay un dato fuera de los valores permitidos.";
    case "42501":
      return "Tu usuario no tiene permiso para hacer este cambio.";
    default:
      return e.message?.startsWith("Las ofertas") ? e.message : "No se pudo guardar. Probá de nuevo.";
  }
}
