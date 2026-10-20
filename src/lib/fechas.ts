// Conversión entre fechas y los valores de <input type="datetime-local"> y <input type="date">.
// Todo en hora de Tucumán: UTC-3 fijo, sin horario de verano (ver ZONA en formato.ts).
// Sin dependencias de servidor: se puede usar desde componentes cliente.

const DESFASE_MS = 3 * 60 * 60 * 1000;
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

function esFecha(fecha: Date) {
  return fecha instanceof Date && !Number.isNaN(fecha.getTime());
}

/** Date → 'AAAA-MM-DDTHH:mm' en hora de Tucumán (valor para datetime-local). Vacío si la fecha no es válida. */
export function aInputLocal(fecha: Date): string {
  if (!esFecha(fecha)) return "";
  return new Date(fecha.getTime() - DESFASE_MS).toISOString().slice(0, 16);
}

/** Date → 'AAAA-MM-DD' del día en Tucumán (valor para <input type="date">). */
export function aInputDia(fecha: Date): string {
  if (!esFecha(fecha)) return "";
  return new Date(fecha.getTime() - DESFASE_MS).toISOString().slice(0, 10);
}

function partesDeDia(valor: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO || mes < 1 || mes > 12 || dia < 1) return null;
  // Descarta días que no existen (31 de abril, 29 de febrero en años no bisiestos).
  const control = new Date(Date.UTC(anio, mes - 1, dia));
  if (control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

/**
 * 'AAAA-MM-DDTHH:mm' (hora de Tucumán) → Date, o null si el valor no es una fecha válida.
 * Acepta segundos opcionales ('AAAA-MM-DDTHH:mm:ss'), que algunos navegadores agregan.
 */
export function desdeInputLocal(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
  if (!m) return null;
  const dia = partesDeDia(m[1]);
  if (!dia) return null;
  const [hora, minuto, segundo] = [Number(m[2]), Number(m[3]), Number(m[4] ?? 0)];
  if (hora > 23 || minuto > 59 || segundo > 59) return null;
  return new Date(Date.UTC(dia.anio, dia.mes - 1, dia.dia, hora, minuto, segundo) + DESFASE_MS);
}

/** Valida 'AAAA-MM-DD' (valor de <input type="date">). Devuelve el mismo texto o null. */
export function diaDesdeInput(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return partesDeDia(texto) ? texto : null;
}
