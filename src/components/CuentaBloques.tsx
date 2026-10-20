"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

const TAMANOS = {
  grande: {
    cifra: "text-[clamp(2rem,1.3rem+2vw,3.1rem)]",
    separador: "px-1 text-[clamp(1.6rem,1rem+1.6vw,2.4rem)] min-[25rem]:px-2 sm:px-3 lg:px-5",
    // En pantallas muy angostas, las unidades abreviadas (el texto completo no entra).
    unidades: ["Días", "Horas", ["Minutos", "Min"], ["Segundos", "Seg"]],
  },
  compacto: {
    cifra: "text-[1.75rem]",
    separador: "px-1.5 text-[1.4rem] sm:px-2.5",
    unidades: ["Días", "Horas", "Min", "Seg"],
  },
} satisfies Record<string, { cifra: string; separador: string; unidades: (string | [string, string])[] }>;

function Unidad({ texto }: { texto: string | readonly [string, string] }) {
  if (typeof texto === "string") return texto;
  return (
    <>
      <span className="max-[25rem]:hidden">{texto[0]}</span>
      <span className="min-[25rem]:hidden">{texto[1]}</span>
    </>
  );
}

/**
 * Cuenta regresiva (días : horas : minutos : segundos). Toma la hora del servidor como
 * referencia; igual, quien decide si una oferta entra es el servidor. Para lectores de pantalla
 * se anuncia una sola frase, no cada segundo. El rótulo visible lo pone quien la usa.
 */
export function CuentaBloques({
  objetivo,
  ahoraServidor,
  etiqueta,
  alTerminar,
  tamano = "grande",
}: {
  objetivo: string;
  ahoraServidor: string;
  /** Comienzo de la frase para lectores de pantalla ("La subasta virtual finaliza en"). */
  etiqueta: string;
  alTerminar: string;
  tamano?: keyof typeof TAMANOS;
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
    return <p className="font-display text-xl font-semibold text-tinta">{alTerminar}</p>;
  }

  const t = TAMANOS[tamano];
  const s = Math.floor(restante / 1000);
  const valores = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  const resumen = `${etiqueta} ${valores[0]} días, ${valores[1]} horas y ${valores[2]} minutos`;

  return (
    <div>
      <p className="sr-only">{resumen}</p>
      <div aria-hidden className="flex items-start">
        {valores.map((valor, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={`font-display leading-none font-light text-gris-suave/70 ${t.separador}`}>:</span>}
            <span className="flex flex-col items-center">
              <span className={`font-display leading-none font-medium tracking-[-0.03em] text-tinta tabular-nums ${t.cifra}`}>
                {String(valor).padStart(2, "0")}
              </span>
              <span className="rotulo mt-2 tracking-[0.12em]">
                <Unidad texto={t.unidades[i]} />
              </span>
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
