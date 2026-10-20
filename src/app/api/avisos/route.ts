import crypto from "node:crypto";
import { connection } from "next/server";
import { procesarAvisos } from "@/lib/avisos";

// Reintento de avisos por correo pendientes o fallidos. Lo llama el cron de Vercel
// (vercel.json) con el encabezado Authorization: Bearer <CRON_SECRET>.
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
  return Response.json({ enviados });
}
