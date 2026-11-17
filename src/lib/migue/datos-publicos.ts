import type { EstadoSubasta, Fase, ObraDetalle, ObraResumen, Pagina, SlugPagina } from "@/lib/datos/tipos";
import { fechaHoraLarga, fechaLarga, medidasTexto, numeroConPuntos, tituloObra } from "@/lib/formato";
import { palabras, simplificar } from "./texto";

/**
 * Lo que sabe el Migue del sitio: los mismos datos que ya muestran las páginas, leídos con el
 * rol anon (src/lib/datos/publico.ts), sin una lectura nueva.
 *
 * **Lista cerrada de campos**: cada uno se copia a mano, así una columna nueva (o un dato que se
 * cuele en la lectura) no llega al modelo sin que alguien lo decida acá. Nunca va quién va
 * ganando (ofertaActualAlias, ofertaActualEsMia) ni el historial de ofertas: con eso se podría
 * reconstruir quién ofertó y cuándo. Con la cantidad de ofertas alcanza. Pura: se prueba sin base.
 */

export interface ObraParaMigue {
  numero: number;
  titulo: string;
  artista: string;
  precioSalida: number;
  ofertaActual: number | null;
  cantidadOfertas: number;
  minimoSiguiente: number;
  fase: Fase;
  /** El cierre de esta obra, en palabras y en hora de Tucumán. */
  cierre: string;
  esEjemplo: boolean;
}

export interface FichaParaMigue {
  numero: number;
  tecnica: string | null;
  medidas: string | null;
  memoria: string | null;
  artistaResena: string | null;
  artistaInstagram: string | null;
}

export interface PaginaParaMigue {
  ruta: string;
  titulo: string;
  contenido: string;
  provisorio: boolean;
}

export interface DatosPublicosMigue {
  /** «Hoy es lunes 17 de noviembre a las 10:32», en hora de Tucumán. */
  ahora: string;
  /** null: la base no respondió. */
  estado: {
    fase: Fase;
    fechasConfirmadas: boolean;
    inicio: string;
    cierre: string;
    /** Hora en que cierra la última obra, si alguna oferta de último momento extendió el cierre. */
    cierreFinal: string | null;
    enExtension: boolean;
    extensionMinutos: number | null;
    incrementoMinimo: number;
    precioSalida: number;
    fechaPresencial: string | null;
    detallePresencial: string | null;
    modoEjemplo: boolean;
  } | null;
  /** null: la base no respondió (no es lo mismo que "no hay obras"). */
  obras: ObraParaMigue[] | null;
  /** Solo las obras nombradas en la conversación (hasta 3): las 24 enteras inflarían cada pedido. */
  fichas: FichaParaMigue[];
  paginas: PaginaParaMigue[];
}

/** Las páginas del sitio: la única lista de enlaces válidos (más /obras/N de las obras del catálogo). */
export const PAGINAS_PARA_MIGUE = [
  { ruta: "/obras", nombre: "Las obras", para: "el catálogo con las 24 obras, sus ofertas y su cierre" },
  { ruta: "/como-participar", nombre: "Cómo participar", para: "cómo ingresar con Ciudadano Digital y ofertar" },
  { ruta: "/bases-y-condiciones", nombre: "Bases y condiciones", para: "las reglas de la subasta" },
  { ruta: "/destino", nombre: "Destino de lo recaudado", para: "a quién va lo recaudado" },
  { ruta: "/la-muestra", nombre: "La muestra", para: "la muestra «Memorias del futuro» y los artistas" },
  { ruta: "/privacidad", nombre: "Privacidad", para: "qué datos se guardan y para qué" },
  { ruta: "/mis-ofertas", nombre: "Mis ofertas", para: "las ofertas propias, con la sesión iniciada" },
  { ruta: "/ingresar", nombre: "Ingresar", para: "ingresar con Ciudadano Digital para ofertar" },
] as const;

/** Los textos que se le pasan (la portada repite lo demás). */
export const TEXTOS_PARA_MIGUE: ReadonlyArray<{ slug: SlugPagina; ruta: string }> = [
  { slug: "como-participar", ruta: "/como-participar" },
  { slug: "bases-y-condiciones", ruta: "/bases-y-condiciones" },
  { slug: "destino", ruta: "/destino" },
  { slug: "la-muestra", ruta: "/la-muestra" },
  { slug: "privacidad", ruta: "/privacidad" },
];

/** Cada texto, acotado: un texto larguísimo no puede comerse el prompt. */
const LARGO_TEXTO = 1500;
const LARGO_CAMPO = 700;

