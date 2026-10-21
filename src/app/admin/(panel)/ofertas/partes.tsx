import Link from "next/link";
import { Etiqueta } from "@/components/admin/Panel";
import { ZONA } from "@/lib/formato";

// Piezas compartidas por las pantallas de ofertas y oferentes del panel (sin hooks).

const formatoFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "19/10/2026 14:32" en hora de Tucumán. */
export function fechaHora(fecha: Date) {
  const p = Object.fromEntries(formatoFechaHora.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Fecha y hora con la marca de tiempo completa para lectores de pantalla y buscadores. */
export function FechaHora({ fecha }: { fecha: Date }) {
  return (
    <time dateTime={fecha.toISOString()} className="whitespace-nowrap">
      {fechaHora(fecha)}
    </time>
  );
}

/** Lee un identificador numérico de oferta desde la URL. */
export function idDeOferta(valor: string | string[] | undefined) {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto || !/^\d{1,15}$/.test(texto)) return null;
  const n = Number(texto);
  return n > 0 ? n : null;
}

/** Primer valor de un parámetro de búsqueda. */
export function parametro(valor: string | string[] | undefined) {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export function EstadoDeOferta({ estado, esLaMasAlta }: { estado: "valida" | "anulada"; esLaMasAlta: boolean }) {
  if (estado === "anulada") return <Etiqueta tono="rojo">Anulada</Etiqueta>;
  return (
    <span className="flex flex-wrap gap-1.5">
      <Etiqueta tono="gris">Válida</Etiqueta>
      {esLaMasAlta && <Etiqueta tono="verde">Más alta</Etiqueta>}
    </span>
  );
}

/** Teléfono como enlace para llamar desde el celular. */
export function EnlaceTelefono({ telefono }: { telefono: string }) {
  return (
    <a href={`tel:${telefono.replace(/[^\d+]/g, "")}`} className="enlace whitespace-nowrap">
      {telefono}
    </a>
  );
}

export function EnlaceCorreo({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="enlace break-all">
      {email}
    </a>
  );
}

/**
 * "Oferente 12" con enlace a la ficha de la persona y, si está bloqueada, la etiqueta
 * "Bloqueado" (bloquear no anula sus ofertas: el equipo las revisa desde estas pantallas).
 */
export function EnlaceOferente({ id, alias, bloqueado = false }: { id: string; alias: number; bloqueado?: boolean }) {
  const enlace = (
    <Link href={`/admin/oferentes/${id}`} className="enlace whitespace-nowrap">
      Oferente {alias}
    </Link>
  );
  if (!bloqueado) return enlace;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {enlace}
      <Etiqueta tono="rojo">Bloqueado</Etiqueta>
    </span>
  );
}

/** Enlace con forma de botón chico, para usar dentro de tablas. */
export const claseBotonChico =
  "inline-flex min-h-11 items-center justify-center rounded-lg border-2 px-3 text-base font-semibold whitespace-nowrap";
