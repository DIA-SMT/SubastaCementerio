import fs from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { CARPETA_LOCAL } from "@/lib/almacenamiento";
import { sinSupabase } from "@/lib/entorno";

// Sin Supabase (modo local o servidor propio): sirve las fotos subidas desde el panel.
export async function GET(_pedido: Request, { params }: RouteContext<"/subidas/[...ruta]">) {
  await connection();
  const { ruta } = await params;
  const relativa = ruta.join("/");
  if (!sinSupabase || !/^[a-z0-9-]+\/[a-f0-9-]+\.jpg$/.test(relativa)) {
    return new Response("No encontrado", { status: 404 });
  }
  try {
    const datos = await fs.readFile(path.join(CARPETA_LOCAL, relativa));
    return new Response(new Uint8Array(datos), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
