/**
 * Cómo se lee lo que contesta el modelo: el texto para la persona, los enlaces y si dijo que no
 * tenía el dato. Pura (sin red ni base). Copiado del núcleo de Migue (CementerIA,
 * src/lib/migue/enlaces.ts).
 *
 * Se le pide al modelo que cierre con líneas de servicio:
 *   ENLACE: /como-participar   (hasta dos)
 *   [SIN_RESPUESTA]            (si el dato no está)
 * y se las saca línea por línea, no con una expresión exacta: el modelo escribe
 * «**ENLACE:** /x», «- ENLACE: [x](/x)» o «> ENLACE: /x», y ser estricto solo deja basura en
 * pantalla.
 *
 * Un enlace vale solo si es una ruta conocida: las páginas del sitio y /obras/N de una obra que
 * esté en el catálogo de esa consulta (más el Instagram de un artista de los datos). Lo demás se
 * descarta, y del texto se sacan las direcciones web que no estén permitidas: un enlace
 * inventado manda a la persona a cualquier lado.
 */

export interface EnlaceMigue {
  /** Una ruta del sitio (`/como-participar`, `/obras/7`) o una URL permitida. */
  href: string;
  etiqueta: string;
}

export interface RespuestaInterpretada {
  texto: string;
  enlaces: EnlaceMigue[];
  /** El modelo dijo que no tenía el dato (la marca). */
  sinRespuesta: boolean;
}

export const MARCA_SIN_RESPUESTA = "[SIN_RESPUESTA]";

/** Máximo de enlaces debajo de una respuesta. */
export const MAXIMO_ENLACES = 3;

/** Decide si un href se puede mostrar y con qué etiqueta (null: no). */
export type ValidadorEnlaces = (href: string) => string | null;

const PUNTUACION_MARKDOWN = /^[\s>*_`#~\-•·]+/;
const ENLACE_MARKDOWN = /\[([^\]\n]{1,120})\]\(([^)\s]{1,300})\)/g;
// Sin el signo de puntuación final: «…/turnos.» es la URL y un punto.
const URL_SUELTA = /\bhttps?:\/\/[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi;

/** La ruta de un href escrito por el modelo: sin espacios, comillas, signos de cierre ni barra final. */
export function normalizarHref(crudo: string): string {
  let h = crudo.trim().replace(/^[<("'`]+|[>)"'`.,;:]+$/g, "");
  if (h.length > 1 && h.startsWith("/") && h.endsWith("/")) h = h.slice(0, -1);
  return h;
}

export function interpretarRespuesta(crudo: string, validar: ValidadorEnlaces): RespuestaInterpretada {
  const enlaces: EnlaceMigue[] = [];
  const agregar = (href: string) => {
    const h = normalizarHref(href);
    const etiqueta = validar(h);
    if (etiqueta && !enlaces.some((e) => e.href === h) && enlaces.length < MAXIMO_ENLACES) enlaces.push({ href: h, etiqueta });
  };
  let sinRespuesta = false;
  const lineas: string[] = [];

  for (const original of crudo.replace(/\r\n?/g, "\n").split("\n")) {
    const pelada = original.replace(PUNTUACION_MARKDOWN, "").replace(/\*\*/g, "").trim();
    if (pelada.toUpperCase().includes(MARCA_SIN_RESPUESTA)) {
      sinRespuesta = true;
      const resto = original.replace(/\[SIN_RESPUESTA\]/gi, "").trim();
      if (resto) lineas.push(resto);
      continue;
    }
    const servicio = /^ENLACES?\s*:\s*(.*)$/i.exec(pelada);
    if (servicio) {
      // «ENLACE: [Cómo participar](/como-participar)» o «ENLACE: /obras/7, /como-participar».
      const valor = servicio[1];
      const enMarkdown = [...valor.matchAll(ENLACE_MARKDOWN)].map((m) => m[2]);
      for (const h of enMarkdown.length ? enMarkdown : valor.split(/[\s,]+/)) if (h) agregar(h);
      continue;
    }
    lineas.push(original);
  }

  let texto = lineas.join("\n");
  // Los enlaces en el cuerpo: el texto queda; el destino, solo si es conocido (va abajo, como botón).
  texto = texto.replace(ENLACE_MARKDOWN, (_, etiqueta: string, href: string) => {
    agregar(href);
    return etiqueta;
  });
  // Las URL sueltas que no son de los datos se sacan del texto.
  texto = texto.replace(URL_SUELTA, (url: string) => {
    const h = normalizarHref(url);
    if (validar(h)) {
      agregar(h);
      return h;
    }
    return "";
  });
  // Las rutas escritas en el texto («entrá a /como-participar») también van como botón.
  for (const m of texto.matchAll(/(?:^|[\s(«"])(\/[a-z][a-z0-9-]*(?:\/[A-Za-z0-9-]+)?)/g)) agregar(m[1]);

  texto = texto
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .trim();
  return { texto, enlaces, sinRespuesta };
}
