import { atajoPublico, buscarEnDatosPublicos, responderAtajo } from "./atajos-publicos";
import { datosEnTexto, PAGINAS_PARA_MIGUE, urlsDeLosDatos, type DatosPublicosMigue } from "./datos-publicos";
import { interpretarRespuesta, normalizarHref, type EnlaceMigue } from "./enlaces";
import { MENSAJE_DATO_PERSONAL_PUBLICO, tieneDatoPersonal, type Turno } from "./limites";
import { armarMensajes, pedirAlModelo, type ConexionModelo } from "./openrouter";
import { INSTRUCCIONES_PUBLICO } from "./prompts/publico";
import type { ResultadoConsulta } from "./registro";
import { contarConsulta, type DependenciasTope } from "./tope";

/**
 * Una pregunta al Migue del sitio, de punta a punta (núcleo de Migue, CementerIA
 * src/lib/migue/publico.ts). Abierto, sin sesión. En este orden:
 *
 * 1. **Rechazo**: una pregunta con DNI, CUIL, teléfono o correo no viaja ni se guarda.
 * 2. **Atajos** sin modelo (saludo, «la obra N», cuándo cierra, cómo participar, incremento):
 *    exactos, con los datos del momento, y gratis.
 * 3. **El modelo**, con los datos públicos en el prompt dentro de `<datos>…</datos>` y sin
 *    herramientas, dentro del tope por IP y global.
 * 4. **El buscador** por palabras sobre los mismos datos si no hay clave, si el modelo falla o
 *    si se pasó el tope.
 *
 * Nunca oferta ni dice quién ofertó: no tiene con qué.
 */

/** Migue contesta consultas, no escribe ensayos. */
export const MAXIMO_TOKENS_PUBLICO = 400;

export interface RespuestaMigue {
  respuesta: string;
  enlaces: EnlaceMigue[];
  resultado: ResultadoConsulta;
  /** Hubo una respuesta con contenido (para el tablero). */
  resuelta: boolean;
  modelo: string | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
}

export interface DependenciasMiguePublico {
  conexion: ConexionModelo;
  tope: DependenciasTope;
  /** Los datos públicos, ya acotados a la lista cerrada; `nombradas` son los textos donde buscar obras. */
  datos: (nombradas: readonly string[]) => Promise<DatosPublicosMigue>;
}

export interface PedidoPublico {
  pregunta: string;
  historial: Turno[];
}

/** Las páginas del sitio, /obras/N de las obras del catálogo y el Instagram de las fichas: los únicos enlaces que se muestran. */
export function validadorPublico(d: DatosPublicosMigue) {
  const paginas = new Map<string, string>(PAGINAS_PARA_MIGUE.map((p) => [p.ruta, p.nombre]));
  const obras = new Set((d.obras ?? []).map((o) => o.numero));
  const externas = urlsDeLosDatos(d);
  return (href: string): string | null => {
    if (paginas.has(href)) return paginas.get(href) ?? null;
    const obra = /^\/obras\/(\d{1,3})$/.exec(href);
    if (obra && obras.has(Number(obra[1]))) return `Ver la obra ${Number(obra[1])}`;
    for (const [url, etiqueta] of externas) if (normalizarHref(url) === href.replace(/^https?:\/\/(www\.)?/, "https://")) return etiqueta;
    return null;
  };
}

const SIN_MODELO = { modelo: null, tokensEntrada: null, tokensSalida: null };

export async function responderPublico(deps: DependenciasMiguePublico, pedido: PedidoPublico, ip: string | null): Promise<RespuestaMigue> {
  if (tieneDatoPersonal(pedido.pregunta)) {
    return {
      respuesta: MENSAJE_DATO_PERSONAL_PUBLICO,
      enlaces: [{ href: "/como-participar", etiqueta: "Cómo participar" }],
      resultado: "rechazada",
      resuelta: false,
      ...SIN_MODELO,
    };
  }
  // Las obras se buscan en la pregunta y en lo último que escribió la persona («¿y la técnica?»).
  const textos = [pedido.pregunta, ...pedido.historial.filter((t) => t.rol === "usuario").slice(-2).map((t) => t.texto).reverse()];
  const datos = await deps.datos(textos);

  const atajo = atajoPublico(pedido.pregunta, pedido.historial.length === 0);
  if (atajo) {
    const r = responderAtajo(atajo, datos);
    return { respuesta: r.texto, enlaces: r.enlaces, resultado: r.resuelta ? "respondida" : "sin_respuesta", resuelta: r.resuelta, ...SIN_MODELO };
  }

  let resultado: ResultadoConsulta = "fallback";
  if (deps.conexion.clave) {
    const tope = await contarConsulta(deps.tope, { tipo: "ip", ip });
    if (!tope.permitido) {
      resultado = "tope";
    } else {
      const r = await pedirAlModelo(deps.conexion, {
        mensajes: armarMensajes([INSTRUCCIONES_PUBLICO, datosEnTexto(datos)], pedido.historial, pedido.pregunta),
        maxTokens: MAXIMO_TOKENS_PUBLICO,
      });
      if (r?.contenido) {
        const interpretada = interpretarRespuesta(r.contenido, validadorPublico(datos));
        if (interpretada.texto) {
          return {
            respuesta: interpretada.texto,
            enlaces:
              interpretada.enlaces.length || !interpretada.sinRespuesta ? interpretada.enlaces : [{ href: "/como-participar", etiqueta: "Cómo participar" }],
            resultado: interpretada.sinRespuesta ? "sin_respuesta" : "respondida",
            resuelta: !interpretada.sinRespuesta,
            modelo: r.modelo,
            tokensEntrada: r.tokensEntrada,
            tokensSalida: r.tokensSalida,
          };
        }
      }
      // Si el modelo no contestó, el buscador, a propósito.
    }
  }

  const b = buscarEnDatosPublicos(pedido.pregunta, datos);
  return { respuesta: b.texto, enlaces: b.enlaces, resultado, resuelta: b.resuelta, ...SIN_MODELO };
}
