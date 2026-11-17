import { NextResponse, type NextRequest } from "next/server";
import { pedidoDelMismoSitio } from "@/lib/exportacion/comun";
import { historialValido, LARGO_MAXIMO_PUBLICO } from "@/lib/migue/limites";
import { responderPublico } from "@/lib/migue/publico";
import { dependenciasPublico, registrar, reportarAlTablero } from "@/lib/migue/servidor";

/**
 * POST /api/migue: el Migue del sitio público. `{ pregunta, historial? }` → `{ respuesta, enlaces }`.
 *
 * ABIERTO, sin sesión. El costo lo frenan el tope por IP y el global (src/lib/migue/tope.ts, en
 * la base); el abuso desde otro sitio, que el pedido salga de una página de este mismo sitio.
 * La pregunta, hasta 500 caracteres; el historial, 8 turnos de 600.
 *
 * No lee nada que no muestren ya las páginas públicas. Anota la consulta (sin nada que
 * identifique a la persona) y la reporta al tablero después de contestar.
 */

const CABECERAS = { "Cache-Control": "no-store" };

/** IP de quien pregunta: en Vercel la ponen x-real-ip y x-forwarded-for; en el servidor propio, nginx. */
function ipDelPedido(encabezados: Headers): string | null {
  const ip = encabezados.get("x-real-ip") || encabezados.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || null;
}

export async function POST(pedido: NextRequest): Promise<NextResponse> {
  if (!pedidoDelMismoSitio(pedido.headers)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403, headers: CABECERAS });
  let cuerpo: { pregunta?: unknown; historial?: unknown };
  try {
    cuerpo = await pedido.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400, headers: CABECERAS });
  }
  const pregunta = typeof cuerpo.pregunta === "string" ? cuerpo.pregunta.replace(/\s+/g, " ").trim() : "";
  if (!pregunta) return NextResponse.json({ error: "Falta la pregunta" }, { status: 400, headers: CABECERAS });
  if (pregunta.length > LARGO_MAXIMO_PUBLICO) {
    return NextResponse.json({ error: `La pregunta es muy larga: hasta ${LARGO_MAXIMO_PUBLICO} caracteres.` }, { status: 400, headers: CABECERAS });
  }

  const empezo = new Date();
  try {
    const r = await responderPublico(dependenciasPublico(), { pregunta, historial: historialValido(cuerpo.historial) }, ipDelPedido(pedido.headers));
    await registrar({
      canal: "publico",
      resultado: r.resultado,
      duracionMs: Date.now() - empezo.getTime(),
      modelo: r.modelo,
      tokensEntrada: r.tokensEntrada,
      tokensSalida: r.tokensSalida,
      pregunta,
      respuesta: r.respuesta,
    });
    reportarAlTablero("publico", r.resuelta, empezo);
    return NextResponse.json({ respuesta: r.respuesta, enlaces: r.enlaces }, { headers: CABECERAS });
  } catch (error) {
    console.error("migue.publico_fallo", error instanceof Error ? error.message : typeof error);
    await registrar({ canal: "publico", resultado: "error", duracionMs: Date.now() - empezo.getTime(), pregunta, respuesta: "" });
    reportarAlTablero("publico", false, empezo);
    return NextResponse.json({ error: "No pude responder ahora" }, { status: 500, headers: CABECERAS });
  }
}
