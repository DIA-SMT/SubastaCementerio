import Link from "next/link";
import { Suspense } from "react";
import { PastillaProvisorio } from "@/components/Avisos";
import { Carrusel } from "@/components/Carrusel";
import { FondoHero } from "@/components/FondoHero";
import { Markdown } from "@/components/Markdown";
import { PlazoDestacado } from "@/components/Plazo";
import { TarjetaObra } from "@/components/TarjetaObra";
import { TituloSeccion } from "@/components/TituloSeccion";
import { estadoSubasta, listarObras, obtenerPagina } from "@/lib/datos/publico";
import type { Foto } from "@/lib/datos/tipos";

const PASOS = [
  { titulo: "Elegí una obra", texto: "Recorré el catálogo o escaneá el código QR que está junto a cada obra." },
  { titulo: "Ingresá con tu correo", texto: "Te mandamos un código de 6 números. La primera vez te pedimos tus datos." },
  { titulo: "Ofertá", texto: "Escribí cuánto ofrecés, revisalo y confirmalo. Si te superan, te avisamos." },
];

export default function Inicio() {
  return (
    <>
      <Suspense fallback={<EsqueletoHero />}>
        <Hero />
      </Suspense>

      <div className="mx-auto max-w-6xl px-4">
        <section className="pt-14" aria-labelledby="titulo-obras">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <TituloSeccion id="titulo-obras" antetitulo="Catálogo">
              Las obras
            </TituloSeccion>
            <Link href="/obras" className="enlace">
              Ver todas
            </Link>
          </div>
          <div className="mt-6">
            <Suspense fallback={<div className="h-[30rem] animate-pulse rounded-3xl bg-linea" />}>
              <Muestra />
            </Suspense>
          </div>
        </section>

        <section className="pt-14" aria-labelledby="titulo-pasos">
          <TituloSeccion id="titulo-pasos" antetitulo="Paso a paso">
            Cómo participar
          </TituloSeccion>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="superficie-tarjeta p-6">
                <span
                  aria-hidden
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-azul-oscuro via-azul to-celeste text-xl font-extrabold text-white shadow-suave"
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-xl">{p.titulo}</h3>
                <p className="mt-1 text-texto">{p.texto}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5">
            <Link href="/como-participar" className="enlace">
              Leer la explicación completa
            </Link>
          </p>
        </section>

        <Suspense fallback={null}>
          <Propuesta />
        </Suspense>
      </div>
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
  const fotos = obras.map((o) => o.portada).filter((f): f is Foto => !!f).slice(0, 6);
  const { bajada } = partir(pagina?.contenido ?? "");

  return (
    <>
      <section className="relative isolate overflow-hidden text-white">
        <FondoHero fotos={fotos} />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:py-20 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold ring-1 ring-white/40 backdrop-blur md:text-base">
              Noche de los Museos · Cementerio del Oeste
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl leading-[1.05] text-white drop-shadow-[0_3px_18px_rgb(0_0_0/0.3)] md:text-6xl">
              {pagina?.titulo}
            </h1>
            {bajada && <p className="mt-5 max-w-xl text-lg leading-snug font-bold text-white md:text-xl">{bajada}</p>}
            {pagina?.provisorio && (
              <p className="mt-4">
                <PastillaProvisorio />
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/obras"
                className="boton bg-white text-azul-profundo shadow-[0_16px_34px_rgb(0_0_0/0.2)] hover:bg-fondo"
              >
                Ver las {obras.length} obras
              </Link>
              <Link href="/como-participar" className="boton bg-azul-profundo/80 text-white ring-2 ring-white/80 hover:bg-azul-oscuro">
                Cómo participar
              </Link>
            </div>
          </div>
          <div className="rounded-3xl bg-azul-oscuro/55 p-6 ring-1 ring-white/30 backdrop-blur-md">
            <PlazoDestacado estado={estado} claro />
          </div>
        </div>
      </section>

      {/* Franja de datos debajo del hero, como en el Bus Turístico. */}
      <div className="border-b border-linea bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-x-8 gap-y-1 px-4 py-5 text-center sm:flex-row">
          <span className="text-texto">
            {obras.length} cabezas escultóricas intervenidas por artistas locales
          </span>
          <strong className="text-azul-profundo">La plataforma no cobra ni procesa pagos</strong>
        </div>
      </div>
    </>
  );
}

async function Muestra() {
  const [estado, obras] = await Promise.all([estadoSubasta(), listarObras()]);
  return (
    <Carrusel etiqueta="Obras de la subasta">
      {obras.slice(0, 10).map((o, i) => (
        <div key={o.id} className="w-[78%] max-w-[18rem] shrink-0 snap-start sm:w-[18rem]">
          <TarjetaObra obra={o} fase={estado.fase} prioridad={i < 2} tamanos="288px" />
        </div>
      ))}
      <Link
        href="/obras"
        className="flex w-[60%] max-w-[14rem] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl bg-white p-6 text-center font-bold text-azul-profundo shadow-suave ring-1 ring-linea/70 hover:shadow-elevada sm:w-[14rem]"
      >
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-fondo text-3xl">
          →
        </span>
        Ver las {obras.length} obras
      </Link>
    </Carrusel>
  );
}

async function Propuesta() {
  const pagina = await obtenerPagina("portada");
  const { resto } = partir(pagina?.contenido ?? "");
  return (
    <section className="pt-14" aria-labelledby="titulo-propuesta">
      <div className="superficie-tarjeta grid gap-6 p-6 md:grid-cols-[1fr_1.4fr] md:p-10">
        <div>
          <TituloSeccion id="titulo-propuesta" antetitulo="La propuesta">
            Sobre la subasta
          </TituloSeccion>
          <p className="mt-5">
            <Link href="/destino" className="enlace">
              Destino de lo recaudado
            </Link>
          </p>
        </div>
        <div>{resto.trim() && <Markdown texto={resto} />}</div>
      </div>
    </section>
  );
}

function EsqueletoHero() {
  return <div className="h-[32rem] animate-pulse bg-azul-oscuro" aria-busy="true" />;
}
