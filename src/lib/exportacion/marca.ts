import fs from "node:fs";
import path from "node:path";
import type { Logos } from "./tipos";

// Logos institucionales para los PDF. Se usan tal como los entrega la Municipalidad
// (public/marca/), sin redibujarlos. Si falta alguno, el PDF se genera sin ese logo.

function leer(ruta: string): Buffer | null {
  try {
    return fs.readFileSync(ruta);
  } catch {
    return null;
  }
}

export function cargarLogos(): Logos {
  // Rutas literales: así el empaquetado del servidor (Vercel) detecta los archivos y los incluye.
  return {
    smtBlanco: leer(path.join(process.cwd(), "public/marca/logo-smt-blanco.png")),
    muniIso: leer(path.join(process.cwd(), "public/marca/logo-muni-iso.png")),
  };
}

/** Relación ancho / alto de un PNG (lee el encabezado IHDR). */
export function proporcionPng(png: Buffer | null, porDefecto = 1) {
  if (!png || png.length < 24 || png.toString("ascii", 12, 16) !== "IHDR") return porDefecto;
  const ancho = png.readUInt32BE(16);
  const alto = png.readUInt32BE(20);
  return ancho > 0 && alto > 0 ? ancho / alto : porDefecto;
}
