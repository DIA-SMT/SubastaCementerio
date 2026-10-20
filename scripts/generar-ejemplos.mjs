// Genera las imágenes de EJEMPLO de public/ejemplo/ (no son fotos de las obras reales).
// Uso: node scripts/generar-ejemplos.mjs
import fs from "node:fs";
import path from "node:path";

const destino = path.join(process.cwd(), "public", "ejemplo");
fs.mkdirSync(destino, { recursive: true });

const hsl = (h, s, l) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`;

function patron(n, h) {
  const formas = [];
  const tipo = n % 4;
  for (let i = 0; i < 14; i++) {
    const color = hsl(h + i * 47, 70, 45 + (i % 3) * 10);
    if (tipo === 0) formas.push(`<rect x="0" y="${170 + i * 34}" width="800" height="17" fill="${color}"/>`);
    if (tipo === 1) formas.push(`<circle cx="${230 + ((i * 97) % 340)}" cy="${220 + ((i * 61) % 400)}" r="${28 + (i % 4) * 14}" fill="${color}"/>`);
    if (tipo === 2) formas.push(`<polygon points="${230 + i * 25},200 ${300 + i * 25},640 ${250 + i * 25},640" fill="${color}" opacity="0.85"/>`);
    if (tipo === 3) formas.push(`<path d="M${200 + i * 30} 200 Q ${400} ${300 + i * 20} ${600 - i * 30} 640" stroke="${color}" stroke-width="14" fill="none"/>`);
  }
  return formas.join("");
}

function svg(n, detalle) {
  const h = (n * 137.5) % 360;
  const cabeza = `<ellipse cx="400" cy="420" rx="170" ry="215"/>`;
  const contenido = detalle
    ? `<g transform="translate(-400 -420) scale(2)"><g clip-path="url(#c${n})"><rect width="800" height="1000" fill="${hsl(h, 35, 80)}"/>${patron(n, h)}</g></g>`
    : `<rect x="345" y="600" width="110" height="130" fill="${hsl(h, 12, 72)}"/>
       <rect x="250" y="720" width="300" height="80" rx="8" fill="${hsl(h, 10, 62)}"/>
       <rect x="200" y="800" width="400" height="60" rx="8" fill="${hsl(h, 10, 52)}"/>
       <g clip-path="url(#c${n})"><rect width="800" height="1000" fill="${hsl(h, 35, 80)}"/>${patron(n, h)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="f${n}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hsl(h + 180, 25, 94)}"/>
      <stop offset="1" stop-color="${hsl(h + 180, 20, 84)}"/>
    </linearGradient>
    <clipPath id="c${n}">${cabeza}</clipPath>
  </defs>
  <rect width="800" height="1000" fill="url(#f${n})"/>
  ${contenido}
  <rect x="0" y="890" width="800" height="110" fill="#10233d" opacity="0.88"/>
  <text x="400" y="938" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff">IMAGEN DE EJEMPLO</text>
  <text x="400" y="978" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#ffffff">${detalle ? "Detalle · " : ""}Obra N° ${n}</text>
</svg>
`;
}

for (let n = 1; n <= 25; n++) {
  const base = `obra-${String(n).padStart(2, "0")}`;
  fs.writeFileSync(path.join(destino, `${base}.svg`), svg(n, false));
  if (n <= 5) fs.writeFileSync(path.join(destino, `${base}-detalle.svg`), svg(n, true));
}
console.log(`Imágenes de ejemplo generadas en ${destino}`);
