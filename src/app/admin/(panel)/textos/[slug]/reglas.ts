// Reglas del editor de textos, compartidas por el formulario (cliente) y la acción (servidor).

export const LARGO_MAXIMO_TITULO = 120;
export const LARGO_MAXIMO_CONTENIDO = 20_000;

/** Saltos de línea de Windows a "\n" y sin espacios ni líneas vacías al final. */
export function normalizarContenido(texto: string) {
  return texto.replace(/\r\n?/g, "\n").trimEnd();
}

/** Título en una sola línea, sin espacios repetidos. */
export function normalizarTitulo(texto: string) {
  return texto.replace(/\s+/g, " ").trim();
}
