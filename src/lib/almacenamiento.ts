import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { modoLocal } from "@/lib/entorno";

// Fotos de las obras. En Supabase van al bucket público "obras" (las políticas de Storage
// exigen es_admin()); en modo local, a .local/subidas/ y se sirven desde /subidas/.

export const CARPETA_LOCAL = path.join(process.cwd(), ".local", "subidas");
const BUCKET = "obras";
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
export const TAMANO_MAXIMO = 4 * 1024 * 1024;

export type FotoGuardada = { ruta: string; ancho: number; alto: number };

/**
 * Normaliza y guarda una foto: corrige la orientación, la limita a 2000 px por lado,
 * la convierte a JPEG y descarta los metadatos (EXIF, ubicación GPS).
 */
export async function guardarFoto(archivo: File, carpeta: string): Promise<FotoGuardada> {
  if (!TIPOS.has(archivo.type)) throw new Error("La foto tiene que ser JPG, PNG o WebP.");
  if (archivo.size > TAMANO_MAXIMO) throw new Error("La foto pesa más de 4 MB.");
  if (!/^[a-z0-9-]+$/.test(carpeta)) throw new Error("Carpeta inválida.");

  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(Buffer.from(await archivo.arrayBuffer()))
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const ruta = `${carpeta}/${crypto.randomUUID()}.jpg`;
  if (modoLocal) {
    const destino = path.join(CARPETA_LOCAL, ruta);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, data);
  } else {
    const { clienteSupabase } = await import("@/lib/auth/supabase");
    const { error } = await (await clienteSupabase()).storage
      .from(BUCKET)
      .upload(ruta, data, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);
  }
  return { ruta, ancho: info.width, alto: info.height };
}

/** Borra una foto subida. Las rutas que empiezan con "/" son ejemplos de /public: no se tocan. */
export async function borrarFoto(ruta: string) {
  if (ruta.startsWith("/") || ruta.includes("..")) return;
  if (modoLocal) {
    await fs.rm(path.join(CARPETA_LOCAL, ruta), { force: true });
  } else {
    const { clienteSupabase } = await import("@/lib/auth/supabase");
    const { error } = await (await clienteSupabase()).storage.from(BUCKET).remove([ruta]);
    if (error) console.error("No se pudo borrar la foto", ruta, error.message);
  }
}
