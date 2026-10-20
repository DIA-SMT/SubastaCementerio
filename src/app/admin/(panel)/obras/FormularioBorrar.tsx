"use client";

import { useActionState, useId } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial, type EstadoAccion } from "@/lib/admin/acciones";

/**
 * Borrado con confirmación explícita: casilla "Confirmo…" + botón de peligro.
 * El Server Action recibe "id" y "confirmo" = "si", y vuelve a verificar todo.
 */
export function FormularioBorrar({
  borrarAction,
  id,
  confirmacion,
  textoBoton,
}: {
  borrarAction: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  id: string;
  confirmacion: string;
  textoBoton: string;
}) {
  const [estado, enviar] = useActionState(borrarAction, estadoInicial);
  const base = useId();
  const idCasilla = `${base}confirmo`;
  const error = estado.errores?.confirmo;

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor={idCasilla} className="flex items-start gap-3 text-lg">
          <input
            id={idCasilla}
            type="checkbox"
            name="confirmo"
            value="si"
            required
            className="mt-1 h-6 w-6 shrink-0 accent-azul-profundo"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${idCasilla}-error` : undefined}
          />
          <span className="font-bold text-tinta">{confirmacion}</span>
        </label>
        {error && (
          <p id={`${idCasilla}-error`} className="mt-1.5 ml-9 font-bold text-tinta">
            <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rojo" />
            {error}
          </p>
        )}
      </div>
      <MensajeAccion estado={estado} />
      <BotonEnviar variante="peligro" enviando="Borrando…">
        {textoBoton}
      </BotonEnviar>
    </form>
  );
}
