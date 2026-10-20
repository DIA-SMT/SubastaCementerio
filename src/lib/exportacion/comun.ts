import { ZONA, pesos } from "@/lib/formato";
import type { FilaListado, ObraNoPublicada, OferenteListado, TotalesListado } from "./tipos";

// Utilidades compartidas por la planilla, los PDF y las rutas de descarga.
// Todas las fechas se expresan en hora de Tucumán.

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const formatoPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dos = (n: number) => String(n).padStart(2, "0");

/** Componentes de la fecha en hora de Tucumán. */
export function partesTucuman(fecha: Date) {
  const p = Object.fromEntries(formatoPartes.formatToParts(fecha).map((x) => [x.type, x.value]));
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    segundo: Number(p.second),
  };
}

/** "2026-10-19" */
export function diaIso(fecha: Date) {
  const { anio, mes, dia } = partesTucuman(fecha);
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

/** "19/10/2026" */
export function fechaCorta(fecha: Date) {
  const { anio, mes, dia } = partesTucuman(fecha);
  return `${dos(dia)}/${dos(mes)}/${anio}`;
}

/** "14:32" */
export function horaCorta(fecha: Date) {
  const { hora, minuto } = partesTucuman(fecha);
  return `${dos(hora)}:${dos(minuto)}`;
}

/** "19 de octubre de 2026 a las 14:32" */
export function fechaHoraTexto(fecha: Date) {
  const { anio, mes, dia } = partesTucuman(fecha);
  return `${dia} de ${MESES[mes - 1]} de ${anio} a las ${horaCorta(fecha)}`;
}

/** "Octubre de 2026" */
export function mesYAnio(fecha: Date) {
  const { anio, mes } = partesTucuman(fecha);
  const nombre = MESES[mes - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} de ${anio}`;
}

/**
 * Excel no guarda zona horaria: se escribe la hora de Tucumán como si fuera UTC,
 * así la celda muestra la misma hora que el panel.
 */
export function horaTucumanParaExcel(fecha: Date) {
  const { anio, mes, dia, hora, minuto, segundo } = partesTucuman(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));
}

/** listado-final-subasta-2026-10-19.xlsx (con "PRELIMINAR-" adelante si corresponde). */
export function nombreArchivoListado(generado: Date, preliminar: boolean, extension: "xlsx" | "pdf") {
  return `${preliminar ? "PRELIMINAR-" : ""}listado-final-subasta-${diaIso(generado)}.${extension}`;
}

export function totalesListado(filas: FilaListado[]): TotalesListado {
  const conOfertas = filas.filter((f) => f.precioBase != null);
  return {
    obras: filas.length,
    obrasConOfertas: conOfertas.length,
    montoAcumulado: conOfertas.reduce((suma, f) => suma + (f.precioBase ?? 0), 0),
  };
}

/** "N° 3", "N° 3 y N° 14", "N° 3, N° 7 y N° 14" */
function enumerar(partes: string[]) {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** Obras del listado cuya mayor oferta válida es de una persona bloqueada. */
export function filasConOferenteBloqueado(filas: FilaListado[]) {
  return filas.filter(
    (f): f is FilaListado & { oferente: OferenteListado; precioBase: number } =>
      f.oferente?.bloqueado === true && f.precioBase != null,
  );
}

/**
 * Aviso para el encabezado de la planilla y del PDF cuando la mayor oferta de alguna obra es de
 * una persona bloqueada (bloquear no anula sus ofertas). null si no hay ninguna.
 */
export function notaBloqueados(filas: FilaListado[]): string | null {
  const bloqueadas = filasConOferenteBloqueado(filas);
  if (bloqueadas.length === 0) return null;
  const numeros = enumerar(bloqueadas.map((f) => `N° ${f.numero}`));
  return bloqueadas.length === 1
    ? `Atención: en la obra ${numeros} la mayor oferta es de una persona bloqueada. Bloquear no anula sus ofertas: revisala en el panel ("Ofertas de la obra") antes de entregar el listado.`
    : `Atención: en ${bloqueadas.length} obras (${numeros}) la mayor oferta es de una persona bloqueada. Bloquear no anula sus ofertas: revisalas en el panel ("Ofertas de la obra") antes de entregar el listado.`;
}

/** "3 ofertas válidas, la mayor de $ 20.000" o "1 oferta válida de $ 15.000". */
export function resumenOfertas(o: Pick<ObraNoPublicada, "cantidadOfertas" | "mayorOferta">) {
  if (o.cantidadOfertas === 0 || o.mayorOferta == null) return "sin ofertas";
  return o.cantidadOfertas === 1
    ? `1 oferta válida de ${pesos(o.mayorOferta)}`
    : `${o.cantidadOfertas} ofertas válidas, la mayor de ${pesos(o.mayorOferta)}`;
}

/**
 * Nota sobre las obras sin publicar, que no figuran en el listado. Si alguna tiene ofertas
 * válidas, las detalla: esas ofertas no le llegan al martillero. null si no hay ninguna.
 */
export function notaNoPublicadas(noPublicadas: ObraNoPublicada[]): string | null {
  if (noPublicadas.length === 0) return null;
  const inicio =
    noPublicadas.length === 1
      ? "Hay 1 obra sin publicar que no figura en este listado."
      : `Hay ${noPublicadas.length} obras sin publicar que no figuran en este listado.`;
  const conOfertas = noPublicadas.filter((o) => o.cantidadOfertas > 0 && o.mayorOferta != null);
  if (conOfertas.length === 0) return inicio;
  const detalle = enumerar(conOfertas.map((o) => `N° ${o.numero} (${resumenOfertas(o)})`));
  return `${inicio} Ofertas que quedan afuera: ${detalle}.`;
}

/**
 * Parte una dirección de correo larga en renglones de hasta `max` caracteres, cortando
 * después de la arroba, los puntos, guiones o guiones bajos, para que no desborde la columna.
 */
export function renglonesDeCorreo(email: string, max = 28): string[] {
  if (email.length <= max) return [email];
  const tramos = email.match(/[^@.\-_]*[@.\-_]?/g)?.filter(Boolean) ?? [email];
  const renglones: string[] = [];
  let actual = "";
  for (const tramo of tramos) {
    if (actual && actual.length + tramo.length > max) {
      renglones.push(actual);
      actual = "";
    }
    // Un tramo sin cortes más largo que el renglón se parte a la fuerza.
    let resto = tramo;
    while (resto.length > max) {
      renglones.push(resto.slice(0, max));
      resto = resto.slice(max);
    }
    actual += resto;
  }
  if (actual) renglones.push(actual);
  return renglones;
}

/** Dirección de la ficha pública de una obra (lo que codifica el QR). */
export function urlDeObra(urlSitio: string, numero: number) {
  return `${urlSitio.replace(/\/$/, "")}/obras/${numero}`;
}

/** "subasta.smt.gob.ar/obras/7": la dirección sin protocolo, para leer en el cartel. */
export function urlCorta(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * true si la dirección del sitio no es pública (los QR impresos no abrirían la ficha desde un
 * celular): localhost y sus subdominios, direcciones de la propia máquina o de una red interna
 * (10.x, 172.16–31.x, 192.168.x) y nombres .local, .test o .internal.
 */
export function esDireccionLocal(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (/\.(local|test|internal)$/.test(host)) return true;
  if (host === "[::1]" || host === "0.0.0.0") return true;
  return /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host);
}

/**
 * true si el pedido salió de una página del propio sitio. Protege las descargas con datos
 * personales de un formulario armado en otro sitio (CSRF), que además dejaría en la auditoría
 * una exportación que nadie pidió. Next.js hace un control parecido en las Server Actions,
 * pero no en los Route Handlers.
 *  - Sec-Fetch-Site lo pone el navegador y una página no lo puede falsificar: tiene que ser
 *    "same-origin" ("same-site" es otro subdominio, no el panel).
 *  - Sin ese encabezado (navegadores viejos), el Origin tiene que coincidir con el Host.
 *  - Sin ninguno de los dos, se acepta: las cookies de sesión (SameSite=Lax) no viajan en un
 *    POST que sale de otro sitio, así que el pedido no llega con la sesión del equipo.
 */
export function pedidoDelMismoSitio(encabezados: Headers) {
  const sitio = encabezados.get("sec-fetch-site");
  if (sitio) return sitio === "same-origin";
  const origen = encabezados.get("origin");
  if (!origen) return true;
  const host = (encabezados.get("x-forwarded-host") ?? encabezados.get("host") ?? "").split(",")[0].trim();
  try {
    return host !== "" && new URL(origen).host === host;
  } catch {
    return false; // "Origin: null" (iframes aislados, redirecciones entre sitios)
  }
}

/** Respuesta a un pedido de descarga que no salió del panel (ver pedidoDelMismoSitio). */
export function descargaRechazada() {
  return new Response(
    "La descarga no se hizo porque el pedido no salió del panel. Abrí Listado final en el panel y usá los botones de descarga.",
    {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

/**
 * GET a una ruta de descarga del listado (un enlace o un marcador): lleva a la pantalla del
 * listado sin generar el archivo. La descarga se pide con el formulario de esa pantalla.
 */
export function volverAlListado(pedido: Request) {
  return Response.redirect(new URL("/admin/exportar", pedido.url), 303);
}

/** Encabezado Content-Disposition con el nombre del archivo (solo caracteres ASCII). */
export function adjunto(nombre: string) {
  return `attachment; filename="${nombre.replace(/[^\w.-]/g, "_")}"`;
}
