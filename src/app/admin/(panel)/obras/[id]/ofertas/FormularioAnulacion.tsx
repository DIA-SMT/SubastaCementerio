"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial } from "@/lib/admin/acciones";
import { anularOfertaAccion } from "./acciones";

/** Motivo obligatorio y confirmación para anular una oferta. */
export function FormularioAnulacion({ ofertaId }: { ofertaId: number }) {
  const [estado, enviar] = useActionState(anularOfertaAccion, estadoInicial);
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} className="space-y-5" noValidate>
      <input type="hidden" name="oferta" value={ofertaId} />

      <Campo
        id="motivo"
        etiqueta="Motivo de la anulación"
        ayuda="Obligatorio, al menos 5 caracteres. Queda registrado junto con tu nombre y la fecha."
        error={errores.motivo}
      >
        <textarea
          id="motivo"
          name="motivo"
          rows={3}
          maxLength={500}
          required
          defaultValue={estado.valores?.motivo}
          className="campo py-3"
          aria-invalid={errores.motivo ? true : undefined}
          aria-describedby={errores.motivo ? "motivo-ayuda motivo-error" : "motivo-ayuda"}
        />
      </Campo>

      <div>
        <label className="flex items-start gap-3 text-lg text-tinta">
          <input
            type="checkbox"
            name="confirmacion"
            value="si"
            required
            className="mt-1 h-6 w-6 shrink-0 accent-azul"
            aria-invalid={errores.confirmacion ? true : undefined}
            aria-describedby={errores.confirmacion ? "confirmacion-error" : undefined}
          />
          <span>Confirmo que quiero anular esta oferta. Sé que la anulación no se puede deshacer.</span>
        </label>
        {errores.confirmacion && (
          <p id="confirmacion-error" className="mt-1.5 font-semibold text-tinta">
            <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rojo" />
            {errores.confirmacion}
          </p>
        )}
      </div>

      <MensajeAccion estado={estado} />
      {Object.keys(errores).length > 0 && (
        <p role="alert" className="sr-only">
          Hay datos para revisar en el formulario.
        </p>
      )}

      <BotonEnviar variante="peligro" enviando="Anulando…" className="w-full sm:w-auto">
        Anular la oferta
      </BotonEnviar>
    </form>
  );
}
