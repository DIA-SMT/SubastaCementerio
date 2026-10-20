import fs from "node:fs";
import path from "node:path";

// Logos institucionales. Se usan tal cual vienen (sin redibujar ni modificar):
// basta con copiarlos a public/marca/. Mientras falten, se muestra un marcador.

const LOGOS = {
  "smt-blanco": { archivo: "logo-smt-blanco.png", nombre: "Ciudad SMT", marcador: "Logo Ciudad SMT", alto: 44 },
  "muni-iso": { archivo: "logo-muni-iso.png", nombre: "Municipalidad de San Miguel de Tucumán", marcador: "Isologo", alto: 56 },
  ia: { archivo: "logo-ia.png", nombre: "Dirección de Inteligencia Artificial", marcador: "Logo DIA", alto: 36 },
} as const;

const disponibles = Object.fromEntries(
  Object.entries(LOGOS).map(([clave, { archivo }]) => [
    clave,
    fs.existsSync(path.join(process.cwd(), "public", "marca", archivo)),
  ]),
) as Record<keyof typeof LOGOS, boolean>;

export function Marca({ logo, claro = false }: { logo: keyof typeof LOGOS; claro?: boolean }) {
  const { archivo, nombre, marcador, alto } = LOGOS[logo];
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
      className={`inline-flex shrink-0 items-center rounded-md whitespace-nowrap border-2 border-dashed px-3 text-sm font-bold ${
        claro ? "border-white/70 text-white" : "border-gris text-gris"
      }`}
    >
      {marcador}
    </span>
  );
}
