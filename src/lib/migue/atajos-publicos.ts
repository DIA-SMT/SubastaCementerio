import { pesosMigue, type DatosPublicosMigue, type ObraParaMigue } from "./datos-publicos";
import type { EnlaceMigue } from "./enlaces";
import { palabras, parecidas, simplificar } from "./texto";

/**
 * Lo que Migue contesta **sin modelo**: los atajos y el buscador por palabras (núcleo de Migue,
 * CementerIA src/lib/migue/atajos-publicos.ts, con los atajos propios de la Subasta). Puros: se
 * prueban con lo que escribe la gente.
 *
 * - Los atajos se resuelven antes del modelo y no cuentan para el tope: el dato exacto del
 *   momento es mejor que cualquier resumen, y así no se paga una llamada por cada "hola". Valen
 *   solo para el PRIMER mensaje (con charla encima, el que sabe a qué se refiere un "¿y la
 *   otra?" es el modelo). La excepción es «¿cuánto va la obra 7?», la pregunta más común: con
 *   un número de obra y una pregunta por la oferta se contesta exacta siempre.
 * - El buscador es el respaldo: si no hay clave, si el modelo falla o si se pasó el tope,
 *   contesta con lo que más palabras comparte con la pregunta, de los mismos datos.
 */

export interface RespuestaSinModelo {
  texto: string;
  enlaces: EnlaceMigue[];
  /** Hubo una respuesta con contenido (false: "no encontré", que también es una respuesta). */
  resuelta: boolean;
}

const ENLACE = {
  obras: { href: "/obras", etiqueta: "Las obras" },
  participar: { href: "/como-participar", etiqueta: "Cómo participar" },
  bases: { href: "/bases-y-condiciones", etiqueta: "Bases y condiciones" },
  ingresar: { href: "/ingresar", etiqueta: "Ingresar" },
} as const satisfies Record<string, EnlaceMigue>;

const enlaceObra = (o: ObraParaMigue): EnlaceMigue => ({ href: `/obras/${o.numero}`, etiqueta: `Ver la obra ${o.numero}` });

/** Un saludo y nada más (anclado: "hola, ¿cuándo cierra?" no es un saludo). */
export const ES_SOLO_UN_SALUDO =
  /^[\s¡!¿?,.]*(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)([\s,!¡.]*(migue|como estas|como andas|que tal|todo bien))?[\s!¡.?]*$/;

