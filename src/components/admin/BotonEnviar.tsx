"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Botón de envío que se deshabilita y cambia el texto mientras el formulario se procesa. */
export function BotonEnviar({
  children,
  enviando = "Guardando…",
  variante = "primario",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  enviando?: ReactNode;
  variante?: "primario" | "secundario" | "peligro";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const clase = { primario: "boton-primario", secundario: "boton-secundario", peligro: "boton-peligro" }[variante];
  return (
    <button type="submit" className={`${clase} ${className}`} disabled={pending} name={name} value={value}>
      {pending ? enviando : children}
    </button>
  );
}
