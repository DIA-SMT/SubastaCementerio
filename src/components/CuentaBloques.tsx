"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Cuenta regresiva en bloques (días, horas, minutos, segundos). Toma la hora del servidor como
 * referencia; igual, quien decide si una oferta entra es el servidor. Para lectores de pantalla
 * se anuncia una sola frase, no cada segundo.
 */
export function CuentaBloques({
  objetivo,
  ahoraServidor,
  etiqueta,
  alTerminar,
  claro = false,
}: {
  objetivo: string;
  ahoraServidor: string;
  etiqueta: string;
  alTerminar: string;
  claro?: boolean;
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

  if (restante <= 0) {
    return <p className={`text-xl font-bold ${claro ? "text-white" : "text-tinta"}`}>{alTerminar}</p>;
  }

  const s = Math.floor(restante / 1000);
  const partes = [
    { valor: Math.floor(s / 86400), unidad: "días" },
    { valor: Math.floor((s % 86400) / 3600), unidad: "horas" },
    { valor: Math.floor((s % 3600) / 60), unidad: "min" },
    { valor: s % 60, unidad: "seg" },
  ];
  const resumen = `${etiqueta} ${partes[0].valor} días, ${partes[1].valor} horas y ${partes[2].valor} minutos`;

  return (
    <div>
      <p className={`font-bold ${claro ? "text-white" : "text-tinta"}`}>{etiqueta}</p>
      <p className="sr-only">{resumen}</p>
      <div aria-hidden className="mt-2 grid grid-cols-4 gap-2">
        {partes.map((p) => (
          <div
            key={p.unidad}
            className={`rounded-2xl px-1 py-2.5 text-center ${
              claro ? "bg-white/15 ring-1 ring-white/30" : "bg-fondo ring-1 ring-azul/15"
            }`}
          >
            <span className={`block text-3xl leading-none font-extrabold tabular-nums ${claro ? "text-white" : "text-tinta"}`}>
              {String(p.valor).padStart(2, "0")}
            </span>
            <span className={`mt-1 block text-sm font-bold ${claro ? "text-white" : "text-texto"}`}>{p.unidad}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
