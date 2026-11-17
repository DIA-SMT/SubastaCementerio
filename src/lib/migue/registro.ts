import { LARGO_REGISTRO, recortar, taparNombresPresentados } from "./limites";
import type { ConsultaServicio } from "./tope";

/**
 * El registro de lo que le preguntan a Migue (public.consultas_migue; núcleo de Migue,
 * CementerIA src/lib/migue/registro.ts). Existe para mejorar las respuestas: cada
 * `sin_respuesta` es un tema que la gente busca y los datos no cubren.
 *
 * - No guarda nada que identifique a la persona (ni la IP: el tope la usa como HMAC, en otra
 *   tabla y sin forma de cruzarlas).
 * - La pregunta y la respuesta van recortadas a 500 caracteres, y en la pregunta se tapan los
 *   nombres presentados («soy…»). Una pregunta con DNI, CUIL, teléfono o correo no llega acá:
 *   se rechazó antes y se anota sin el texto (`rechazada`).
 * - Solo inserción (trigger consultas_migue_proteger); 90 días y se borra sola
 *   (f_purgar_migue, desde /api/avisos).
 *
 * **Nunca hace fallar la respuesta**: si el insert falla, se anota en el log y sigue.
 */

export const RESULTADOS_CONSULTA = ["respondida", "sin_respuesta", "fallback", "tope", "rechazada", "error"] as const;
export type ResultadoConsulta = (typeof RESULTADOS_CONSULTA)[number];

export type CanalMigue = "publico";

export interface DatosConsulta {
  canal: CanalMigue;
  resultado: ResultadoConsulta;
  duracionMs: number;
  tokensEntrada?: number | null;
  tokensSalida?: number | null;
  modelo?: string | null;
  pregunta: string;
  respuesta: string;
}

/** Lo que va a la base, ya acotado. Pura (se prueba sin base). */
export function filaDeConsulta(d: DatosConsulta) {
  return {
    canal: d.canal,
    resultado: d.resultado,
    duracionMs: Math.max(0, Math.round(d.duracionMs)),
    tokensEntrada: d.tokensEntrada ?? null,
    tokensSalida: d.tokensSalida ?? null,
    modelo: d.modelo ? d.modelo.slice(0, 100) : null,
    pregunta: d.resultado === "rechazada" ? "" : recortar(taparNombresPresentados(d.pregunta), LARGO_REGISTRO),
    respuesta: recortar(d.respuesta, LARGO_REGISTRO),
  };
}

export async function registrarConsulta(escribir: ConsultaServicio, datos: DatosConsulta): Promise<void> {
  const f = filaDeConsulta(datos);
  try {
    await escribir((q) =>
      q(
        `insert into public.consultas_migue
           (canal, resultado, duracion_ms, tokens_entrada, tokens_salida, modelo, pregunta, respuesta)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [f.canal, f.resultado, f.duracionMs, f.tokensEntrada, f.tokensSalida, f.modelo, f.pregunta, f.respuesta],
      ),
    );
  } catch (error) {
    console.warn("migue.registro_fallo", datos.canal, datos.resultado, error instanceof Error ? error.message : typeof error);
  }
}
