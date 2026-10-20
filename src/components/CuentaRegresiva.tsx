"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { duracionEnPalabras } from "@/lib/formato";

/**
 * Cuenta regresiva informativa. Usa la hora del servidor como referencia para no depender
 * del reloj del celular; igual, quien decide si una oferta entra es el servidor.
 */
export function CuentaRegresiva({
  objetivo,
  ahoraServidor,
  prefijo,
  alTerminar = "Terminó el plazo.",
}: {
  objetivo: string;
  ahoraServidor: string;
  prefijo: string;
  alTerminar?: string;
}) {
  const router = useRouter();
  const meta = new Date(objetivo).getTime();
  const [restante, setRestante] = useState(meta - new Date(ahoraServidor).getTime());

  useEffect(() => {
    const desfase = new Date(ahoraServidor).getTime() - Date.now();
    let avisado = false;
    const tic = () => {
      const r = meta - (Date.now() + desfase);
      setRestante(r);
      if (r <= 0 && !avisado) {
        avisado = true;
        router.refresh();
      }
    };
    tic();
    const id = setInterval(tic, 1000);
    return () => clearInterval(id);
  }, [meta, ahoraServidor, router]);

  if (restante <= 0) return <span>{alTerminar}</span>;
  return (
    <span>
      {prefijo} <strong className="font-bold text-tinta">{duracionEnPalabras(restante)}</strong>
    </span>
  );
}
