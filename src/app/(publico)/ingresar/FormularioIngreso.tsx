"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { confirmarCodigo, pedirCodigo, type EstadoIngreso } from "./acciones";

const ESTILO_ERROR = "rounded-xl border-l-8 border-rojo bg-rojo-suave px-4 py-3 font-bold text-tinta";

/** Une los id de aria-describedby que existen. */
const describir = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

/** El botón que tenía el foco se deshabilitó mientras se enviaba y el foco quedó en la página. */
const focoPerdido = () => !document.activeElement || document.activeElement === document.body;

export function FormularioIngreso({ volver }: { volver: string }) {
  const [correo, pedir, pidiendo] = useActionState<EstadoIngreso, FormData>(pedirCodigo, { paso: "correo" });
  const [codigo, confirmar, confirmando] = useActionState<EstadoIngreso, FormData>(confirmarCodigo, {
    paso: "codigo",
  });
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);

  // Después de un error, si el foco se perdió, vuelve al campo, que lee el error.
  useEffect(() => {
    if (correo.paso === "correo" && correo.error && focoPerdido()) campoEmail.current?.focus();
  }, [correo]);
  useEffect(() => {
    if (codigo.error && focoPerdido()) campoCodigo.current?.focus();
  }, [codigo]);

  if (correo.paso === "codigo" && correo.email) {
    const reenvio = (correo.envios ?? 1) > 1;
    // Un error de un código anterior no se muestra después de pedir otro.
    const errorCodigo = codigo.envio === correo.envios ? codigo.error : undefined;
    return (
      <form key="codigo" action={confirmar} className="space-y-5">
        <input type="hidden" name="email" value={correo.email} />
        <input type="hidden" name="volver" value={volver} />
        <input type="hidden" name="envio" value={correo.envios ?? 1} />
        {/* Queda montado mientras dura este paso: cada reenvío cambia su contenido y se anuncia. */}
        <div id="aviso-codigo" role="status" className="rounded-xl bg-fondo px-4 py-3 text-lg text-tinta">
          <span key={correo.envios}>
            {reenvio ? "Te mandamos otro código" : "Te mandamos un código de 6 números"} a{" "}
            <strong className="break-all">{correo.email}</strong>. {reenvio && "Usá el último que te llegó. "}
            Si no lo ves, revisá la carpeta de correo no deseado.
          </span>
        </div>
        {correo.codigoLocal && (
          <div role="note" className="rounded-xl border-l-8 border-ambar bg-ambar-suave px-4 py-3 text-tinta">
            <p className="font-bold">Modo local: no se envían correos</p>
            <p>
              Tu código es <strong className="text-2xl tracking-widest">{correo.codigoLocal}</strong>
            </p>
          </div>
        )}
        <div>
          <label htmlFor="codigo" className="etiqueta text-xl">
            Código
          </label>
          <input
            ref={campoCodigo}
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            // Al pasar a este paso, el foco va al campo y el lector lee también el aviso.
            autoFocus
            className="campo text-center text-3xl font-bold tracking-[0.4em]"
            aria-invalid={errorCodigo ? true : undefined}
            aria-describedby={describir(errorCodigo && "error-codigo", "aviso-codigo")}
          />
        </div>
        {errorCodigo && (
          <p key={codigo.intento} id="error-codigo" role="alert" className={ESTILO_ERROR}>
            {errorCodigo}
          </p>
        )}
        <button type="submit" className="boton-primario w-full text-xl" disabled={confirmando}>
          {confirmando ? "Revisando…" : "Ingresar"}
        </button>
        <p className="text-center">¿No llegó? Podés pedir otro código:</p>
        <OtroCodigo email={correo.email} pedir={pedir} pidiendo={pidiendo} error={correo.error} />
        {correo.error && (
          <p key={correo.intento} id="error-reenvio" role="alert" className={ESTILO_ERROR}>
            {correo.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form key="correo" action={pedir} className="space-y-5">
      <div>
        <label htmlFor="email" className="etiqueta text-xl">
          Tu correo electrónico
        </label>
        <input
          ref={campoEmail}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={correo.email}
          className="campo"
          aria-invalid={correo.error ? true : undefined}
          aria-describedby={describir(correo.error && "error-email")}
        />
      </div>
      {correo.error && (
        <p key={correo.intento} id="error-email" role="alert" className={ESTILO_ERROR}>
          {correo.error}
        </p>
      )}
      <button type="submit" className="boton-primario w-full text-xl" disabled={pidiendo}>
        {pidiendo ? "Enviando…" : "Enviarme el código"}
      </button>
    </form>
  );
}

function OtroCodigo({
  email,
  pedir,
  pidiendo,
  error,
}: {
  email: string;
  pedir: (d: FormData) => void;
  pidiendo: boolean;
  error?: string;
}) {
  // aria-disabled en lugar de disabled: así el botón no pierde el foco mientras se envía y
  // el anuncio del reenvío (o su error) llega sin que la persona tenga que buscar dónde quedó.
  return (
    <button
      type="button"
      className="boton-secundario w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      aria-disabled={pidiendo || undefined}
      aria-describedby={error ? "error-reenvio" : undefined}
      onClick={() => {
        if (pidiendo) return;
        const datos = new FormData();
        datos.set("email", email);
        startTransition(() => pedir(datos));
      }}
    >
      {pidiendo ? "Enviando…" : "Enviar otro código"}
    </button>
  );
}
