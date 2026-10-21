"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import {
  IconoAbajo,
  IconoAjustes,
  IconoAnterior,
  IconoArtista,
  IconoAuditoria,
  IconoListado,
  IconoMartillo,
  IconoObra,
  IconoPersonas,
  IconoQr,
  IconoSiguiente,
  IconoTablero,
  IconoTexto,
} from "@/components/Iconos";

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

/** Menú del panel con la sección actual marcada. Va dentro de <Suspense> (lee la URL). */
export function NavPanel() {
  return <MenuPanel ruta={usePathname()} />;
}

/** Mismo menú sin marcar la sección: se muestra mientras se resuelve la URL. */
export function NavPanelBase() {
  return <MenuPanel ruta={null} />;
}

/**
 * Computadora: columna fija a la izquierda (no se desplaza con la página: un espaciador ocupa
 * su lugar en el flujo y el menú va con position: fixed), en azul noche, que se pliega a una franja de íconos.
 * Celular y tablet: un botón con la sección actual que despliega el menú.
 */
function MenuPanel({ ruta }: { ruta: string | null }) {
  const plegado = useSyncExternalStore(suscribir, leerPlegado, () => false);
  const [abierto, setAbierto] = useState(false);
  const actual = SECCIONES_PANEL.find((s) => esActiva(ruta, s.href));

  return (
    <>
      {/* Celular y tablet */}
      <nav aria-label="Panel" className="border-b border-linea lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="menu-panel"
          className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-medium text-tinta"
        >
          {actual ? <actual.Icono className="text-lg text-azul" /> : null}
          <span className="flex-1">{actual?.texto ?? "Menú del panel"}</span>
          <span className="text-[0.85rem] text-gris">{abierto ? "Cerrar" : "Menú"}</span>
          <IconoAbajo className={`text-lg text-gris transition-transform duration-200 ${abierto ? "rotate-180" : ""}`} />
        </button>
        {abierto && (
          <ul id="menu-panel" className="grid grid-cols-2 gap-1 px-2 pb-3 sm:grid-cols-3">
            {SECCIONES_PANEL.map((s) => (
              <li key={s.href}>
                <Enlace seccion={s} activa={esActiva(ruta, s.href)} alElegir={() => setAbierto(false)} />
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Computadora */}
      <div
        aria-hidden
        className={`hidden shrink-0 transition-[width] duration-300 ease-suave lg:block ${plegado ? "w-[4.25rem]" : "w-56"}`}
      />
      <nav
        aria-label="Panel"
        className={`fondo-noche fixed top-[4.5rem] bottom-0 z-30 hidden flex-col pt-3 pb-5 transition-[width] duration-300 ease-suave lg:flex ${
          plegado ? "w-[4.25rem] px-2" : "w-56 px-3"
        }`}
      >
        <div className={`mb-2 flex ${plegado ? "justify-center" : "justify-end"}`}>
          <button
            type="button"
            onClick={() => guardarPlegado(!plegado)}
            aria-label={plegado ? "Desplegar el menú" : "Plegar el menú"}
            aria-expanded={!plegado}
            title={plegado ? "Desplegar el menú" : "Plegar el menú"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[0.95rem] text-marfil/70 ring-1 ring-marfil/25 transition-colors duration-200 hover:bg-white/10 hover:text-marfil"
          >
            {plegado ? <IconoSiguiente /> : <IconoAnterior />}
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {SECCIONES_PANEL.map((s) => (
            <li key={s.href}>
              <Enlace seccion={s} activa={esActiva(ruta, s.href)} plegado={plegado} oscuro />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function Enlace({
  seccion: { href, texto, Icono },
  activa,
  plegado = false,
  oscuro = false,
  alElegir,
}: {
  seccion: Seccion;
  activa: boolean;
  plegado?: boolean;
  /** En la columna en azul noche (computadora). */
  oscuro?: boolean;
  alElegir?: () => void;
}) {
  const estilo = oscuro
    ? activa
      ? "bg-white/10 font-semibold text-marfil before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-oro"
      : "font-medium text-marfil/75 hover:bg-white/5 hover:text-marfil"
    : activa
      ? "bg-white font-semibold text-tinta shadow-suave ring-1 ring-linea"
      : "font-medium text-texto hover:bg-white/60 hover:text-tinta";
  const icono = oscuro ? (activa ? "text-oro" : "text-marfil/55") : activa ? "text-azul" : "text-gris-suave";
  return (
    <Link
      href={href}
      onClick={alElegir}
      aria-current={activa ? "page" : undefined}
      title={plegado ? texto : undefined}
      className={`relative flex min-h-10 items-center gap-3 rounded-md px-3 text-[0.94rem] whitespace-nowrap transition-colors duration-200 ${
        plegado ? "justify-center px-0" : ""
      } ${estilo}`}
    >
      <Icono className={`shrink-0 text-lg ${icono}`} />
      <span className={plegado ? "sr-only" : ""}>{texto}</span>
    </Link>
  );
}
