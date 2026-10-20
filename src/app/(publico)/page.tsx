import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { PastillaProvisorio } from "@/components/Avisos";
import { FotoObra } from "@/components/FotoObra";
import { IconoCampana, IconoFlecha, IconoGrilla, IconoMartillo, IconoObra } from "@/components/Iconos";
import { Markdown } from "@/components/Markdown";
import { FranjaPlazo } from "@/components/Plazo";
import { TarjetaObra } from "@/components/TarjetaObra";
import { TituloSeccion } from "@/components/TituloSeccion";
import { estadoSubasta, listarObras, obtenerPagina } from "@/lib/datos/publico";
import { tituloObra } from "@/lib/formato";

const PASOS = [
  {
    titulo: "Explorá las obras",
    texto: "Recorré el catálogo en línea o escaneá el código QR que acompaña a cada escultura.",
    Icono: IconoGrilla,
  },
  {
    titulo: "Seleccioná tu escultura favorita",
    texto: "En su ficha ves las fotos, la historia de la obra, la oferta actual y el mínimo para superarla.",
    Icono: IconoObra,
  },
  {
    titulo: "Realizá tu oferta",
    texto: "Ingresá con tu correo y el código de 6 números que te mandamos. Escribí el monto, revisalo y confirmalo.",
    Icono: IconoMartillo,
  },
  {
    titulo: "Seguí el resultado de la subasta",
    texto: "Si alguien supera tu oferta, te avisamos por correo. En Mis ofertas ves cómo va cada una.",
    Icono: IconoCampana,
  },
];

/** Retraso de la animación de entrada (ver .entrada en globals.css). */
const retraso = (ms: number) => ({ "--retraso": `${ms}ms` }) as CSSProperties;

