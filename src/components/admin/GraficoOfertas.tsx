import type { OfertasDelDia } from "@/lib/datos/admin/tablero";
import { numeroConPuntos } from "@/lib/formato";

// Gráfico de columnas del tablero: ofertas válidas por día. Se dibuja en el servidor con HTML y
// CSS (sin librerías). Una sola serie: el título dice qué se ve, no lleva leyenda. Cada columna
// muestra su valor al pasar el mouse y los datos están completos en la tabla de abajo.

/** Como mucho, los últimos 21 días: con más, las columnas quedarían demasiado finas. */
const MAX_DIAS = 21;

const formatoSemana = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short" });

function fechaUTC(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** "31/10" */
function diaMes(dia: string) {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** "sáb 31/10" (armado a mano: el formato de Intl separa con guiones según el motor). */
function diaCorto(dia: string) {
  return `${formatoSemana.format(fechaUTC(dia)).replace(".", "")} ${diaMes(dia)}`;
}

/**
 * Serie continua desde el primer día con ofertas hasta `hasta` (o el último día con datos, si es
 * posterior), con 0 en los días sin ofertas. `hasta` va como "2026-10-31".
 */
export function serieDiaria(datos: OfertasDelDia[], hasta: string): OfertasDelDia[] {
  if (datos.length === 0) return [];
  const porDia = new Map(datos.map((d) => [d.dia, d.ofertas]));
  const ultimo = datos[datos.length - 1].dia;
  const fin = fechaUTC(hasta > ultimo ? hasta : ultimo);
  const serie: OfertasDelDia[] = [];
  for (const f = fechaUTC(datos[0].dia); f <= fin; f.setUTCDate(f.getUTCDate() + 1)) {
    const dia = f.toISOString().slice(0, 10);
    serie.push({ dia, ofertas: porDia.get(dia) ?? 0 });
  }
  return serie.slice(-MAX_DIAS);
}

/** Tope del eje con números redondos (paso de 1, 2 o 5 por potencia de 10, hasta 4 marcas). */
function escala(maximo: number) {
  for (let potencia = 1; ; potencia *= 10) {
    for (const base of [1, 2, 5]) {
      const paso = base * potencia;
      if (Math.ceil(maximo / paso) <= 4) {
        const tope = paso * Math.max(1, Math.ceil(maximo / paso));
        return { tope, marcas: Array.from({ length: tope / paso + 1 }, (_, i) => i * paso) };
      }
    }
  }
}

export function GraficoOfertasPorDia({ serie }: { serie: OfertasDelDia[] }) {
  const maximo = Math.max(...serie.map((d) => d.ofertas));
  const total = serie.reduce((s, d) => s + d.ofertas, 0);
  const { tope, marcas } = escala(maximo);
  const iMaximo = serie.findLastIndex((d) => d.ofertas === maximo);
  // Rótulos del eje horizontal: como mucho 7, siempre el último día.
  const cada = Math.ceil(serie.length / 7);
  const conRotulo = (i: number) => (serie.length - 1 - i) % cada === 0;
  const plural = (n: number) => `${numeroConPuntos(n)} ${n === 1 ? "oferta" : "ofertas"}`;

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-semibold text-tinta">Ofertas válidas por día</span>
        <span className="text-[0.85rem] text-gris">Hora de Tucumán</span>
      </figcaption>
      <p className="sr-only">
        Del {diaCorto(serie[0].dia)} al {diaCorto(serie[serie.length - 1].dia)}: {plural(total)} en total. El día con más
        ofertas fue el {diaCorto(serie[iMaximo].dia)}, con {plural(maximo)}. Los datos de cada día están en la tabla.
      </p>

      <div aria-hidden className="mt-5">
        <div className="relative h-44 pl-9">
          {/* Líneas guía: finas y en el gris de los bordes. */}
          {marcas.map((m) => (
            <div key={m} className="absolute right-0 left-9 border-t border-linea" style={{ bottom: `${(m / tope) * 100}%` }}>
              <span className="absolute -top-2.5 -left-9 w-7 text-right text-[0.75rem] leading-none text-gris tabular-nums">
                {numeroConPuntos(m)}
              </span>
            </div>
          ))}
          <ol className="absolute inset-y-0 right-0 left-9 flex items-end gap-0.5">
            {serie.map((d, i) => {
              const alto = (d.ofertas / tope) * 100;
              return (
                // Toda la columna responde al mouse: el blanco es más fácil de acertar que la barra.
                <li key={d.dia} className="group relative flex h-full flex-1 items-end justify-center">
                  {d.ofertas > 0 && (
                    <span
                      className="barra-grafico block w-full max-w-6 rounded-t-[4px] bg-smt transition-colors duration-200 group-hover:bg-smt-intenso"
                      style={{ height: `${alto}%`, ["--retraso" as string]: `${i * 25}ms` }}
                    />
                  )}
                  {i === iMaximo && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[0.8rem] font-semibold text-tinta tabular-nums transition-opacity group-hover:opacity-0"
                      style={{ bottom: `calc(${alto}% + 4px)` }}
                    >
                      {numeroConPuntos(d.ofertas)}
                    </span>
                  )}
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-tinta px-2.5 py-1.5 text-[0.8rem] whitespace-nowrap text-white opacity-0 shadow-elevada transition-opacity duration-150 group-hover:opacity-100"
                    style={{ bottom: `calc(${alto}% + 8px)` }}
                  >
                    <strong className="font-semibold">{plural(d.ofertas)}</strong> · {diaCorto(d.dia)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <ol className="mt-2 flex gap-0.5 pl-9">
          {serie.map((d, i) => (
            <li key={d.dia} className="relative h-4 flex-1">
              {conRotulo(i) && (
                <span className="absolute left-1/2 -translate-x-1/2 text-[0.72rem] whitespace-nowrap text-gris tabular-nums">
                  {diaMes(d.dia)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-[0.9rem] font-semibold text-azul">Ver los datos en una tabla</summary>
        <table className="tabla-panel mt-3">
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col" className="text-right">
                Ofertas válidas
              </th>
            </tr>
          </thead>
          <tbody>
            {serie.map((d) => (
              <tr key={d.dia}>
                <td>{diaCorto(d.dia)}</td>
                <td className="text-right">{numeroConPuntos(d.ofertas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
