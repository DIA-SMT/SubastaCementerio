"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { registrarse, type EstadoRegistro } from "./acciones";

function MensajeError({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p id={id} className="mt-1.5 font-bold text-tinta">
      <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rojo" />
      {texto}
    </p>
  );
}

export function FormularioRegistro({ volver, email }: { volver: string; email: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoRegistro, FormData>(registrarse, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};
  const formulario = useRef<HTMLFormElement>(null);

  // Después de un envío con errores, el foco va al primer campo para revisar (el lector lee su
  // error) o, si el error es general, al aviso.
  useEffect(() => {
    const errores = estado.errores ?? {};
    if (Object.keys(errores).length === 0) return;
    const primero =
      formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      (errores.general ? document.getElementById("error-general") : null);
    primero?.focus();
  }, [estado]);

  const casilla = (nombre: "bases" | "privacidad") => ({
    name: nombre,
    value: "si",
    defaultChecked: v[nombre] === "si",
    "aria-invalid": e.aceptacion && v[nombre] !== "si" ? true : undefined,
    "aria-describedby": e.aceptacion ? "error-aceptacion" : undefined,
    className: "mt-1 h-6 w-6 shrink-0 accent-azul",
  });

  const campo = (
    nombre: "nombre" | "apellido" | "dni" | "telefono",
    etiqueta: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
    ayuda?: string,
  ) => (
    <div>
      <label htmlFor={nombre} className="etiqueta">
        {etiqueta}
      </label>
      <input
        id={nombre}
        name={nombre}
        required
        defaultValue={v[nombre]}
        className="campo"
        aria-invalid={e[nombre] ? true : undefined}
        aria-describedby={[ayuda && `ayuda-${nombre}`, e[nombre] && `error-${nombre}`].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {ayuda && (
        <p id={`ayuda-${nombre}`} className="mt-1 text-gris">
          {ayuda}
        </p>
      )}
      <MensajeError id={`error-${nombre}`} texto={e[nombre]} />
    </div>
  );

  return (
    <form ref={formulario} action={enviar} className="space-y-5" noValidate>
      <input type="hidden" name="volver" value={volver} />
      <div className="rounded-xl bg-fondo px-4 py-3">
        <p className="text-texto">Correo confirmado</p>
        <p className="font-bold break-all text-tinta">{email}</p>
      </div>

      {campo("nombre", "Nombre", { autoComplete: "given-name" })}
      {campo("apellido", "Apellido", { autoComplete: "family-name" })}
      {campo("dni", "DNI", { inputMode: "numeric", autoComplete: "off" }, "Solo números, sin puntos.")}
      {campo("telefono", "Teléfono", { type: "tel", inputMode: "tel", autoComplete: "tel" }, "Con código de área, por ejemplo 381 555 1234.")}

      <fieldset className="space-y-3 rounded-xl border-2 border-linea p-4">
        <legend className="px-1 font-bold text-tinta">Antes de participar</legend>
        <label className="flex items-start gap-3 text-lg">
          <input type="checkbox" {...casilla("bases")} />
          <span>
            Leí y acepto las{" "}
            <Link href="/bases-y-condiciones" target="_blank" className="enlace">
              bases y condiciones
            </Link>{" "}
            (se abren en otra pestaña).
          </span>
        </label>
        <label className="flex items-start gap-3 text-lg">
          <input type="checkbox" {...casilla("privacidad")} />
          <span>
            Acepto que mis datos se usen según la{" "}
            <Link href="/privacidad" target="_blank" className="enlace">
              política de privacidad
            </Link>{" "}
            (se abre en otra pestaña).
          </span>
        </label>
        <MensajeError id="error-aceptacion" texto={e.aceptacion} />
      </fieldset>

      <p className="text-gris">
        Tu DNI y tus datos de contacto no se muestran en el sitio. En el historial de ofertas aparecés como
        «Oferente» y un número.
      </p>

      {e.general && (
        <p
          key={estado.intento}
          id="error-general"
          role="alert"
          tabIndex={-1}
          className="rounded-xl border-l-8 border-rojo bg-rojo-suave px-4 py-3 font-bold text-tinta"
        >
          {e.general}
        </p>
      )}
      {Object.keys(e).length > 0 && !e.general && (
        // La key cambia en cada respuesta: el aviso se vuelve a anunciar en cada intento.
        <p key={estado.intento} role="alert" className="sr-only">
          Hay datos para revisar en el formulario.
        </p>
      )}

      <button type="submit" className="boton-primario w-full text-xl" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar mis datos"}
      </button>
    </form>
  );
}