/** «la 7», «obra 07», «n° 7», «#7». */
const NUMERO_DE_OBRA = /\b(?:obra|la|el|n[°º]?|nro\.?|numero|#)\s*0?(\d{1,2})\b/;
const PIDE_OFERTA = /\b(cuanto|cuanta|oferta|ofertas|ofertaron|va|vale|esta|precio|base|minim[oa]|puja|valor|sale)\b/;

const PIDE_CIERRE = [
  /\b(cuando|a que hora|que dia|hasta cuando|hasta que (dia|hora))\b.{0,30}\b(cierra|cierran|termina|terminan|finaliza|vence|abre|abren|empieza|empiezan|arranca|comienza)\b/,
  /\b(cierre|fecha|fechas|plazo|horario)\b.{0,20}\b(subasta|ofertas?|etapa)\b/,
  /\b(hasta cuando|cuanto (tiempo )?falta|quedan? .{0,10}(dias|horas))\b/,
];

const PIDE_PARTICIPAR = [
  /\bcomo\b.{0,20}\b(participo|participar|oferto|ofertar|pujo|pujar|hago (una )?oferta|compro|comprar|me (anoto|registro|inscribo))\b/,
  /\b(quiero|puedo|se puede)\b.{0,15}\b(ofertar|participar|pujar|comprar)\b/,
  /\b(registrarme|registro|inscribirme|inscripcion|ciudadano digital|cidituc)\b/,
];

const PIDE_INCREMENTO = [/\bincremento\b/, /\b(de a cuanto|cuanto (tengo que|hay que|debo) (subir|aumentar|sumar)|minimo (entre|para subir)|cuanto (mas|sube))\b/];

export function saludoPublico(d: DatosPublicosMigue): string {
  const cuando =
    d.estado?.fase === "abierta"
      ? "Las ofertas están abiertas."
      : d.estado?.fase === "cerrada"
        ? "La etapa virtual ya cerró, pero te cuento sobre la muestra y la subasta presencial."
        : null;
  return [
    "¡Hola! Soy Migue, el asistente de la Dirección de Cementerios. Te cuento cómo participar de la Subasta solidaria, cuándo cierra y cuánto va cada una de las obras de «Memorias del futuro».",
    cuando,
    "¿En qué te ayudo?",
  ]
    .filter(Boolean)
    .join(" ");
}

export type Atajo = { tipo: "saludo" } | { tipo: "obra"; numero: number } | { tipo: "cierre" } | { tipo: "participar" } | { tipo: "incremento" };

/** Qué atajo corresponde, o null (va al modelo). Pura. */
export function atajoPublico(pregunta: string, empezandoDeCero: boolean): Atajo | null {
  const simple = simplificar(pregunta);
  const numero = NUMERO_DE_OBRA.exec(simple);
  if (numero && PIDE_OFERTA.test(simple) && simple.length <= 80) return { tipo: "obra", numero: Number(numero[1]) };
  if (!empezandoDeCero) return null;
  if (ES_SOLO_UN_SALUDO.test(simple)) return { tipo: "saludo" };
  if (PIDE_INCREMENTO.some((p) => p.test(simple))) return { tipo: "incremento" };
  if (PIDE_CIERRE.some((p) => p.test(simple))) return { tipo: "cierre" };
  if (PIDE_PARTICIPAR.some((p) => p.test(simple))) return { tipo: "participar" };
  return null;
}

const SIN_ESTADO: RespuestaSinModelo = {
  texto: "Ahora no pude leer el estado de la subasta. Fijate en «Cómo participar» o en el catálogo, que tienen los datos al día.",
  enlaces: [ENLACE.participar, ENLACE.obras],
  resuelta: false,
};

function respuestaObra(d: DatosPublicosMigue, numero: number): RespuestaSinModelo {
  if (d.obras === null) return { ...SIN_ESTADO, enlaces: [ENLACE.obras] };
  const o = d.obras.find((x) => x.numero === numero);
  if (!o) {
    return {
      texto: `No encuentro una obra ${numero} en el catálogo. Las obras van numeradas como en la muestra: en «Las obras» están todas.`,
      enlaces: [ENLACE.obras],
      resuelta: false,
    };
  }
  const ejemplo = o.esEjemplo ? " (Es una obra de ejemplo, no real.)" : "";
  const cabecera = `La obra ${o.numero} es «${o.titulo}», de ${o.artista}.`;
  if (o.fase === "por_confirmar" || o.fase === "antes") {
    return {
      texto: `${cabecera} Todavía no se puede ofertar: las ofertas van a arrancar desde **${pesosMigue(o.precioSalida)}**.${ejemplo}`,
      enlaces: [enlaceObra(o), ENLACE.participar],
      resuelta: true,
    };
  }
  if (o.fase === "cerrada") {
    const base = o.ofertaActual === null ? "Cerró sin ofertas en la etapa virtual: pasa a la subasta presencial." : `Cerró con una oferta de **${pesosMigue(o.ofertaActual)}**, que es la base para la subasta presencial.`;
    return { texto: `${cabecera} ${base}${ejemplo}`, enlaces: [enlaceObra(o)], resuelta: true };
  }
  const oferta =
    o.ofertaActual === null
      ? `Todavía no tiene ofertas: se puede ofertar desde **${pesosMigue(o.precioSalida)}**.`
      : `Ahora va **${pesosMigue(o.ofertaActual)}** (${o.cantidadOfertas} ${o.cantidadOfertas === 1 ? "oferta" : "ofertas"}) y la próxima oferta tiene que ser de al menos **${pesosMigue(o.minimoSiguiente)}**.`;
  return {
    texto: `${cabecera} ${oferta} Cierra el ${o.cierre}. Es el dato de este momento: puede cambiar en cualquier momento, y lo que vale es lo que muestra la ficha de la obra.${ejemplo}`,
    enlaces: [enlaceObra(o)],
    resuelta: true,
  };
}

function respuestaCierre(d: DatosPublicosMigue): RespuestaSinModelo {
  const e = d.estado;
  if (!e) return SIN_ESTADO;
  if (!e.fechasConfirmadas || e.fase === "por_confirmar") {
    return {
      texto: "Las fechas de la etapa virtual todavía están a confirmar. Apenas se confirmen, van a estar en el sitio y en «Cómo participar».",
      enlaces: [ENLACE.participar],
      resuelta: true,
    };
  }
  const extension = e.extensionMinutos
    ? ` Si alguien oferta por una obra en los últimos ${e.extensionMinutos} minutos, el cierre de esa obra se corre ${e.extensionMinutos} minutos.`
    : "";
  const presencial = e.fechaPresencial ? ` Después viene la subasta presencial, el ${e.fechaPresencial}.` : "";
  const texto =
    e.fase === "antes"
      ? `La etapa virtual abre el **${e.inicio}** y cierra el **${e.cierre}** (hora de Tucumán).${extension}`
      : e.fase === "abierta"
        ? `Las ofertas están abiertas hasta el **${e.cierre}** (hora de Tucumán).${e.enExtension && e.cierreFinal ? ` Por ofertas de último momento, alguna obra sigue abierta hasta el ${e.cierreFinal}.` : ""}${extension}`
        : `La etapa virtual ya cerró (el ${e.cierreFinal ?? e.cierre}).${presencial}`;
  return { texto: e.fase === "cerrada" ? texto : `${texto}${presencial}`, enlaces: [ENLACE.obras, ENLACE.participar], resuelta: true };
}

function respuestaParticipar(d: DatosPublicosMigue): RespuestaSinModelo {
  const fase = d.estado?.fase;
  const cuando =
    fase === "abierta"
      ? "Las ofertas están abiertas ahora."
      : fase === "cerrada"
        ? "La etapa virtual ya cerró: ya no se puede ofertar desde el sitio."
        : "Todavía no se puede ofertar: las fechas se anuncian en el sitio.";
  return {
    texto: `Para ofertar ingresás con tu cuenta de **Ciudadano Digital** (la de los trámites de la Municipalidad), completás tus datos de contacto la primera vez y ofertás desde la ficha de la obra que te guste. ${cuando} Todos los pasos están en «Cómo participar».`,
    enlaces: [ENLACE.participar, ENLACE.ingresar],
    resuelta: true,
  };
}

function respuestaIncremento(d: DatosPublicosMigue): RespuestaSinModelo {
  if (!d.estado) return SIN_ESTADO;
  return {
    texto: `Cada oferta tiene que superar a la anterior en al menos **${pesosMigue(d.estado.incrementoMinimo)}**. La primera oferta de cada obra arranca desde su precio de salida (en general, ${pesosMigue(d.estado.precioSalida)}). En la ficha de cada obra está el mínimo para la próxima.`,
    enlaces: [ENLACE.bases, ENLACE.obras],
    resuelta: true,
  };
}

export function responderAtajo(atajo: Atajo, d: DatosPublicosMigue): RespuestaSinModelo {
  switch (atajo.tipo) {
    case "saludo":
      return { texto: saludoPublico(d), enlaces: [], resuelta: true };
    case "obra":
      return respuestaObra(d, atajo.numero);
    case "cierre":
      return respuestaCierre(d);
    case "participar":
      return respuestaParticipar(d);
    case "incremento":
      return respuestaIncremento(d);
  }
}

// ── El buscador ─────────────────────────────────────────────────────────

interface Ficha {
  titulo: string;
  texto: string;
  enlace: EnlaceMigue;
}

function fichas(d: DatosPublicosMigue): Ficha[] {
  const f: Ficha[] = [];
  for (const o of d.obras ?? []) {
    const ficha = d.fichas.find((x) => x.numero === o.numero);
    const texto = [
      `Obra ${o.numero}, de ${o.artista}.`,
      ficha?.tecnica ? `Técnica y materiales: ${ficha.tecnica}.` : null,
      ficha?.medidas ? `Medidas: ${ficha.medidas}.` : null,
      ficha?.memoria ?? null,
    ]
      .filter(Boolean)
      .join(" ");
    f.push({ titulo: `«${o.titulo}», de ${o.artista}`, texto, enlace: enlaceObra(o) });
  }
  // Los textos, por párrafo: el que habla de lo que se pregunta, no la página entera.
  for (const p of d.paginas) {
    const nombre = p.titulo;
    for (const parrafo of p.contenido.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ¿¡«])/).reduce<string[]>((acc, oracion) => {
      const ultimo = acc.at(-1);
      if (ultimo && ultimo.length < 280) acc[acc.length - 1] = `${ultimo} ${oracion}`;
      else acc.push(oracion);
      return acc;
    }, [])) {
      f.push({ titulo: nombre, texto: parrafo.replace(/[#*_>]+/g, "").trim(), enlace: { href: p.ruta, etiqueta: nombre } });
    }
  }
  return f;
}

/** La ficha que más palabras comparte con la pregunta (el título pesa el doble), si comparte lo suficiente. */
export function buscarEnDatosPublicos(pregunta: string, d: DatosPublicosMigue): RespuestaSinModelo {
  const buscadas = palabras(pregunta).filter((p) => !["migue", "subasta", "obra", "obras"].includes(p));
  const puntuadas = fichas(d)
    .map((f) => {
      const enTitulo = palabras(f.titulo);
      const enTexto = palabras(f.texto);
      const puntaje = buscadas.reduce((t, b) => t + (enTitulo.some((p) => parecidas(p, b)) ? 2 : enTexto.some((p) => parecidas(p, b)) ? 1 : 0), 0);
      return { f, puntaje };
    })
    .sort((a, b) => b.puntaje - a.puntaje);
  const mejor = puntuadas[0];
  if (!mejor || buscadas.length === 0 || mejor.puntaje < Math.min(2, buscadas.length)) {
    return {
      texto: "Sobre eso no encontré nada en lo que publica el sitio. Fijate en «Cómo participar» y en las «Bases y condiciones», que tienen todo lo de la subasta.",
      enlaces: [ENLACE.participar, ENLACE.bases],
      resuelta: false,
    };
  }
  const texto = mejor.f.texto.length > 600 ? `${mejor.f.texto.slice(0, 600).replace(/\s+\S*$/, "")}…` : mejor.f.texto;
  return { texto: `Esto es lo que encontré:\n\n**${mejor.f.titulo}**. ${texto}`, enlaces: [mejor.f.enlace], resuelta: true };
}
