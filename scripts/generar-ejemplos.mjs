// Genera las imágenes de EJEMPLO de public/ejemplo/ (no son fotos de las obras reales).
// Simulan una foto de estudio: fondo liso con viñeta, pedestal y una cabeza intervenida.
// Uso: node scripts/generar-ejemplos.mjs
import fs from "node:fs";
import path from "node:path";

const destino = path.join(process.cwd(), "public", "ejemplo");
fs.mkdirSync(destino, { recursive: true });

const hsl = (h, s, l, a = 1) => `hsl(${Math.round(h) % 360} ${s}% ${l}% / ${a})`;

// Paletas sobrias, de taller: un tono base y dos acentos por obra.
function paleta(n) {
  const base = [18, 32, 205, 145, 350, 40, 190, 265, 10, 170][n % 10];
  return { base, acento1: (base + 150) % 360, acento2: (base + 40) % 360 };
}

function intervencion(n, p) {
  const tipo = n % 5;
  const formas = [];
  for (let i = 0; i < 12; i++) {
    const color = i % 3 === 0 ? hsl(p.acento1, 38, 42) : i % 3 === 1 ? hsl(p.acento2, 45, 58) : hsl(p.base, 30, 30);
    if (tipo === 0) formas.push(`<path d="M${150 + i * 50} 120 C ${300} ${300 + i * 18}, ${520} ${200 + i * 30}, ${660 - i * 20} 760" stroke="${color}" stroke-width="${10 + (i % 3) * 6}" fill="none" stroke-linecap="round" opacity="0.85"/>`);
    if (tipo === 1) formas.push(`<circle cx="${250 + ((i * 89) % 320)}" cy="${230 + ((i * 53) % 430)}" r="${18 + (i % 4) * 16}" fill="${color}" opacity="0.8"/>`);
    if (tipo === 2) formas.push(`<rect x="${210 + (i % 4) * 95}" y="${200 + Math.floor(i / 4) * 150}" width="80" height="130" rx="6" fill="${color}" opacity="${0.55 + (i % 3) * 0.12}" transform="rotate(${(i % 2 ? 1 : -1) * 6} 400 450)"/>`);
    if (tipo === 3) formas.push(`<path d="M${400} ${430} L ${400 + Math.cos(i * 0.52) * 340} ${430 + Math.sin(i * 0.52) * 340}" stroke="${color}" stroke-width="${14 + (i % 2) * 10}" opacity="0.7"/>`);
    if (tipo === 4) formas.push(`<ellipse cx="400" cy="${420}" rx="${300 - i * 22}" ry="${330 - i * 24}" fill="none" stroke="${color}" stroke-width="9" opacity="0.75"/>`);
  }
  return formas.join("");
}

function svg(n, detalle) {
  const p = paleta(n);
  const id = `o${n}${detalle ? "d" : ""}`;
  // Silueta de cabeza de frente con cuello.
  const cabeza = `M400 150 C 520 150 590 250 590 380 C 590 470 560 540 520 585 C 505 602 498 625 498 650 L 498 700 L 302 700 L 302 650 C 302 625 295 602 280 585 C 240 540 210 470 210 380 C 210 250 280 150 400 150 Z`;
  const escena = `
    <path d="${cabeza}" fill="url(#piel${id})"/>
    <g clip-path="url(#clip${id})">${intervencion(n, p)}</g>
    <path d="${cabeza}" fill="url(#luz${id})"/>`;
  const contenido = detalle
    ? `<g transform="translate(-420 -380) scale(2.05)">${escena}</g>`
    : `<ellipse cx="400" cy="905" rx="250" ry="26" fill="${hsl(p.base, 12, 20, 0.28)}" filter="url(#blur${id})"/>
       <rect x="245" y="700" width="310" height="205" rx="4" fill="url(#pedestal${id})"/>
       <rect x="230" y="690" width="340" height="22" rx="4" fill="${hsl(p.base, 8, 93)}"/>
       ${escena}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <radialGradient id="fondo${id}" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="${hsl(p.base, 14, 88)}"/>
      <stop offset="0.7" stop-color="${hsl(p.base, 12, 74)}"/>
      <stop offset="1" stop-color="${hsl(p.base, 14, 58)}"/>
    </radialGradient>
    <linearGradient id="piel${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hsl(p.base, 18, 86)}"/>
      <stop offset="1" stop-color="${hsl(p.base, 16, 66)}"/>
    </linearGradient>
    <radialGradient id="luz${id}" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.32"/>
    </radialGradient>
    <linearGradient id="pedestal${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${hsl(p.base, 6, 84)}"/>
      <stop offset="0.45" stop-color="${hsl(p.base, 6, 95)}"/>
      <stop offset="1" stop-color="${hsl(p.base, 6, 76)}"/>
    </linearGradient>
    <clipPath id="clip${id}"><path d="${cabeza}"/></clipPath>
    <filter id="blur${id}" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="800" height="1000" fill="url(#fondo${id})"/>
  ${contenido}
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="598" y="28" width="174" height="42" rx="21" fill="#ffffff" fill-opacity="0.82"/>
    <text x="685" y="56" text-anchor="middle" font-size="20" font-weight="700" fill="#33414f">Ejemplo · N° ${n}</text>
  </g>
</svg>
`;
}

for (let n = 1; n <= 25; n++) {
  const base = `obra-${String(n).padStart(2, "0")}`;
  fs.writeFileSync(path.join(destino, `${base}.svg`), svg(n, false));
  if (n <= 5) fs.writeFileSync(path.join(destino, `${base}-detalle.svg`), svg(n, true));
}
console.log(`Imágenes de ejemplo generadas en ${destino}`);
