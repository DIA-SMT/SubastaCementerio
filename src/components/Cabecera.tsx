import type { ReactNode } from "react";

/**
 * Cabecera de las páginas interiores: banda con el degradé institucional, antetítulo y título
 * en blanco (texto grande), y opcionalmente un bloque a la derecha. El contenido de la página
 * puede montarse encima con `-mt-*` para que las tarjetas "floten" sobre la banda.
 */
export function Cabecera({
  titulo,
  antetitulo,
  bajada,
  lateral,
  compacta = false,
}: {
  titulo: ReactNode;
  antetitulo?: ReactNode;
  bajada?: ReactNode;
  lateral?: ReactNode;
  compacta?: boolean;
}) {
  return (
    <section className="fondo-institucional relative isolate overflow-hidden text-white">
      {/* Brillo suave arriba a la derecha, como en las piezas institucionales. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(120% 150% at 88% 8%, rgb(60 180 240 / 0.42), transparent 58%)" }}
      />
      <div
        className={`mx-auto grid max-w-6xl gap-6 px-4 ${compacta ? "pt-10 pb-20" : "py-12 md:py-14"} ${
          lateral ? "lg:grid-cols-[1.4fr_1fr] lg:items-end" : ""
        }`}
      >
        <div>
          {antetitulo && <p className="text-base font-bold tracking-[0.12em] text-white uppercase">{antetitulo}</p>}
          <h1 className="mt-2 text-4xl text-white md:text-5xl">{titulo}</h1>
          {bajada && <div className="mt-3 max-w-2xl text-xl text-white">{bajada}</div>}
        </div>
        {lateral && <div className="rounded-3xl bg-azul-oscuro/45 p-5 ring-1 ring-white/30 backdrop-blur-md">{lateral}</div>}
      </div>
    </section>
  );
}
