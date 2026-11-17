// Recorta la hoja de personaje de Migue para la Subasta (docs/migue/hoja-personaje.webp,
// 1536×1024: Migue con camisa blanca y el logo de la Ciudad, sobre azul): la cara para el avatar
// (retrato.webp, 320×320) y la vista de frente de cuerpo entero (cuerpo.webp, 200×490). Las dos
// son opacas: el fondo azul es parte de la ilustración y se muestran recortadas (círculo y
// tarjeta), así se ven igual sobre cualquier fondo.
// Uso: node scripts/migue-recortes.mjs docs/migue/hoja-personaje.webp public/migue
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("sharp");
const [hoja, salida] = process.argv.slice(2);
if (!hoja || !salida) {
  console.error("Uso: node scripts/migue-recortes.mjs <hoja> <carpeta de salida>");
  process.exit(1);
}
await sharp(hoja).extract({ left: 150, top: 0, width: 470, height: 470 }).resize(320, 320).webp({ quality: 86 }).toFile(`${salida}/retrato.webp`);
await sharp(hoja).extract({ left: 670, top: 160, width: 200, height: 490 }).webp({ quality: 88 }).toFile(`${salida}/cuerpo.webp`);
