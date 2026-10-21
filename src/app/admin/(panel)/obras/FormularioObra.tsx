"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial } from "@/lib/admin/acciones";
import { pesos } from "@/lib/formato";
import { actualizarObraAccion, crearObraAccion } from "./acciones";

export type ObraParaFormulario = {
  id: string;
  numero: number;
  titulo: string | null;
  artistaId: string;
  resena: string;
  tecnica: string | null;
  precioSalida: number | null;
  publicada: boolean;
};

/** Alta y edición de una obra. Sin `obra`, crea una nueva. */
export function FormularioObra({
  obra,
  artistas,
  precioGeneral,
  numeroSugerido,
}: {
  obra?: ObraParaFormulario;
  artistas: { id: string; nombre: string }[];
  precioGeneral: number;
  numeroSugerido?: number;
}) {
  const [estado, enviar] = useActionState(obra ? actualizarObraAccion : crearObraAccion, estadoInicial);
  const e = estado.errores ?? {};
  const v = estado.valores;

  // Valores iniciales: lo último que se envió (si hubo) o lo guardado.
  const inicial = {
    numero: v?.numero ?? (obra ? String(obra.numero) : numeroSugerido ? String(numeroSugerido) : ""),
    titulo: v?.titulo ?? obra?.titulo ?? "",
    artista_id: v?.artista_id ?? obra?.artistaId ?? "",
    resena: v?.resena ?? obra?.resena ?? "",
    tecnica: v?.tecnica ?? obra?.tecnica ?? "",
    precio_salida: v?.precio_salida ?? (obra?.precioSalida != null ? String(obra.precioSalida) : ""),
    publicada: v ? v.publicada === "si" : (obra?.publicada ?? false),
  };

  const describir = (id: string, conAyuda = true) =>
    [conAyuda && `${id}-ayuda`, e[id] && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <form action={enviar} className="space-y-6" noValidate>
      {obra && <input type="hidden" name="id" value={obra.id} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Campo
          id="numero"
          etiqueta="Número"
          ayuda={
            obra
              ? "Del 1 al 999. Va en el cartel con el QR: si lo cambiás, hay que reimprimir el cartel."
              : "Del 1 al 999. Va en el cartel con el QR. Te sugerimos el primero libre."
          }
          error={e.numero}
        >
          <input
            id="numero"
            name="numero"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={3}
            defaultValue={inicial.numero}
            className="campo"
            aria-invalid={e.numero ? true : undefined}
            aria-describedby={describir("numero")}
          />
        </Campo>

        <Campo id="titulo" etiqueta="Título (opcional)" ayuda="Si lo dejás vacío, en el sitio se muestra «Sin título»." error={e.titulo}>
          <input
            id="titulo"
            name="titulo"
            autoComplete="off"
            maxLength={150}
            defaultValue={inicial.titulo}
            className="campo"
            aria-invalid={e.titulo ? true : undefined}
            aria-describedby={describir("titulo")}
          />
        </Campo>
      </div>

      <Campo
        id="artista_id"
        etiqueta="Artista"
        ayuda={
          <>
            ¿No está en la lista?{" "}
            <Link href="/admin/artistas/nuevo" className="enlace">
              Cargar un artista nuevo
            </Link>
          </>
        }
        error={e.artista_id}
      >
        {/* La clave hace que el selector vuelva al valor guardado si cambia desde el servidor. */}
        <select
          key={inicial.artista_id}
          id="artista_id"
          name="artista_id"
          required
          defaultValue={inicial.artista_id}
          className="campo"
          aria-invalid={e.artista_id ? true : undefined}
          aria-describedby={describir("artista_id")}
        >
          <option value="">Elegí un artista</option>
          {artistas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        id="resena"
        etiqueta="Reseña de la obra"
        ayuda="La idea, los materiales y el proceso. Se muestra en la ficha de la obra. Dejá una línea en blanco para separar párrafos."
        error={e.resena}
      >
        <textarea
          id="resena"
          name="resena"
          rows={7}
          maxLength={6000}
          defaultValue={inicial.resena}
          className="campo py-3"
          aria-invalid={e.resena ? true : undefined}
          aria-describedby={describir("resena")}
        />
      </Campo>

      <Campo id="tecnica" etiqueta="Técnica (opcional)" ayuda="Por ejemplo: acrílico y collage sobre yeso." error={e.tecnica}>
        <input
          id="tecnica"
          name="tecnica"
          autoComplete="off"
          maxLength={200}
          defaultValue={inicial.tecnica}
          className="campo"
          aria-invalid={e.tecnica ? true : undefined}
          aria-describedby={describir("tecnica")}
        />
      </Campo>

      <Campo
        id="precio_salida"
        etiqueta="Precio de salida propio (opcional)"
        ayuda={`En pesos, sin centavos. Si lo dejás vacío se usa el precio de salida general de la configuración: ${pesos(precioGeneral)}. Es el monto mínimo de la primera oferta.`}
        error={e.precio_salida}
      >
        <div className="relative max-w-xs">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-gris">
            $
          </span>
          <input
            id="precio_salida"
            name="precio_salida"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={inicial.precio_salida}
            className="campo pl-9"
            aria-invalid={e.precio_salida ? true : undefined}
            aria-describedby={describir("precio_salida")}
          />
        </div>
      </Campo>

      <div>
        <label className="flex items-start gap-3 text-lg">
          <input
            type="checkbox"
            name="publicada"
            value="si"
            defaultChecked={inicial.publicada}
            className="mt-1 h-6 w-6 shrink-0 accent-azul"
            aria-describedby="publicada-ayuda"
          />
          <span className="font-semibold text-tinta">Publicada en el sitio</span>
        </label>
        <p id="publicada-ayuda" className="mt-1 ml-9 text-base text-gris">
          Solo las obras publicadas aparecen en el catálogo, reciben ofertas y figuran en el listado final para el
          martillero.
        </p>
      </div>

      {e.confirmar_despublicar && (
        <div className="space-y-3 rounded-md border-l-2 border-ambar bg-ambar-suave px-4 py-4 text-tinta">
          <p className="text-xl font-semibold">Confirmá que querés despublicar la obra</p>
          <p id="confirmar-despublicar-detalle">{e.confirmar_despublicar}</p>
          <input type="hidden" name="confirmacion_para" value={v?.confirmacion_para ?? ""} />
          <div className="flex items-start gap-3 rounded-lg bg-white p-3">
            <input
              id="confirmar_despublicar"
              name="confirmar_despublicar"
              type="checkbox"
              value="si"
              aria-describedby="confirmar-despublicar-detalle"
              className="mt-1 h-6 w-6 shrink-0 accent-azul"
            />
            <label htmlFor="confirmar_despublicar" className="font-semibold">
              Entiendo lo que implica y quiero despublicar la obra.
            </label>
          </div>
        </div>
      )}

      <MensajeAccion estado={estado} />

      <div className="flex flex-wrap gap-3">
        <BotonEnviar enviando={obra ? "Guardando…" : "Creando…"}>{obra ? "Guardar cambios" : "Crear la obra"}</BotonEnviar>
        {!obra && (
          <Link href="/admin/obras" className="boton-secundario">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
