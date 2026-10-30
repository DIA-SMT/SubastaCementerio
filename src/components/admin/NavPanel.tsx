"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  IconoAjustes,
  IconoAnterior,
  IconoArtista,
  IconoAuditoria,
  IconoCerrar,
  IconoListado,
  IconoMartillo,
  IconoMenu,
  IconoObra,
  IconoPersonas,
  IconoQr,
  IconoSiguiente,
  IconoTablero,
  IconoTexto,
  IconoVer,
} from "@/components/Iconos";
import { OrnamentoArco } from "@/components/Ornamentos";

type Seccion = { href: string; texto: string; Icono: ComponentType<SVGProps<SVGSVGElement>> };

export const SECCIONES_PANEL: readonly Seccion[] = [
  { href: "/admin", texto: "Tablero", Icono: IconoTablero },
  { href: "/admin/obras", texto: "Obras", Icono: IconoObra },
  { href: "/admin/artistas", texto: "Artistas", Icono: IconoArtista },
  { href: "/admin/ofertas", texto: "Ofertas", Icono: IconoMartillo },
  { href: "/admin/oferentes", texto: "Oferentes", Icono: IconoPersonas },
  { href: "/admin/configuracion", texto: "Configuración", Icono: IconoAjustes },
  { href: "/admin/textos", texto: "Textos", Icono: IconoTexto },
  { href: "/admin/exportar", texto: "Listado final", Icono: IconoListado },
  { href: "/admin/qr", texto: "Carteles QR", Icono: IconoQr },
  { href: "/admin/auditoria", texto: "Auditoría", Icono: IconoAuditoria },
];

const esActiva = (ruta: string | null, href: string) =>
  ruta != null && (href === "/admin" ? ruta === "/admin" : ruta === href || ruta.startsWith(`${href}/`));

// Preferencia de menú plegado: se recuerda en este navegador (si el almacenamiento falla, queda
// desplegado). useSyncExternalStore evita leer localStorage durante el render del servidor.
const CLAVE = "panel:menu-plegado";
const oyentes = new Set<() => void>();
const leerPlegado = () => {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
};
const guardarPlegado = (valor: boolean) => {
  try {
    localStorage.setItem(CLAVE, valor ? "1" : "0");
  } catch {}
  oyentes.forEach((f) => f());
};
const suscribir = (f: () => void) => {
  oyentes.add(f);
  window.addEventListener("storage", f);
  return () => {
    oyentes.delete(f);
    window.removeEventListener("storage", f);
  };
};

// Menú del celular y la tablet: el botón va en la barra superior y el menú, acá. Comparten este
// estado (abierto o cerrado) sin pasar por un contexto.
let movilAbierto = false;
const oyentesMovil = new Set<() => void>();
const abrirMovil = (valor: boolean) => {
  movilAbierto = valor;
  oyentesMovil.forEach((f) => f());
};
const suscribirMovil = (f: () => void) => {
  oyentesMovil.add(f);
  return () => oyentesMovil.delete(f);
};
const useMovilAbierto = () =>
  useSyncExternalStore(
    suscribirMovil,
    () => movilAbierto,
    () => false,
  );

type Logos = {
  /** Logo completo a color, para el menú desplegado (lo arma el servidor: <Marca>). */
  logo: ReactNode;
  /** Solo el isologo, para el menú plegado. */
  isologo: ReactNode;
};

/** Menú del panel con la sección actual marcada. Va dentro de <Suspense> (lee la URL). */
export function NavPanel(logos: Logos) {
  return <MenuPanel ruta={usePathname()} {...logos} />;
}

/** Mismo menú sin marcar la sección: se muestra mientras se resuelve la URL. */
export function NavPanelBase(logos: Logos) {
  return <MenuPanel ruta={null} {...logos} />;
}

/** Botón «Menú» de la barra superior (celular y tablet). */
export function BotonMenuPanel() {
  const abierto = useMovilAbierto();
  return (
    <button
      type="button"
      onClick={() => abrirMovil(true)}
      aria-haspopup="dialog"
      aria-expanded={abierto}
      aria-controls="menu-panel"
      data-recorrido="menu"
      className="-ml-1.5 inline-flex min-h-11 items-center gap-2 rounded-md px-2.5 font-semibold text-tinta transition-colors duration-200 hover:bg-tinta/5 lg:hidden"
    >
      <IconoMenu className="text-[1.35rem] text-marino" />
      <span className="max-[26rem]:sr-only">Menú</span>
    </button>
  );
}

/**
 * Computadora: columna fija a la izquierda, de alto completo y en azul noche municipal, con el
 * logo arriba (no se desplaza con la página: un espaciador ocupa su lugar en el flujo). Se pliega
 * a una franja de íconos.
 * Celular y tablet: el mismo menú en un panel lateral (diálogo modal: Escape lo cierra y el foco
 * no sale de él mientras está abierto).
 */
