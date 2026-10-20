"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial } from "@/lib/admin/acciones";
import { actualizarArtistaAccion, crearArtistaAccion } from "./acciones";

export type ArtistaParaFormulario = { id: string; nombre: string; resena: string; enlace: string | null };

/** Alta y edición de un artista. Sin `artista`, crea uno nuevo. */
export function FormularioArtista({ artista }: { artista?: ArtistaParaFormulario }) {
  const [estado, enviar] = useActionState(artista ? actualizarArtistaAccion : crearArtistaAccion, estadoInicial);
  const e = estado.errores ?? {};
  const v = estado.valores;
  const inicial = {
    nombre: v?.nombre ?? artista?.nombre ?? "",
    resena: v?.resena ?? artista?.resena ?? "",
    enlace: v?.enlace ?? artista?.enlace ?? "",
  };
  const describir = (id: string, conAyuda: boolean) =>
    [conAyuda && `${id}-ayuda`, e[id] && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <form action={enviar} className="space-y-6" noValidate>
      {artista && <input type="hidden" name="id" value={artista.id} />}

      <Campo id="nombre" etiqueta="Nombre" ayuda="Como quiere figurar en el sitio." error={e.nombre}>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={inicial.nombre}
          className="campo"
          aria-invalid={e.nombre ? true : undefined}
          aria-describedby={describir("nombre", true)}
        />
      </Campo>

      <Campo
        id="resena"
        etiqueta="Reseña (opcional)"
        ayuda="Una breve presentación: formación, trayectoria y su vínculo con el proyecto. Dejá una línea en blanco para separar párrafos."
        error={e.resena}
      >
        <textarea
          id="resena"
          name="resena"
          rows={6}
          maxLength={6000}
          defaultValue={inicial.resena}
          className="campo py-3"
          aria-invalid={e.resena ? true : undefined}
          aria-describedby={describir("resena", true)}
        />
      </Campo>

      <Campo
        id="enlace"
        etiqueta="Enlace (opcional)"
        ayuda="Sitio web o red social. Pegá la dirección completa, que empiece con https://."
        error={e.enlace}
      >
        <input
          id="enlace"
          name="enlace"
          type="url"
          inputMode="url"
          maxLength={500}
          autoComplete="off"
          placeholder="https://"
          defaultValue={inicial.enlace}
          className="campo"
          aria-invalid={e.enlace ? true : undefined}
          aria-describedby={describir("enlace", true)}
        />
      </Campo>

      <MensajeAccion estado={estado} />

      <div className="flex flex-wrap gap-3">
        <BotonEnviar enviando={artista ? "Guardando…" : "Creando…"}>{artista ? "Guardar cambios" : "Cargar el artista"}</BotonEnviar>
        {!artista && (
          <Link href="/admin/artistas" className="boton-secundario">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
