import fs from "node:fs";
import path from "node:path";

// Logos institucionales. Se usan tal cual vienen (sin redibujar ni modificar):
// basta con copiarlos a public/marca/. Mientras falten, se muestra un marcador.
// Con `tinta`, el logo se muestra en un solo color sobre fondo claro: se usa el mismo archivo
// como silueta (máscara). Es la versión monocroma; si llega la positiva oficial, va esa.

const LOGOS = {
  "smt-blanco": { archivo: "logo-smt-blanco.png", nombre: "Ciudad SMT", marcador: "Logo Ciudad SMT", alto: 44, proporcion: 507 / 206 },
  // A color, para fondos oscuros: isologo azul, celeste y amarillo con el texto en blanco.
  "smt-color": {
    archivo: "logo-smt-color.png",
    nombre: "Ciudad San Miguel de Tucumán",
    marcador: "Logo Ciudad San Miguel de Tucumán",
    alto: 44,
    proporcion: 910 / 297,
  },
  "muni-iso": { archivo: "logo-muni-iso.png", nombre: "Municipalidad de San Miguel de Tucumán", marcador: "Isologo", alto: 56, proporcion: 1 },
  ia: { archivo: "logo-ia.png", nombre: "Dirección de Inteligencia Artificial", marcador: "Logo DIA", alto: 36, proporcion: 526 / 220 },
} as const;

const disponibles = Object.fromEntries(
  Object.entries(LOGOS).map(([clave, { archivo }]) => [
    clave,
    fs.existsSync(path.join(process.cwd(), "public", "marca", archivo)),
  ]),
) as Record<keyof typeof LOGOS, boolean>;

export function Marca({
  logo,
  claro = false,
  alto: altoPedido,
  tinta,
}: {
  logo: keyof typeof LOGOS;
  claro?: boolean;
  /** Alto en píxeles, si el lugar pide otro distinto del habitual. */
  alto?: number;
  /** Color (CSS) para mostrar el logo en una sola tinta, sin fondo. */
  tinta?: string;
}) {
  const { archivo, nombre, marcador, alto: altoHabitual, proporcion } = LOGOS[logo];
  const alto = altoPedido ?? altoHabitual;
  if (disponibles[logo] && tinta) {
    const mascara = `url(/marca/${archivo}) center / contain no-repeat`;
    return (
      <span
        role="img"
        aria-label={nombre}
        className="inline-block shrink-0"
        style={{ height: alto, width: Math.round(alto * proporcion), background: tinta, mask: mascara, WebkitMask: mascara }}
      />
    );
  }
  if (disponibles[logo]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo sin procesar, tal como lo entrega la Municipalidad
      <img src={`/marca/${archivo}`} alt={nombre} style={{ height: alto, width: "auto" }} />
    );
  }
  return (
    <span
      role="img"
      aria-label={nombre}
      title={`Falta public/marca/${archivo}`}
      style={{ height: alto }}
      className={`inline-flex shrink-0 items-center rounded-sm whitespace-nowrap border border-dashed px-3 text-sm font-semibold ${
        claro ? "border-white/70 text-white" : "border-gris text-gris"
      }`}
    >
      {marcador}
    </span>
  );
}