function MenuPanel({ ruta, logo, isologo }: { ruta: string | null } & Logos) {
  const plegado = useSyncExternalStore(suscribir, leerPlegado, () => false);
  const abierto = useMovilAbierto();
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  // Al cambiar de pantalla (también con «Atrás»), el menú del celular se cierra.
  useEffect(() => abrirMovil(false), [ruta]);

  return (
    <>
      {/* Celular y tablet */}
      <dialog
        ref={dialogo}
        id="menu-panel"
        aria-label="Menú del panel"
        onClose={() => abrirMovil(false)}
        // Un clic en el velo (fuera del panel) también cierra.
        onClick={(e) => e.target === e.currentTarget && abrirMovil(false)}
        className="menu-movil fondo-marino m-0 h-dvh max-h-none w-[min(20rem,86vw)] max-w-none overflow-hidden p-0 backdrop:bg-marino/55 backdrop:backdrop-blur-[2px] lg:hidden"
      >
        <div className="relative flex h-full flex-col">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 py-3 pr-3 pl-5">
            <Link href="/admin" onClick={() => abrirMovil(false)} className="rounded-sm">
              {logo}
              <span className="sr-only">: ir al tablero</span>
            </Link>
            <button
              type="button"
              onClick={() => abrirMovil(false)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-[1.3rem] text-marino-tenue transition-colors duration-200 hover:bg-white/10 hover:text-white"
            >
              <IconoCerrar />
              <span className="sr-only">Cerrar el menú</span>
            </button>
          </div>
          <nav aria-label="Panel" className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
            <ul className="flex flex-col gap-1">
              {SECCIONES_PANEL.map((s) => (
                <li key={s.href}>
                  <Enlace seccion={s} activa={esActiva(ruta, s.href)} alElegir={() => abrirMovil(false)} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="relative z-10 border-t border-white/10 px-3 py-3">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.94rem] font-medium text-white/80 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white"
            >
              <IconoVer className="text-lg text-marino-tenue" />
              Ver el sitio
            </Link>
          </div>
          <MarcaDeAgua />
        </div>
      </dialog>

      {/* Computadora */}
      <div
        aria-hidden
        className={`hidden shrink-0 transition-[width] duration-300 ease-suave lg:block ${plegado ? "w-[4.75rem]" : "w-64"}`}
      />
      <nav
        aria-label="Panel"
        data-recorrido="menu"
        className={`fondo-marino fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden transition-[width] duration-300 ease-suave lg:flex ${
          plegado ? "w-[4.75rem]" : "w-64"
        }`}
      >
        <div className={`flex h-[4.5rem] shrink-0 items-center border-b border-white/10 ${plegado ? "justify-center" : "px-5"}`}>
          <Link href="/admin" title={plegado ? "Tablero" : undefined} className="rounded-sm">
            {plegado ? isologo : logo}
            <span className="sr-only">: ir al tablero</span>
          </Link>
        </div>
        <ul className={`relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto py-4 ${plegado ? "px-2.5" : "px-3"}`}>
          {SECCIONES_PANEL.map((s) => (
            <li key={s.href}>
              <Enlace seccion={s} activa={esActiva(ruta, s.href)} plegado={plegado} />
            </li>
          ))}
        </ul>
        <div className={`relative z-10 flex flex-col gap-1 border-t border-white/10 py-3 ${plegado ? "items-center px-2.5" : "px-3"}`}>
          <Link
            href="/"
            title={plegado ? "Ver el sitio" : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-md text-[0.9rem] font-medium text-marino-tenue transition-colors duration-200 hover:bg-white/[0.07] hover:text-white ${
              plegado ? "w-10 justify-center" : "px-3"
            }`}
          >
            <IconoVer className="text-lg" />
            <span className={plegado ? "sr-only" : ""}>Ver el sitio</span>
          </Link>
          <button
            type="button"
            onClick={() => guardarPlegado(!plegado)}
            aria-expanded={!plegado}
            title={plegado ? "Desplegar el menú" : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-md text-[0.9rem] font-medium text-marino-tenue transition-colors duration-200 hover:bg-white/[0.07] hover:text-white ${
              plegado ? "w-10 justify-center" : "w-full px-3"
            }`}
          >
            {plegado ? <IconoSiguiente className="text-lg" /> : <IconoAnterior className="text-lg" />}
            <span className={plegado ? "sr-only" : ""}>{plegado ? "Desplegar el menú" : "Plegar el menú"}</span>
          </button>
        </div>
        {!plegado && <MarcaDeAgua />}
      </nav>
    </>
  );
}

/** Marca de agua: el arco de la galería del cementerio, casi transparente, al pie del menú. */
function MarcaDeAgua() {
  return (
    <OrnamentoArco aria-hidden className="pointer-events-none absolute -bottom-10 -left-8 w-56 text-white/[0.055]" />
  );
}

function Enlace({
  seccion: { href, texto, Icono },
  activa,
  plegado = false,
  alElegir,
}: {
  seccion: Seccion;
  activa: boolean;
  plegado?: boolean;
  alElegir?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={alElegir}
      aria-current={activa ? "page" : undefined}
      title={plegado ? texto : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-md text-[0.95rem] whitespace-nowrap transition-[background-color,color] duration-200 ${
        plegado ? "justify-center" : "px-3"
      } ${
        activa
          ? "bg-smt font-semibold text-white shadow-[0_8px_18px_-10px_rgb(22_101_245/0.9)]"
          : "font-medium text-white/80 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      <Icono className={`shrink-0 text-[1.2rem] ${activa ? "text-white" : "text-marino-tenue"}`} />
      <span className={plegado ? "sr-only" : ""}>{texto}</span>
      {/* Acento amarillo del logo en la sección activa. */}
      {activa && !plegado && <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-amarillo" />}
    </Link>
  );
}
