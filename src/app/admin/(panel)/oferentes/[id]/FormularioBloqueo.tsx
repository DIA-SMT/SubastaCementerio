"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial } from "@/lib/admin/acciones";
import { cambiarBloqueoAccion } from "./acciones";

/**
 * Bloquear (con motivo) o desbloquear. Un solo estado para que el aviso del resultado
 * siga visible cuando la ficha se actualiza y cambia el formulario.
 */
export function FormularioBloqueo({ oferenteId, bloqueado }: { oferenteId: string; bloqueado: boolean }) {
  const [estado, enviar] = useActionState(cambiarBloqueoAccion, estadoInicial);
  const error = estado.errores?.motivo;

  if (bloqueado) {
    return (
      <form action={enviar} className="space-y-4">
        <input type="hidden" name="oferente" value={oferenteId} />
        <input type="hidden" name="accion" value="desbloquear" />
        <p>
          Al desbloquear, la persona puede volver a ofertar. El motivo del bloqueo se quita de la ficha, pero queda
          guardado en la auditoría.
        </p>
        <MensajeAccion estado={estado} />
        <BotonEnviar variante="secundario" enviando="Desbloqueando…" className="w-full sm:w-auto">
          Desbloquear
        </BotonEnviar>
      </form>
    );
  }

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="oferente" value={oferenteId} />
      <input type="hidden" name="accion" value="bloquear" />
      <Campo
        id="motivo"
        etiqueta="Motivo del bloqueo"
        ayuda="Obligatorio, al menos 5 caracteres. Solo lo ve el equipo."
        error={error}
      >
        <textarea
          id="motivo"
          name="motivo"
          rows={3}
          maxLength={500}
          required
          defaultValue={estado.valores?.motivo}
          className="campo py-3"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "motivo-ayuda motivo-error" : "motivo-ayuda"}
        />
      </Campo>
      {error && (
        <p role="alert" className="sr-only">
          Revisá el motivo del bloqueo.
        </p>
      )}
      <MensajeAccion estado={estado} />
      <BotonEnviar variante="peligro" enviando="Bloqueando…" className="w-full sm:w-auto">
        Bloquear
      </BotonEnviar>
    </form>
  );
}