export default function Inicio() {
  return (
    <>
      <Suspense fallback={<EsqueletoHero />}>
        <Hero />
      </Suspense>

      <section className="contenedor pt-20 md:pt-28" aria-labelledby="titulo-obras">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <TituloSeccion id="titulo-obras" antetitulo="Catálogo">
            Las obras
          </TituloSeccion>
          <Link href="/obras" className="enlace-sutil group">
            Ver el catálogo completo
            <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <Suspense fallback={<EsqueletoMuestra />}>
          <Muestra />
        </Suspense>
      </section>

      <section className="contenedor pt-24 md:pt-32" aria-labelledby="titulo-pasos">
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <TituloSeccion id="titulo-pasos" antetitulo="Paso a paso">
              Cómo participar
            </TituloSeccion>
            <p className="mt-5 max-w-sm text-gris">
              No hace falta contraseña: ingresás con tu correo y un código que te mandamos.
            </p>
            <p className="mt-6">
              <Link href="/como-participar" className="enlace-sutil group">
                Leer la explicación completa
                <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>
          <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:col-span-8">
            {PASOS.map(({ titulo, texto, Icono }, i) => (
              <li key={titulo} className="revelar border-t border-tinta pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[0.9rem] font-semibold tracking-[0.04em] text-azul tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icono className="text-[1.6rem] text-gris-suave" />
                </div>
                <h3 className="mt-7 text-subtitulo">{titulo}</h3>
                <p className="mt-2 max-w-sm text-texto">{texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Suspense fallback={null}>
        <Iniciativa />
      </Suspense>
    </>
  );
}

/** Primer párrafo del texto editable de la portada (para el hero); el resto va más abajo. */
function partir(contenido: string) {
  const bloques = contenido.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const i = bloques.findIndex((b) => b.trim() && !/^(#|>|-|\d+\.)/.test(b.trim()));
  if (i < 0) return { bajada: "", resto: contenido };
  return { bajada: bloques[i].replace(/\*\*/g, ""), resto: bloques.filter((_, j) => j !== i).join("\n\n") };
}

async function Hero() {
  const [estado, pagina, obras] = await Promise.all([estadoSubasta(), obtenerPagina("portada"), listarObras()]);
  // La primera obra con foto ilustra la portada; sin fotos, queda el marcador neutro.
  const destacada = obras.find((o) => o.portada) ?? null;
  const { bajada } = partir(pagina?.contenido ?? "");

  return (
    <>
      {/* Celular: título, lámina y después el texto. Computadora: texto a la izquierda (centrado
          en el alto de la lámina) y lámina a la derecha. */}
      <section
        aria-labelledby="titulo-portada"
        className="contenedor grid gap-x-10 gap-y-9 pt-8 pb-14 md:pt-12 lg:grid-cols-12 lg:gap-y-0 lg:pt-10 lg:pb-20"
      >
        <div className="lg:col-span-6 lg:row-start-1 lg:self-end xl:col-span-5">
          <p className="antetitulo entrada">Cultura · Patrimonio · Solidaridad</p>
          <h1 id="titulo-portada" className="entrada mt-6 text-display" style={retraso(80)}>
            El arte transforma nuestra historia
          </h1>
          <p
            className="entrada mt-7 flex items-center gap-3 font-display text-[1.1rem] font-medium tracking-[-0.01em] text-tinta"
            style={retraso(160)}
          >
            <span aria-hidden className="hidden h-px w-8 shrink-0 bg-tinta/50 sm:block" />
            Subasta Solidaria · Cementerio del Oeste
          </p>
        </div>

        {/* Lámina: 4:5, sin pasar del alto de la pantalla en computadora. */}
        <figure className="w-full sm:max-w-[28rem] lg:col-span-6 lg:row-span-2 lg:max-w-none lg:row-start-1 lg:ml-auto lg:w-[min(100%,calc((100svh-14rem)*0.8))] xl:col-start-7">
          <div
            className="entrada-foto relative aspect-[4/5] max-h-[64svh] w-full overflow-hidden rounded-sm bg-piedra lg:max-h-none"
            style={retraso(120)}
          >
            <FotoObra foto={destacada?.portada ?? null} tamanos="(min-width: 1024px) 600px, 100vw" prioridad />
          </div>
          {destacada && (
            <figcaption className="mt-4 border-t border-linea pt-3 text-[0.88rem]">
              <Link href={`/obras/${destacada.numero}`} className="group flex items-start justify-between gap-4">
                <span>
                  <span className="text-gris tabular-nums">Obra N° {destacada.numero}</span>
                  <span aria-hidden className="mx-2 text-gris-suave">
                    ·
                  </span>
                  <span
                    className={`font-semibold text-tinta underline decoration-transparent underline-offset-[0.3em] transition-colors duration-200 group-hover:decoration-current ${
                      destacada.titulo ? "" : "italic"
                    }`}
                  >
                    {tituloObra(destacada.titulo)}
                  </span>
                  <span className="text-gris">, {destacada.artistaNombre}</span>
                </span>
                <IconoFlecha className="mt-[0.2em] shrink-0 text-base text-tinta transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </figcaption>
          )}
        </figure>

        <div className="lg:col-span-6 lg:row-start-2 lg:self-start xl:col-span-5">
          {bajada && (
            <p className="entrada max-w-[34rem] text-texto lg:mt-5" style={retraso(220)}>
              {bajada}
            </p>
          )}
          {pagina?.provisorio && (
            <p className="entrada mt-4" style={retraso(220)}>
              <PastillaProvisorio />
            </p>
          )}
          <div className="entrada mt-9 flex flex-wrap items-center gap-x-8 gap-y-5" style={retraso(280)}>
            <Link href="/obras" className="boton-primario group">
              Explorar las obras
              <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="#iniciativa" className="enlace-sutil">
              Conocer la iniciativa
            </Link>
          </div>
        </div>
      </section>

      <FranjaPlazo estado={estado} />
    </>
  );
}

async function Muestra() {
  const [estado, obras] = await Promise.all([estadoSubasta(), listarObras()]);
  if (obras.length === 0) {
    return <p className="mt-10 border-t border-linea pt-6 text-gris">Todavía no hay obras publicadas.</p>;
  }
  return (
    <>
      {/* En el celular, una fila que se desliza; desde tablet, grilla. */}
      <ul
        aria-label="Primeras obras del catálogo"
        className="-mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-x-8"
      >
        {obras.slice(0, 6).map((o, i) => (
          <li key={o.id} className="w-[78%] max-w-[22rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <TarjetaObra obra={o} fase={estado.fase} prioridad={i < 3} />
          </li>
        ))}
      </ul>
      <p className="mt-10 flex justify-center">
        <Link href="/obras" className="boton-secundario group">
          Ver las {obras.length} obras
          <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </p>
    </>
  );
}

async function Iniciativa() {
  const pagina = await obtenerPagina("portada");
  if (!pagina) return null;
  const { resto } = partir(pagina.contenido);
  return (
    <section
      id="iniciativa"
      aria-labelledby="titulo-iniciativa"
      // Última sección: el margen negativo anula el espacio inferior del layout y la apoya en el pie.
      className="mt-24 -mb-24 border-t border-linea bg-white md:mt-32 md:-mb-32"
    >
      <div className="contenedor grid gap-x-10 gap-y-10 py-20 md:py-28 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <TituloSeccion id="titulo-iniciativa" antetitulo="La iniciativa">
            {pagina.titulo}
          </TituloSeccion>
          {pagina.provisorio && (
            <p className="mt-5">
              <PastillaProvisorio />
            </p>
          )}
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          {resto.trim() && <Markdown texto={resto} />}
          <ul className="mt-10 divide-y divide-linea border-y border-linea">
            {[
              { href: "/destino", texto: "Destino de lo recaudado" },
              { href: "/bases-y-condiciones", texto: "Bases y condiciones" },
            ].map((e) => (
              <li key={e.href}>
                <Link
                  href={e.href}
                  className="group flex min-h-14 items-center justify-between gap-4 font-medium text-tinta transition-colors duration-200 hover:text-azul"
                >
                  {e.texto}
                  <IconoFlecha className="text-gris-suave transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-azul" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[0.9rem] text-gris">La plataforma no cobra ni procesa pagos.</p>
        </div>
      </div>
    </section>
  );
}

function EsqueletoHero() {
  return (
    <div aria-busy="true" aria-label="Cargando la portada">
      <div className="contenedor grid gap-x-10 gap-y-12 pt-8 pb-14 md:pt-12 lg:grid-cols-12 lg:items-center lg:pt-10 lg:pb-20">
        <div className="space-y-5 lg:col-span-6 xl:col-span-5">
          <div className="esqueleto h-4 w-56" />
          <div className="esqueleto h-28 w-full max-w-md" />
          <div className="esqueleto h-5 w-72" />
          <div className="esqueleto h-24 w-full max-w-lg" />
          <div className="esqueleto h-12 w-52" />
        </div>
        <div className="esqueleto aspect-[4/5] max-h-[72svh] w-full rounded-sm lg:col-span-6 lg:ml-auto lg:max-h-none lg:w-[min(100%,calc((100svh-14rem)*0.8))] xl:col-start-7" />
      </div>
      <div className="h-36 border-y border-linea bg-white" />
    </div>
  );
}

function EsqueletoMuestra() {
  return (
    <ul aria-busy="true" aria-label="Cargando obras" className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className={`overflow-hidden rounded-lg bg-white ring-1 ring-linea ${i === 2 ? "hidden lg:block" : ""}`}>
          <div className="esqueleto aspect-[4/5] rounded-none" />
          <div className="space-y-2.5 p-5">
            <div className="esqueleto h-4 w-16" />
            <div className="esqueleto h-5 w-3/4" />
            <div className="esqueleto h-4 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
