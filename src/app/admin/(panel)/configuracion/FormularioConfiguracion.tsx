"use client";

import { useActionState, type ReactNode } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial } from "@/lib/admin/acciones";
import { guardarConfiguracion } from "./acciones";

export type ValoresConfiguracion = {
  inicio: string;
  cierre: string;
  fechas_confirmadas: "si" | "no";
  fecha_presencial: string;
  detalle_presencial: string;
  incremento_minimo: string;
  precio_salida: string;
  modo_ejemplo: "si" | "no";
  extension_activa: "si" | "no";
  extension_minutos: string;
};

/** Textos ya formateados en el servidor (hora de Tucumán y pesos). */
export type TextosActuales = {
  inicio: string;
  cierre: string;
  incremento: string;
  precioSalida: string;
  obrasConPrecioPropio: number;
  extensionMinutos: string;
};

/** aria-describedby y aria-invalid de un control con ayuda y error (ids de Campo). */
function describir(id: string, conAyuda: boolean, error?: string) {
  const ids = [conAyuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return { "aria-describedby": ids || undefined, "aria-invalid": error ? true : undefined };
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset data-recorrido={titulo} className="tarjeta-panel p-5 md:p-6">
      <legend className="float-left mb-5 w-full border-b border-linea pb-3 text-[1.15rem] font-semibold text-tinta">{titulo}</legend>
      <div className="clear-both space-y-5">{children}</div>
    </fieldset>
  );
}

