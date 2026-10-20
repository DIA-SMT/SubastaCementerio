"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial } from "@/lib/admin/acciones";
import { cambiarTextoFotoAccion } from "../acciones";

/** Edición del texto alternativo de una foto ya subida. */
export function TextoAlternativo({ fotoId, texto, posicion }: { fotoId: string; texto: string; posicion: number }) {
  const [estado, enviar] = useActionState(cambiarTextoFotoAccion, estadoInicial);
  const id = `alt-${fotoId}`;
  const error = estado.errores?.texto_alternativo;

  return (
    <form action={enviar} className="space-y-3" noValidate>
      <input type="hidden" name="foto_id" value={fotoId} />
      <Campo
        id={id}
        etiqueta={
          <>
            Texto alternativo<span className="sr-only"> de la foto {posicion}</span>
          </>
        }
        error={error}
      >
        <textarea
          id={id}
          name="texto_alternativo"
          rows={2}
          required
          maxLength={250}
          defaultValue={estado.valores?.texto_alternativo ?? texto}
          className="campo py-3"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </Campo>
      <MensajeAccion estado={estado} />
      <BotonEnviar variante="secundario">
        Guardar descripción<span className="sr-only"> de la foto {posicion}</span>
      </BotonEnviar>
    </form>
  );
}
