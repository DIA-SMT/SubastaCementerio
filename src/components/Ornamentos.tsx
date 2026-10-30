import type { SVGProps } from "react";

// Ornamentos de la muestra "Memorias del futuro" (trazos del paquete de recursos visuales, en
// el color del texto para poder teñirlos: celeste sobre azul noche, azul suave sobre blanco cálido).
// Siempre decorativos y en segundo plano: nunca llevan información.

type Props = SVGProps<SVGSVGElement>;

function Ornamento({ viewBox, children, ...props }: Props) {
  return (
    <svg viewBox={viewBox} fill="none" stroke="currentColor" aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

/** Triple arco de una galería, con su cornisa. */
export const OrnamentoArco = (p: Props) => (
  <Ornamento viewBox="0 0 220 290" strokeWidth={2.3} {...p}>
    <path d="M24 279V118C24 71 61 34 110 34s86 37 86 84v161M39 279V118c0-39 31-70 71-70s71 31 71 70v161M58 279V122c0-29 23-52 52-52s52 23 52 52v157" />
    <path d="M13 279h195M12 109h196M110 12v24M97 19h26M31 20h158" />
    <path d="M14 108c4-51 44-93 96-93s92 42 96 93" />
  </Ornamento>
);

/** Rosetón de ocho pétalos. */
export const OrnamentoRoseton = (p: Props) => (
  <Ornamento viewBox="0 0 240 240" strokeWidth={2} {...p}>
    <circle cx="120" cy="120" r="108" />
    <circle cx="120" cy="120" r="94" />
    <circle cx="120" cy="120" r="29" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((g) => (
      <path key={g} d="M120 91C98 59 105 30 120 24c15 6 22 35 0 67Z" transform={`rotate(${g} 120 120)`} />
    ))}
  </Ornamento>
);

/** Ramita de olivo (las hojas van rellenas en el mismo color, más suaves). */
export const OrnamentoOlivo = (p: Props) => (
  <Ornamento viewBox="0 0 320 190" strokeWidth={2.4} strokeLinecap="round" {...p}>
    <path d="M26 161Q119 119 280 22" />
    <g fill="currentColor" stroke="none" opacity={0.75}>
      <ellipse cx="78" cy="122" rx="12" ry="33" transform="rotate(-38 78 122)" />
      <ellipse cx="110" cy="109" rx="12" ry="32" transform="rotate(28 110 109)" />
      <ellipse cx="148" cy="81" rx="11" ry="30" transform="rotate(-37 148 81)" />
      <ellipse cx="181" cy="66" rx="11" ry="29" transform="rotate(31 181 66)" />
      <ellipse cx="226" cy="40" rx="10" ry="27" transform="rotate(-36 226 40)" />
    </g>
  </Ornamento>
);

/** Columna clásica estriada. */
export const OrnamentoColumna = (p: Props) => (
  <Ornamento viewBox="0 0 130 290" strokeWidth={2} {...p}>
    <path d="M20 270h90v11H20zM26 259h78v11H26zM36 52h58v207H36zM29 40h72v12H29zM18 30h94v10H18zM29 20c22 12 50 12 72 0M46 53v205M65 53v205M84 53v205" />
  </Ornamento>
);

/** Separador horizontal con un rombo al centro. Se estira a lo ancho (conserva el alto). */
export const Divisor = ({ className = "", ...p }: Props) => (
  <Ornamento viewBox="0 0 500 30" strokeWidth={1.4} preserveAspectRatio="xMidYMid meet" className={className} {...p}>
    <path d="M0 15h226M274 15h226" />
    <path d="m250 3 12 12-12 12-12-12 12-12Z" />
    <circle cx="250" cy="15" r="4" />
  </Ornamento>
);
