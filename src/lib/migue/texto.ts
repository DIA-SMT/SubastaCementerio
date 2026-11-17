/**
 * Cómo lee Migue lo que escribe la gente (núcleo de Migue, CementerIA
 * src/lib/migue/ayuda-interna.ts): sin tildes y en minúsculas, porque así se escribe en el
 * celular, y `\b` no reconoce la «é» como letra.
 */

export function simplificar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const VACIAS = new Set(
  "el la los las un una unos unas de del al a en y o que se su sus por para con sobre es son como mas hay este esta estos estas donde cuando quien cual cuales me te le nos lo mi tu hago hacer puedo cosa".split(
    " ",
  ),
);

/** Las palabras que cuentan para buscar (sin tildes, de 3 letras o más, sin las vacías). */
export function palabras(texto: string): string[] {
  return simplificar(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 2 && !VACIAS.has(p));
}

/** Dos palabras "son la misma" si una empieza con la otra y tienen 4 letras o más (oferta / ofertas, ofertar). */
export function parecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const raiz = (p: string) => p.slice(0, Math.max(4, p.length - 2));
  return a.length >= 4 && b.length >= 4 && (raiz(a) === raiz(b) || a.startsWith(raiz(b)) || b.startsWith(raiz(a)));
}
