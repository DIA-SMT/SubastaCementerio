import Link from "next/link";
import type { ReactNode } from "react";

// Markdown mínimo para los textos editables: títulos (##, ###), párrafos, listas,
// citas (>), **negrita** y [enlaces](url). Genera elementos de React: no inyecta HTML.

function enLinea(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const patron = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(patron)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(<strong key={m.index} className="font-bold text-tinta">{m[1]}</strong>);
    } else {
      const href = m[3];
      partes.push(
        href.startsWith("/") ? (
          <Link key={m.index} href={href} className="enlace">{m[2]}</Link>
        ) : (
          <a key={m.index} href={/^https?:\/\//.test(href) ? href : "#"} className="enlace" rel="noopener noreferrer">
            {m[2]}
          </a>
        ),
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function Markdown({ texto }: { texto: string }) {
  const bloques = texto.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const salida: ReactNode[] = [];

  bloques.forEach((bloque, i) => {
    const lineas = bloque.split("\n").filter((l) => l.trim() !== "");
    if (lineas.length === 0) return;

    // Un título puede venir seguido de un párrafo en el mismo bloque.
    const primera = lineas[0];
    const titulo = /^(#{2,3})\s+(.*)$/.exec(primera);
    if (titulo) {
      const Etiqueta = titulo[1].length === 2 ? "h2" : "h3";
      salida.push(
        <Etiqueta key={`t${i}`} className={Etiqueta === "h2" ? "mt-8 text-2xl" : "mt-6 text-xl"}>
          {enLinea(titulo[2])}
        </Etiqueta>,
      );
      lineas.shift();
      if (lineas.length === 0) return;
    }

    if (lineas.every((l) => /^[-*]\s+/.test(l))) {
      salida.push(
        <ul key={`l${i}`} className="mt-3 list-disc space-y-1.5 pl-6 marker:text-azul">
          {lineas.map((l, j) => <li key={j}>{enLinea(l.replace(/^[-*]\s+/, ""))}</li>)}
        </ul>,
      );
    } else if (lineas.every((l) => /^\d+\.\s+/.test(l))) {
      salida.push(
        <ol key={`o${i}`} className="mt-3 list-decimal space-y-1.5 pl-6 marker:font-bold marker:text-azul-profundo">
          {lineas.map((l, j) => <li key={j}>{enLinea(l.replace(/^\d+\.\s+/, ""))}</li>)}
        </ol>,
      );
    } else if (lineas.every((l) => l.startsWith(">"))) {
      salida.push(
        <blockquote key={`c${i}`} className="mt-4 rounded-xl border-l-8 border-ambar bg-ambar-suave px-4 py-3 text-tinta">
          {enLinea(lineas.map((l) => l.replace(/^>\s?/, "")).join(" "))}
        </blockquote>,
      );
    } else {
      salida.push(
        <p key={`p${i}`} className="mt-3">
          {enLinea(lineas.join(" "))}
        </p>,
      );
    }
  });

  return <div className="text-lg [&>*:first-child]:mt-0">{salida}</div>;
}