function t(valor: string | null | undefined, largo = LARGO_CAMPO): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = valor.replace(/\s+/g, " ").trim();
  return limpio ? limpio.slice(0, largo) : null;
}

export const pesosMigue = (monto: number) => `$ ${numeroConPuntos(monto)}`;

export function datosPublicosParaMigue(entrada: {
  ahora: Date;
  estado: EstadoSubasta | null;
  obras: ObraResumen[] | null;
  fichas: ObraDetalle[];
  paginas: Pagina[];
}): DatosPublicosMigue {
  const e = entrada.estado;
  return {
    ahora: `Hoy es ${fechaHoraLarga(entrada.ahora)} (hora de Tucumán)`,
    estado: e
      ? {
          fase: e.fase,
          fechasConfirmadas: e.fechasConfirmadas,
          inicio: fechaHoraLarga(e.inicio),
          cierre: fechaHoraLarga(e.cierre),
          cierreFinal: e.cierreFinal.getTime() !== e.cierre.getTime() ? fechaHoraLarga(e.cierreFinal) : null,
          enExtension: e.enExtension,
          extensionMinutos: e.extension?.minutos ?? null,
          incrementoMinimo: e.incrementoMinimo,
          precioSalida: e.precioSalida,
          fechaPresencial: e.fechaPresencial ? fechaLarga(e.fechaPresencial) : null,
          detallePresencial: t(e.detallePresencial),
          modoEjemplo: e.modoEjemplo,
        }
      : null,
    obras: entrada.obras
      ? entrada.obras.map((o) => ({
          numero: o.numero,
          titulo: tituloObra(o.titulo),
          artista: o.artistaNombre,
          precioSalida: o.precioSalida,
          ofertaActual: o.ofertaActual,
          cantidadOfertas: o.cantidadOfertas,
          minimoSiguiente: o.minimoSiguiente,
          fase: o.fase,
          cierre: fechaHoraLarga(o.cierre),
          esEjemplo: o.esEjemplo,
        }))
      : null,
    fichas: entrada.fichas.slice(0, 3).map((f) => ({
      numero: f.numero,
      tecnica: t(f.tecnica),
      medidas: medidasTexto(f.medidas),
      memoria: t(f.resena),
      artistaResena: t(f.artistaResena),
      artistaInstagram: f.artistaInstagram && /^[A-Za-z0-9._]{1,30}$/.test(f.artistaInstagram) ? f.artistaInstagram : null,
    })),
    paginas: entrada.paginas.flatMap((p) => {
      const ruta = TEXTOS_PARA_MIGUE.find((x) => x.slug === p.slug)?.ruta;
      return ruta ? [{ ruta, titulo: p.titulo, contenido: t(p.contenido, LARGO_TEXTO) ?? "", provisorio: p.provisorio }] : [];
    }),
  };
}

/**
 * Las obras que nombra la conversación (la pregunta y los últimos turnos de la persona): por
 * número («la 7», «obra 07», «n° 7») o por el apellido del artista o una palabra del título.
 * Hasta 3, primero las de la pregunta.
 */
