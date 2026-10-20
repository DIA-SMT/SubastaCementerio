// Formatos para Argentina. Las horas siempre en hora de Tucumán.

export const ZONA = "America/Argentina/Tucuman";

const formatoPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function pesos(monto: number) {
  return formatoPesos.format(monto);
}

export function numeroConPuntos(monto: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(monto);
}

export function tituloObra(titulo: string | null) {
  return titulo?.trim() || "Sin título";
}

/** "sábado 7 de noviembre a las 20:00" */
export function fechaHoraLarga(fecha: Date) {
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
  return `${dia} a las ${hora}`;
}

/** "sábado 7 de noviembre" a partir de AAAA-MM-DD (sin corrimiento de zona). */
export function fechaLarga(isoDia: string) {
  const [a, m, d] = isoDia.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** "hace 2 h", "hace 5 min", "hace 3 días" respecto de `ahora`. */
export function haceCuanto(fecha: Date, ahora: Date) {
  const minutos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 60000));
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** "12 días, 4 horas y 23 minutos"; en el último minuto, "menos de un minuto". */
export function duracionEnPalabras(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (ms > 0 && totalMin === 0) return "menos de un minuto";
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;
  const partes: string[] = [];
  if (dias) partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
  if (horas) partes.push(`${horas} ${horas === 1 ? "hora" : "horas"}`);
  if (minutos || partes.length === 0) partes.push(`${minutos} ${minutos === 1 ? "minuto" : "minutos"}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}
