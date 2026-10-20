import QRCode from "qrcode";

// Códigos QR de las fichas de las obras. Nivel de corrección M: módulos más grandes
// (se leen mejor de lejos) y tolera manchas o reflejos en el cartel impreso.

const NIVEL = "M" as const;
const MARGEN_MODULOS = 4;
const OSCURO = "#10233d";
const CLARO = "#ffffff";

/** SVG del QR (para mostrar en el panel o descargar). */
export function qrSvg(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: NIVEL,
    margin: MARGEN_MODULOS,
    color: { dark: OSCURO, light: CLARO },
  });
}

/** PNG del QR en alta resolución (2400 px de lado: unos 600 ppp a 10 cm). */
export function qrPng(url: string, lado = 2400) {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: NIVEL,
    margin: MARGEN_MODULOS,
    width: lado,
    color: { dark: `${OSCURO}ff`, light: `${CLARO}ff` },
  });
}

/**
 * Trazado vectorial del QR para dibujarlo en un PDF: cada tramo horizontal de módulos
 * oscuros es un rectángulo. Coordenadas en módulos, con el margen ya incluido.
 */
export function qrTrazado(url: string) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: NIVEL });
  const n = modules.size;
  const m = MARGEN_MODULOS;
  // Cada fila se estira un poco hacia abajo para que no queden rayitas entre filas al imprimir.
  const solape = 0.04;
  const partes: string[] = [];
  for (let fila = 0; fila < n; fila++) {
    let col = 0;
    while (col < n) {
      if (!modules.get(fila, col)) {
        col++;
        continue;
      }
      const inicio = col;
      while (col < n && modules.get(fila, col)) col++;
      const x1 = inicio + m;
      const x2 = col + m;
      const y1 = fila + m;
      const y2 = fila + m + 1 + (fila < n - 1 ? solape : 0);
      partes.push(`M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`);
    }
  }
  return { lado: n + 2 * m, modulos: n, d: partes.join(" "), oscuro: OSCURO, claro: CLARO };
}
