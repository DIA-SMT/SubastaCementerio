import type { SVGProps } from "react";

// Íconos lineales (trazo de 1,5 sobre 24 px), en el color del texto. Siempre decorativos:
// el texto de al lado dice lo mismo.

type Props = SVGProps<SVGSVGElement>;

function Icono({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoFlecha = (p: Props) => (
  <Icono {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Icono>
);

export const IconoAnterior = (p: Props) => (
  <Icono {...p}>
    <path d="M15 5.5 8.5 12l6.5 6.5" />
  </Icono>
);

export const IconoSiguiente = (p: Props) => (
  <Icono {...p}>
    <path d="m9 5.5 6.5 6.5L9 18.5" />
  </Icono>
);

export const IconoMenu = (p: Props) => (
  <Icono {...p}>
    <path d="M4 8.5h16M4 15.5h16" />
  </Icono>
);

export const IconoCerrar = (p: Props) => (
  <Icono {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icono>
);

export const IconoAmpliar = (p: Props) => (
  <Icono {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icono>
);

export const IconoCheck = (p: Props) => (
  <Icono {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icono>
);

/** Catálogo: grilla de obras. */
export const IconoGrilla = (p: Props) => (
  <Icono {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </Icono>
);

/** Una obra enmarcada. */
export const IconoObra = (p: Props) => (
  <Icono {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <path d="M12 7.5c1.9 0 3 1.5 3 3.4 0 1.4-.7 2.4-1.5 3v1.6h-3v-1.6c-.8-.6-1.5-1.6-1.5-3 0-1.9 1.1-3.4 3-3.4ZM9 17h6" />
  </Icono>
);

/** Martillo de subasta. */
export const IconoMartillo = (p: Props) => (
  <Icono {...p}>
    <rect x="8.5" y="6.25" width="10" height="4.5" rx="1" transform="rotate(45 13.5 8.5)" />
    <path d="M11.8 10.2 4.5 17.5M13 20.5h7.5" />
  </Icono>
);

/** Avisos por correo. */
export const IconoCampana = (p: Props) => (
  <Icono {...p}>
    <path d="M18 15.5v-4.8a6 6 0 0 0-12 0v4.8L4.5 18h15L18 15.5ZM10 20.5a2 2 0 0 0 4 0" />
  </Icono>
);
