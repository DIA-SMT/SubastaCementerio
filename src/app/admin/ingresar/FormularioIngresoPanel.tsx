"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { estadoInicial } from "@/lib/admin/acciones";
import { ingresarAlPanel } from "./acciones";

export function FormularioIngresoPanel() {
  const [estado, enviar] = useActionState(ingresarAlPanel, estadoInicial);
  return (
    <form action={enviar} className="space-y-5">
      <div>
        <label htmlFor="email" className="etiqueta">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={estado.valores?.email}
          className="campo"
        />
      </div>
      <div>
        <label htmlFor="contrasena" className="etiqueta">
          Contraseña
        </label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required className="campo" />
      </div>
      {estado.error && (
        <p role="alert" className="rounded-xl border-l-8 border-rojo bg-rojo-suave px-4 py-3 font-bold text-tinta">
          {estado.error}
        </p>
      )}
      <BotonEnviar enviando="Ingresando…" className="w-full">
        Ingresar al panel
      </BotonEnviar>
    </form>
  );
}