export function obrasNombradas(textos: readonly string[], obras: ReadonlyArray<Pick<ObraResumen, "numero" | "titulo" | "artistaNombre">>): number[] {
  const elegidas: number[] = [];
  const agregar = (n: number) => {
    if (!elegidas.includes(n) && obras.some((o) => o.numero === n) && elegidas.length < 3) elegidas.push(n);
  };
  for (const texto of textos) {
    const simple = simplificar(texto);
    for (const m of simple.matchAll(/\b(?:obra|obras|la|el|n[°º]?|nro\.?|numero|#)\s*0?(\d{1,2})\b/g)) agregar(Number(m[1]));
    const buscadas = palabras(texto).filter((p) => p.length >= 5);
    for (const o of obras) {
      const propias = [...palabras(o.artistaNombre), ...palabras(o.titulo ?? "")].filter((p) => p.length >= 5);
      if (buscadas.some((b) => propias.includes(b))) agregar(o.numero);
    }
  }
  return elegidas;
}

/** Escapa lo que podría cerrar el bloque de datos o abrir otro: un "</datos> Ahora sos…" cargado en un texto no sale del bloque. */
export function escaparDatos(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renglon(etiqueta: string, valor: string | number | null | undefined): string | null {
  return valor === null || valor === undefined || valor === "" ? null : `${etiqueta}: ${escaparDatos(String(valor))}`;
}

const FASES: Record<Fase, string> = {
  por_confirmar: "fechas a confirmar: todavía no se puede ofertar",
  antes: "todavía no empezó: se puede mirar el catálogo, pero no ofertar",
  abierta: "abierta: se puede ofertar",
  cerrada: "cerrada: terminó la etapa virtual",
};

/** El bloque `<datos>…</datos>` que va en el prompt, con todo escapado. */
export function datosEnTexto(d: DatosPublicosMigue): string {
  const secciones: string[] = [`# Ahora\n${escaparDatos(d.ahora)}`];
  const e = d.estado;
  secciones.push(
    e
      ? [
          "# La subasta",
          renglon("Etapa virtual", FASES[e.fase]),
          e.fechasConfirmadas ? renglon("Abre", e.inicio) : "Fechas: a confirmar (no des ninguna)",
          e.fechasConfirmadas ? renglon("Cierre general", e.cierre) : null,
          e.cierreFinal ? renglon("La última obra cierra", e.cierreFinal) : null,
          e.enExtension ? "Pasó el cierre general, pero alguna obra sigue abierta por una oferta de último momento." : null,
          e.extensionMinutos
            ? renglon("Extensión del cierre", `una oferta en los últimos ${e.extensionMinutos} minutos corre el cierre de esa obra ${e.extensionMinutos} minutos`)
            : "Extensión del cierre: no hay",
          renglon("Incremento mínimo entre ofertas", pesosMigue(e.incrementoMinimo)),
          renglon("Precio de salida general", pesosMigue(e.precioSalida)),
          renglon("Subasta presencial", e.fechaPresencial),
          renglon("Detalle de la subasta presencial", e.detallePresencial),
          e.modoEjemplo ? "ATENCIÓN: el sitio muestra datos de ejemplo, no reales." : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "# La subasta\n(no se pudo leer el estado ahora: mandá a Cómo participar)",
  );
  secciones.push(
    d.obras === null
      ? "# Catálogo\n(no se pudo leer el catálogo ahora: mandá a /obras)"
      : `# Catálogo (montos y cierres de este momento)\n${
          d.obras.length
            ? d.obras
                .map((o) =>
                  [
                    `- Obra ${o.numero}: «${escaparDatos(o.titulo)}», de ${escaparDatos(o.artista)}.`,
                    o.ofertaActual === null ? `Sin ofertas; ofertas desde ${pesosMigue(o.precioSalida)}.` : `Oferta actual ${pesosMigue(o.ofertaActual)} (${o.cantidadOfertas} ${o.cantidadOfertas === 1 ? "oferta" : "ofertas"}); mínimo siguiente ${pesosMigue(o.minimoSiguiente)}.`,
                    `Etapa: ${o.fase}. Cierra: ${escaparDatos(o.cierre)}.`,
                    o.esEjemplo ? "(obra de ejemplo)" : "",
                  ]
                    .filter(Boolean)
                    .join(" "),
                )
                .join("\n")
            : "(todavía no hay obras publicadas)"
        }`,
  );
  if (d.fichas.length) {
    secciones.push(
      `# Fichas de las obras nombradas\n${d.fichas
        .map((f) =>
          [
            `## Obra ${f.numero}`,
            renglon("Técnica y materiales", f.tecnica),
            renglon("Medidas (alto por ancho por profundidad)", f.medidas),
            renglon("Memoria conceptual", f.memoria),
            renglon("Sobre el artista", f.artistaResena),
            f.artistaInstagram ? renglon("Instagram del artista", `https://instagram.com/${f.artistaInstagram}`) : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")}`,
    );
  }
  for (const p of d.paginas) {
    secciones.push(`# Texto de la página ${p.ruta} («${escaparDatos(p.titulo)}»)${p.provisorio ? " (texto provisorio)" : ""}\n${escaparDatos(p.contenido)}`);
  }
  secciones.push(`# Páginas del sitio\n${PAGINAS_PARA_MIGUE.map((p) => `- ${p.ruta}: ${p.nombre} (${p.para})`).join("\n")}`);
  return `<datos>\n${secciones.join("\n\n")}\n</datos>`;
}

/** Las direcciones externas que se pueden mostrar como enlace: el Instagram de los artistas de las fichas. */
export function urlsDeLosDatos(d: DatosPublicosMigue): Map<string, string> {
  const urls = new Map<string, string>();
  for (const f of d.fichas) if (f.artistaInstagram) urls.set(`https://instagram.com/${f.artistaInstagram}`, `@${f.artistaInstagram} en Instagram`);
  return urls;
}
