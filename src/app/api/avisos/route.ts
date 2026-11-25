import crypto from "node:crypto";
import { connection } from "next/server";
import { procesarAvisos } from "@/lib/avisos";
import { purgarMigue } from "@/lib/migue/servidor";

// Reintento de avisos por correo pendientes o fallidos. Lo llama el cron del servidor
// (scripts/servidor/avisos.sh, cada 10 minutos) con el encabezado
// Authorization: Bearer <CRON_SECRET>. De paso, la limpieza de Migue (consultas de más de 90
// días y horas viejas del tope), así no hace falta otro cron.
export async function GET(pedido: Request) {
  await connection();
  const secreto = process.env.CRON_SECRET;
  if (!secreto?.trim()) {
    console.warn("Avisos por correo: falta CRON_SECRET, /api/avisos rechaza todos los pedidos.");
    return new Response("No autorizado", { status: 401 });
  }
  const recibido = Buffer.from(pedido.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (recibido.length !== esperado.length || !crypto.timingSafeEqual(recibido, esperado)) {
    return new Response("No autorizado", { status: 401 });
  }
  const enviados = await procesarAvisos(50);
  await purgarMigue();
  return Response.json({ enviados });
}