function Casilla({
  id,
  etiqueta,
  ayuda,
  marcada,
  error,
}: {
  id: string;
  etiqueta: ReactNode;
  ayuda: ReactNode;
  marcada: boolean;
  error?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        value="si"
        defaultChecked={marcada}
        aria-describedby={[`${id}-ayuda`, error ? `${id}-error` : null].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        className="mt-1 h-6 w-6 shrink-0 accent-azul"
      />
      <div>
        <label htmlFor={id} className="font-semibold text-tinta">
          {etiqueta}
        </label>
        <p id={`${id}-ayuda`} className="mt-0.5 text-base text-gris">
          {ayuda}
        </p>
        {error && (
          <p id={`${id}-error`} className="mt-1.5 font-semibold text-tinta">
            <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rojo" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function FormularioConfiguracion({ inicial, actuales }: { inicial: ValoresConfiguracion; actuales: TextosActuales }) {
  const [estado, enviar] = useActionState(guardarConfiguracion, estadoInicial);
  // Con errores se vuelven a mostrar los valores cargados; si no, los guardados.
  const v = (estado.valores ?? inicial) as ValoresConfiguracion & { confirmacion_para?: string };
  const e = estado.errores ?? {};
  const motivos = e.confirmacion?.split("\n").filter(Boolean) ?? [];

  const precioPropio =
    actuales.obrasConPrecioPropio === 0
      ? "Por ahora ninguna obra tiene precio propio."
      : actuales.obrasConPrecioPropio === 1
        ? "Hay 1 obra con precio propio, que no cambia."
        : `Hay ${actuales.obrasConPrecioPropio} obras con precio propio, que no cambian.`;

  return (
    <form action={enviar} className="space-y-6" noValidate>
      <Seccion titulo="Etapa virtual">
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            id="inicio"
            etiqueta="Inicio (hora de Tucumán)"
            ayuda={`Guardado: ${actuales.inicio}.`}
            error={e.inicio}
          >
            <input
              id="inicio"
              name="inicio"
              type="datetime-local"
              step={60}
              required
              defaultValue={v.inicio}
              className="campo"
              {...describir("inicio", true, e.inicio)}
            />
          </Campo>
          <Campo
            id="cierre"
            etiqueta="Cierre (hora de Tucumán)"
            ayuda={`Guardado: ${actuales.cierre}. A esa hora el servidor deja de aceptar ofertas.`}
            error={e.cierre}
          >
            <input
              id="cierre"
              name="cierre"
              type="datetime-local"
              step={60}
              required
              defaultValue={v.cierre}
              className="campo"
              {...describir("cierre", true, e.cierre)}
            />
          </Campo>
        </div>
        <Casilla
          id="fechas_confirmadas"
          etiqueta="Las fechas están confirmadas"
          marcada={v.fechas_confirmadas === "si"}
          ayuda={
            <>
              Mientras no esté marcada, el sitio muestra «Fechas a confirmar» y no acepta ofertas, aunque la fecha de
              inicio ya haya pasado. Marcala cuando la Dirección confirme las fechas.
            </>
          }
        />
      </Seccion>

      <Seccion titulo="Extensión del cierre">
        <Casilla
          id="extension_activa"
          etiqueta="Extender el cierre de una obra si recibe una oferta de último momento"
          marcada={v.extension_activa === "si"}
          error={e.extension_activa}
          ayuda={
            <>
              Una oferta registrada en los últimos minutos antes del cierre de una obra corre el cierre de esa obra hasta
              esa misma cantidad de minutos después de la oferta. Cada obra puede cerrar a una hora distinta. Dejala
              apagada hasta que la Dirección la apruebe; pasada la hora de cierre general ya no se puede cambiar.
            </>
          }
        />
        <div className="md:w-1/2 md:pr-2.5">
          <Campo
            id="extension_minutos"
            etiqueta="Minutos de extensión"
            ayuda={`De 1 a 30. Guardado: ${actuales.extensionMinutos}.`}
            error={e.extension_minutos}
          >
            <input
              id="extension_minutos"
              name="extension_minutos"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              defaultValue={v.extension_minutos}
              className="campo"
              {...describir("extension_minutos", true, e.extension_minutos)}
            />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Subasta presencial">
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            id="fecha_presencial"
            etiqueta="Fecha (opcional)"
            ayuda="Si la dejás vacía, el sitio dice que la fecha está por confirmarse."
            error={e.fecha_presencial}
          >
            <input
              id="fecha_presencial"
              name="fecha_presencial"
              type="date"
              defaultValue={v.fecha_presencial}
              className="campo"
              {...describir("fecha_presencial", true, e.fecha_presencial)}
            />
          </Campo>
          <Campo
            id="detalle_presencial"
            etiqueta="Lugar y hora (opcional)"
            ayuda="Se muestra después de la fecha, solo si cargaste la fecha. Escribilo como una oración, por ejemplo: A las 19, en el Cementerio del Oeste."
            error={e.detalle_presencial}
          >
            <input
              id="detalle_presencial"
              name="detalle_presencial"
              type="text"
              maxLength={300}
              autoComplete="off"
              defaultValue={v.detalle_presencial}
              className="campo"
              {...describir("detalle_presencial", true, e.detalle_presencial)}
            />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Montos">
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            id="incremento_minimo"
            etiqueta="Incremento mínimo (en pesos)"
            ayuda={`Cada oferta tiene que superar a la anterior por lo menos en este monto. Guardado: ${actuales.incremento}. El cambio rige para las ofertas siguientes.`}
            error={e.incremento_minimo}
          >
            <input
              id="incremento_minimo"
              name="incremento_minimo"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              defaultValue={v.incremento_minimo}
              className="campo"
              {...describir("incremento_minimo", true, e.incremento_minimo)}
            />
          </Campo>
          <Campo
            id="precio_salida"
            etiqueta="Precio de salida general (en pesos)"
            ayuda={`Monto mínimo de la primera oferta de cada obra, salvo las que tienen precio propio. ${precioPropio} Guardado: ${actuales.precioSalida}.`}
            error={e.precio_salida}
          >
            <input
              id="precio_salida"
              name="precio_salida"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              defaultValue={v.precio_salida}
              className="campo"
              {...describir("precio_salida", true, e.precio_salida)}
            />
          </Campo>
        </div>
        <p className="text-base text-gris">Montos en pesos enteros, sin centavos, de hasta $ 1.000.000.000.</p>
      </Seccion>

      <Seccion titulo="Sitio">
        <Casilla
          id="modo_ejemplo"
          etiqueta="Modo ejemplo: mostrar la franja «Datos de ejemplo» en todo el sitio"
          marcada={v.modo_ejemplo === "si"}
          ayuda="Usalo mientras el sitio tenga obras, artistas u ofertas de prueba. Desmarcalo antes de trabajar con los datos reales."
        />
      </Seccion>

      {motivos.length > 0 && (
        <div className="space-y-3 rounded-lg bg-ambar-suave px-4 py-4 text-tinta ring-1 ring-ambar/30 ring-inset md:px-5">
          <p className="text-lg font-semibold">Confirmá el cambio</p>
          <ul id="confirmar-detalle" className="list-disc space-y-2 pl-6">
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <input type="hidden" name="confirmacion_para" value={v.confirmacion_para ?? ""} />
          <div className="flex items-start gap-3 rounded-lg bg-white p-3">
            <input
              id="confirmar"
              name="confirmar"
              type="checkbox"
              value="si"
              aria-describedby="confirmar-detalle"
              className="mt-1 h-6 w-6 shrink-0 accent-azul"
            />
            <label htmlFor="confirmar" className="font-semibold">
              Entiendo lo que implica y quiero guardar este cambio.
            </label>
          </div>
        </div>
      )}

      <MensajeAccion estado={estado} />

      {/* Barra de guardado: queda a la vista al pie de la pantalla mientras se recorre el formulario. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-linea bg-white/90 px-4 py-3 backdrop-blur-md md:mx-0 md:rounded-lg md:border md:px-5 md:shadow-tarjeta">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="text-[0.9rem] text-gris">Los cambios se aplican al guardar y quedan registrados en la auditoría.</p>
          <BotonEnviar className="w-full sm:w-auto">Guardar configuración</BotonEnviar>
        </div>
      </div>
    </form>
  );
}
