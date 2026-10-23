"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  altoCm: number | null;
  anchoCm: number | null;
  profundidadCm: number | null;
  medidasAproximadas: boolean;
  precioSalida: number | null;
  publicada: boolean;
};

/** Lo que entregan los artistas: la memoria conceptual va de 60 a 100 palabras. */
const PALABRAS = { min: 60, max: 100 };
const contarPalabras = (texto: string) => texto.trim().split(/\s+/).filter(Boolean).length;

/** Medida guardada para el campo: "30,5" (coma decimal, como se escribe acá). */
const medidaParaCampo = (valor: number | null | undefined) => (valor == null ? "" : String(valor).replace(".", ","));

const MEDIDAS = [
  ["alto_cm", "Alto"],
  ["ancho_cm", "Ancho"],
  ["profundidad_cm", "Profundidad"],
] as const;

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
    alto_cm: v?.alto_cm ?? medidaParaCampo(obra?.altoCm),
    ancho_cm: v?.ancho_cm ?? medidaParaCampo(obra?.anchoCm),
    profundidad_cm: v?.profundidad_cm ?? medidaParaCampo(obra?.profundidadCm),
    medidas_aproximadas: v ? v.medidas_aproximadas === "si" : (obra?.medidasAproximadas ?? false),
    precio_salida: v?.precio_salida ?? (obra?.precioSalida != null ? String(obra.precioSalida) : ""),
    publicada: v ? v.publicada === "si" : (obra?.publicada ?? false),
  };

  const [palabras, setPalabras] = useState(() => contarPalabras(inicial.resena));
  const fueraDeRango = palabras > 0 && (palabras < PALABRAS.min || palabras > PALABRAS.max);

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
        id="tecnica"
        etiqueta="Técnica y materiales (opcional)"
        ayuda="Tal como los informa el artista. Por ejemplo: yeso, vendas enyesadas, telgopor, pintura y barniz."
        error={e.tecnica}
      >
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

      <fieldset aria-describedby="medidas-ayuda">
        <legend className="etiqueta">Medidas (opcional)</legend>
        <p id="medidas-ayuda" className="-mt-1 mb-3 text-base text-gris">
          En centímetros. Si el artista las pasó en metros, multiplicá por 100: 0,80 m son 80 cm. La profundidad puede
          quedar vacía si la obra es plana.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {MEDIDAS.map(([id, rotulo]) => (
            <div key={id}>
              <label htmlFor={id} className="mb-1.5 block font-medium text-tinta">
                {rotulo}
              </label>
              <div className="relative">
                <input
                  id={id}
                  name={id}
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={7}
                  defaultValue={inicial[id]}
                  className="campo pr-12"
                  aria-invalid={e[id] ? true : undefined}
                  aria-describedby={e[id] ? `${id}-error` : undefined}
                />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gris">
                  cm
                </span>
              </div>
              {e[id] && (
                <p id={`${id}-error`} className="mt-1.5 font-semibold text-tinta">
                  <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rojo" />
                  {e[id]}
                </p>
              )}
            </div>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-3">
          <input
            type="checkbox"
            name="medidas_aproximadas"
            value="si"
            defaultChecked={inicial.medidas_aproximadas}
            className="h-5 w-5 shrink-0 accent-azul"
          />
          <span className="text-tinta">Son medidas aproximadas</span>
        </label>
      </fieldset>

      <Campo
        id="resena"
        etiqueta="Memoria conceptual"
        ayuda={`La idea que motivó la intervención, su significado y qué busca expresar, en palabras del artista (de ${PALABRAS.min} a ${PALABRAS.max} palabras). Se muestra en la ficha de la obra. Dejá una línea en blanco para separar párrafos.`}
        error={e.resena}
      >
        <textarea
          id="resena"
          name="resena"
          rows={7}
          maxLength={6000}
          defaultValue={inicial.resena}
          onChange={(ev) => setPalabras(contarPalabras(ev.target.value))}
          className="campo py-3"
          aria-invalid={e.resena ? true : undefined}
          aria-describedby={[describir("resena"), "resena-palabras"].filter(Boolean).join(" ")}
        />
        <p id="resena-palabras" className="mt-1.5 flex items-center gap-2 text-base text-gris">
          {fueraDeRango && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-ambar" />}
          {palabras === 1 ? "1 palabra" : `${palabras} palabras`}
          {fueraDeRango && ` · se pidieron entre ${PALABRAS.min} y ${PALABRAS.max} (se puede guardar igual)`}
        </p>
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
