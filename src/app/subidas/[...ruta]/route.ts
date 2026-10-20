import fs from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { CARPETA_LOCAL } from "@/lib/almacenamiento";
import { modoLocal } from "@/lib/entorno";

// Solo en modo local: sirve las fotos subidas desde el panel (.local/subidas/).
export async function GET(_pedido: Request, { params }: RouteContext<"/subidas/[...ruta]">) {
  await connection();
  const { ruta } = await params;
  const relativa = ruta.join("/");
  if (!modoLocal || !/^[a-z0-9-]+\/[a-f0-9-]+\.jpg$/.test(relativa)) {
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
