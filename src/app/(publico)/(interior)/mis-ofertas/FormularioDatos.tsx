"use client";

import { useActionState, useEffect, useRef } from "react";
import { guardarDatos, type EstadoDatos } from "./acciones";

export function FormularioDatos({ telefono, email, avisos }: { telefono: string; email: string; avisos: boolean }) {
  const [estado, enviar, enviando] = useActionState<EstadoDatos, FormData>(guardarDatos, {});
  const telefonoRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorTelefono = estado.campo === "telefono";
  const errorEmail = estado.campo === "email";

  // Con el foco en el campo, el lector de pantalla lee el error asociado.
  useEffect(() => {
    if (estado.campo === "telefono") telefonoRef.current?.focus();
    if (estado.campo === "email") emailRef.current?.focus();
  }, [estado]);

  return (
    <>
      <form action={enviar} className="space-y-4">
        <div>
          <label htmlFor="telefono" className="etiqueta">
            Teléfono
          </label>
          <input
            ref={telefonoRef}
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            // Tras un error se conserva lo que la persona escribió (React vuelve el formulario
            // a los valores por defecto después de cada envío).
            defaultValue={estado.valores?.telefono ?? telefono}
            className="campo"
            aria-invalid={errorTelefono ? true : undefined}
            aria-describedby={errorTelefono ? "telefono-ayuda datos-error" : "telefono-ayuda"}
          />
          <p id="telefono-ayuda" className="mt-1.5 text-gris">
            Con código de área, por ejemplo 381 555 1234.
          </p>
        </div>
        <div>
          <label htmlFor="email" className="etiqueta">
            Correo
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={estado.valores?.email ?? email}
            className="campo"
            aria-invalid={errorEmail ? true : undefined}
            aria-describedby={errorEmail ? "email-ayuda datos-error" : "email-ayuda"}
          />
          <p id="email-ayuda" className="mt-1.5 text-gris">
            Es al que te mandamos los avisos.
          </p>
        </div>
        <label className="flex items-start gap-3 text-lg">
          <input
            type="checkbox"
            name="avisos"
            value="si"
            defaultChecked={estado.valores?.avisos ?? avisos}
            className="mt-1 h-6 w-6 shrink-0 accent-azul"
          />
          <span>Avisarme por correo cuando alguien supere mi oferta.</span>
        </label>
        {estado.error && (
          <p
            key={estado.vez}
            id={estado.campo ? "datos-error" : undefined}
            role="alert"
            className="rounded-md border-l-2 border-rojo bg-rojo-suave px-4 py-3 font-medium text-tinta"
          >
            {estado.error}
          </p>
        )}
        <button type="submit" className="boton-secundario w-full" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
      {/* Región siempre presente: el aviso se vuelve a insertar (key) en cada guardado y se anuncia. */}
      <div role="status" className="mt-4 empty:mt-0">
        {estado.ok && (
          <p key={estado.vez} className="rounded-md border-l-2 border-verde bg-verde-suave px-4 py-3 font-medium text-tinta">
            Guardamos los cambios.
          </p>
        )}
      </div>
    </>
  );
}
