import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { estadoSubasta, listarObras, obtenerObra, obtenerPagina } from "@/lib/datos/publico";
import type { ObraDetalle, ObraResumen, Pagina } from "@/lib/datos/tipos";
import { conBase } from "@/lib/db";
import { proveedorDeModelo, urlSitio } from "@/lib/entorno";
import { datosPublicosParaMigue, obrasNombradas, TEXTOS_PARA_MIGUE, type DatosPublicosMigue } from "./datos-publicos";
import type { ConexionModelo } from "./openrouter";
import type { DependenciasMiguePublico } from "./publico";
import { registrarConsulta, type CanalMigue, type DatosConsulta } from "./registro";
import { armarReporte, enviarReporte } from "./reporte";
import type { ConsultaServicio, DependenciasTope } from "./tope";

/**
 * Migue con lo de la app puesto: el entorno, la base (conBase) y las lecturas públicas. Es lo
 * que importa la ruta /api/migue. Nada se resuelve al importar: `next build` importa esto sin
 * entorno ni base.
 */

/** Con qué se habla con el modelo, desde el entorno (proveedorDeModelo). */
export function conexionModelo(): ConexionModelo {
  const p = proveedorDeModelo();
  return { clave: p.clave, modelo: p.modelo, url: p.url, referer: urlSitio };
}

/** Las escrituras de Migue (tope y registro), con el rol de servicio: anon y authenticated no las ven. */
const comoServicio: ConsultaServicio = (fn) => conBase({ rol: "servicio" }, fn);

// El HMAC del tope usa SESSION_SECRET. Sin él (modo local), uno al azar por proceso: los
// contadores se reinician al reiniciar, que para un techo de gasto alcanza.
const SECRETO_DE_PROCESO = randomBytes(32).toString("hex");

function dependenciasTope(): DependenciasTope {
  return { escribir: comoServicio, secreto: process.env.SESSION_SECRET || SECRETO_DE_PROCESO, topes: proveedorDeModelo().topes };
}

function sinBase<T>(que: string, valor: T) {
  return (error: unknown) => {
    console.error(`migue.${que}_sin_datos`, error instanceof Error ? error.message : typeof error);
    return valor;
  };
}

/**
 * Los datos públicos que ya muestran las páginas, leídos con el rol anon (sin uid: Migue nunca
 * sabe quién va ganando). Si la base no responde, Migue contesta igual sin ellos (y dice que no
 * tiene el dato): no se cae el chat.
 */
async function datosPublicos(textos: readonly string[]): Promise<DatosPublicosMigue> {
  const [estado, obras, paginas] = await Promise.all([
    estadoSubasta().catch(sinBase("estado", null)),
    listarObras().catch(sinBase<ObraResumen[] | null>("catalogo", null)),
    Promise.all(TEXTOS_PARA_MIGUE.map((p) => obtenerPagina(p.slug).catch(sinBase("pagina", null)))),
  ]);
  const numeros = obras ? obrasNombradas(textos, obras) : [];
  const fichas = (await Promise.all(numeros.map((n) => obtenerObra(n).catch(sinBase("ficha", null))))).filter((f): f is ObraDetalle => f !== null);
  return datosPublicosParaMigue({
    ahora: estado?.ahora ?? new Date(),
    estado,
    obras,
    fichas,
    paginas: paginas.filter((p): p is Pagina => p !== null),
  });
}

export function dependenciasPublico(): DependenciasMiguePublico {
  return { conexion: conexionModelo(), tope: dependenciasTope(), datos: datosPublicos };
}

/** El registro (public.consultas_migue). Nunca tira. */
export function registrar(datos: DatosConsulta): Promise<void> {
  return registrarConsulta(comoServicio, datos);
}

/** La retención: consultas de más de 90 días y horas del tope de más de un día. La llama /api/avisos. */
export async function purgarMigue(): Promise<void> {
  try {
    await comoServicio((q) => q("select * from public.f_purgar_migue()"));
  } catch (error) {
    console.warn("migue.purga_fallo", error instanceof Error ? error.message : typeof error);
  }
}

/**
 * El reporte al tablero de Migues de la Dirección de IA, después de contestar (`after()`): no
 * demora la respuesta. Sin MIGUE_API_KEY y MIGUE_DASHBOARD_URL, nada.
 */
export function reportarAlTablero(canal: CanalMigue, resuelta: boolean, empezo: Date): void {
  const tablero = proveedorDeModelo().tablero;
  if (!tablero) return;
  const reporte = armarReporte({ canal, resuelta, empezo });
  const tarea = () => enviarReporte(reporte, tablero);
  try {
    after(tarea);
  } catch {
    // Fuera de un pedido after() no está: se manda igual, sin esperar (enviarReporte nunca tira).
    void tarea();
  }
}
