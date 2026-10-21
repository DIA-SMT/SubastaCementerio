"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { IconoCerrar, IconoMenu } from "./Iconos";

type Enlace = { href: string; texto: string };

const esActivo = (ruta: string, href: string) => ruta === href || ruta.startsWith(`${href}/`);

type PropsLista = { enlaces: Enlace[]; variante: "barra" | "menu"; alElegir?: () => void };

/** Enlaces con la página actual marcada (aria-current). */
function ListaEnlaces({ enlaces, variante, alElegir, ruta }: PropsLista & { ruta: string }) {
  if (variante === "barra") {
    return (
      <ul className="flex h-full items-center gap-1 lg:gap-3">
        {enlaces.map((e) => (
          <li key={e.href} className="h-full">
            <Link
              href={e.href}
              aria-current={esActivo(ruta, e.href) ? "page" : undefined}
              className="relative inline-flex h-full items-center px-3 text-[0.94rem] font-medium text-gris transition-colors duration-200 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-tinta/25 after:transition-transform after:duration-300 after:ease-suave hover:text-tinta hover:after:scale-x-100 aria-[current=page]:text-tinta aria-[current=page]:after:scale-x-100 aria-[current=page]:after:bg-azul"
            >
              {e.texto}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="contenedor divide-y divide-linea py-2">
      {enlaces.map((e) => (
        <li key={e.href}>
          <Link
            href={e.href}
            onClick={alElegir}
            aria-current={esActivo(ruta, e.href) ? "page" : undefined}
            className="flex min-h-14 items-center justify-between font-display text-xl font-semibold tracking-[-0.015em] text-tinta aria-[current=page]:text-azul"
          >
            {e.texto}
            {esActivo(ruta, e.href) && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-azul" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListaConRuta(props: PropsLista) {
  return <ListaEnlaces {...props} ruta={usePathname()} />;
}

/** La ruta actual solo se conoce al pedir la página: mientras tanto, los enlaces sin marcar. */
function Enlaces(props: PropsLista) {
  return (
    <Suspense fallback={<ListaEnlaces {...props} ruta="" />}>
      <ListaConRuta {...props} />
    </Suspense>
  );
}

/**
 * Barra fija: velo marfil translúcido sobre la sala del fondo; al desplazarse se vuelve casi
 * opaca, con un filete y una sombra mínima. En el celular, el menú se despliega.
 */
export function BarraNavegacion({ marca, enlaces }: { marca: ReactNode; enlaces: Enlace[] }) {
  const [desplazado, setDesplazado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const medir = () => setDesplazado(window.scrollY > 8);
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);

  // Con el menú abierto, Escape lo cierra y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const conFondo = desplazado || abierto;

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        conFondo
          ? "border-white/50 bg-papel/[0.82] shadow-[0_10px_30px_-22px_rgb(31_28_24/0.35)] backdrop-blur-xl"
          : "border-white/40 bg-papel/[0.6] backdrop-blur-xl"
      }`}
    >
      <div className="contenedor flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        {marca}

        <nav aria-label="Principal" className="hidden h-full md:block">
          <Enlaces enlaces={enlaces} variante="barra" />
        </nav>

        <button
          ref={boton}
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="menu-movil"
          className="-mr-2 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md px-2.5 font-medium text-tinta md:hidden"
        >
          {abierto ? <IconoCerrar className="text-[1.35rem]" /> : <IconoMenu className="text-[1.35rem]" />}
          <span className="max-[25rem]:sr-only">Menú</span>
        </button>
      </div>

      {abierto && (
        <nav
          id="menu-movil"
          aria-label="Principal"
          className="absolute inset-x-0 top-full border-b border-linea bg-white shadow-[0_24px_40px_-28px_rgb(23_25_28/0.4)] md:hidden motion-safe:animate-[aparecer_200ms_ease-out]"
        >
          <Enlaces enlaces={enlaces} variante="menu" alElegir={() => setAbierto(false)} />
        </nav>
      )}
    </header>
  );
}
