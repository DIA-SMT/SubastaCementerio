import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { IconoFlecha } from "@/components/Iconos";
import { Markdown } from "@/components/Markdown";
import { Divisor, OrnamentoArco, OrnamentoOlivo, OrnamentoRoseton } from "@/components/Ornamentos";
import { PasosParticipar } from "@/components/PasosParticipar";
import { FranjaPlazo } from "@/components/Plazo";
import { TituloSeccion } from "@/components/TituloSeccion";
import { estadoSubasta, listarObras, obtenerPagina } from "@/lib/datos/publico";

/** Retraso de la animación de entrada (ver .entrada en globals.css). */
const retraso = (ms: number) => ({ "--retraso": `${ms}ms` }) as CSSProperties;

export default function Inicio() {
  return (
    // Sin velo general: cada sección decide cuánto deja ver la sala del fondo.
    <div className="pb-24 md:pb-32">
      <Suspense fallback={<EsqueletoHero />}>
        <Hero />
      </Suspense>

      <RecorridoSalas />

      <Suspense fallback={null}>
        <Iniciativa />
      </Suspense>

      <Ventana />

      <section
        id="como-funciona"
        className="relative overflow-hidden border-y border-white/50 bg-papel/[0.92] backdrop-blur-md"
        aria-labelledby="titulo-pasos"
      >
        <OrnamentoOlivo className="pointer-events-none absolute -top-8 -right-12 w-56 text-dorado-suave/40 md:w-80" />
        <div className="contenedor relative py-20 md:py-28">
          <div className="max-w-2xl lg:mx-auto lg:text-center">
            <TituloSeccion id="titulo-pasos" antetitulo="Sala 02 · Participar">
              Cómo funciona la subasta
            </TituloSeccion>
            <p className="mt-5 text-texto">
              No necesitás crear una contraseña. Te identificás con tu correo y un código de seis números.
            </p>
            <Divisor className="mt-8 h-4 w-48 text-oro/70 lg:mx-auto" />
          </div>
          <div className="mt-14 md:mt-16">
            <PasosParticipar />
          </div>
          <p className="mt-14 lg:text-center">
            <Link href="/como-participar" className="enlace-sutil group">
              Ver la guía completa
              <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </p>
        </div>
      </section>

      <Suspense fallback={<EsqueletoAccesoObras />}>
        <AccesoObras />
      </Suspense>
    </div>
  );
}

/** Hueco entre secciones: deja ver la sala del fondo, que queda quieta al desplazarse. */
function Ventana() {
  return <div aria-hidden className="h-[34svh] md:h-[46svh]" />;
}

function RecorridoSalas() {
  const salas = [
    { numero: "01", href: "#iniciativa", titulo: "La iniciativa" },
    { numero: "02", href: "#como-funciona", titulo: "Cómo participar" },
    { numero: "03", href: "#catalogo", titulo: "Las obras" },
  ];

  return (
    <nav aria-label="Recorrido por la portada" className="border-b border-white/50 bg-papel/[0.4] backdrop-blur-xl">
      <ol className="contenedor grid grid-cols-3 divide-x divide-linea">
        {salas.map((sala) => (
          <li key={sala.numero}>
            <Link
              href={sala.href}
              className="group flex min-h-20 flex-col justify-center gap-1 px-3 transition-colors duration-200 hover:bg-white/40 sm:min-h-24 sm:flex-row sm:items-center sm:justify-start sm:gap-4 sm:px-6"
            >
              <span className="font-serif text-[1.15rem] leading-none font-medium text-dorado tabular-nums">
                {sala.numero}
              </span>
              <span className="text-[0.74rem] leading-tight font-semibold text-tinta sm:text-[0.9rem]">
                {sala.titulo}
              </span>
              <IconoFlecha className="ml-auto hidden text-gris-suave transition-transform duration-200 group-hover:translate-x-0.5 md:block" />
            </Link>
          </li>
        ))}
      </ol>
    </nav>
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
  const [estado, pagina] = await Promise.all([estadoSubasta(), obtenerPagina("portada")]);
  const { bajada } = partir(pagina?.contenido ?? "");

  return (
    <>
      {/* Panel en azul noche a la izquierda; a la derecha, una arcada en oro enmarca la sala del
          fondo. En el celular, el arco queda de fondo dentro del panel. */}
      <section
        aria-labelledby="titulo-portada"
        className="relative lg:grid lg:min-h-[84svh] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
      >
        <div className="fondo-noche relative overflow-hidden">
          <div className="relative flex min-h-[78svh] flex-col justify-end px-4 pt-32 pb-14 sm:px-6 lg:min-h-0 lg:h-full lg:justify-center lg:py-24 lg:pr-16 lg:pl-[max(2.5rem,calc((100vw-75rem)/2+2.5rem))]">
            <div className="max-w-[38rem]">
              <p className="antetitulo entrada">Muestra y subasta solidaria</p>
              <span aria-hidden className="filete-oro entrada mt-5" style={retraso(40)} />
              <h1 id="titulo-portada" className="entrada mt-6 text-display" style={retraso(80)}>
                {pagina?.titulo ?? "Memorias del futuro"}
              </h1>
              {bajada && (
                <p className="entrada mt-6 max-w-[34rem] text-marfil/85" style={retraso(160)}>
                  {bajada}
                </p>
              )}
              <div className="entrada mt-9 flex flex-wrap items-center gap-4" style={retraso(260)}>
                <Link href="/obras" className="boton-oro group">
                  Explorar las obras
                  <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link href="#iniciativa" className="boton-noche-secundario">
                  Conocer la iniciativa
                </Link>
              </div>
              <p
                className="entrada mt-12 border-t border-oro/35 pt-5 text-[0.78rem] font-medium tracking-[0.12em] text-oro-claro uppercase"
                style={retraso(320)}
              >
                Cementerio del Oeste · San Miguel de Tucumán
              </p>
            </div>
          </div>
        </div>
        <div aria-hidden className="relative hidden items-end justify-center overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-linear-to-r from-noche/35 to-transparent to-40%" />
          <OrnamentoArco className="entrada-foto relative -mb-px h-[80%] max-h-[40rem] text-oro" />
        </div>
      </section>

      <FranjaPlazo estado={estado} />
    </>
  );
}

async function Iniciativa() {
  const pagina = await obtenerPagina("portada");
  if (!pagina) return null;
  const { resto } = partir(pagina.contenido);

  return (
    <section id="iniciativa" aria-labelledby="titulo-iniciativa" className="border-b border-white/50 bg-papel/[0.62] backdrop-blur-md">
      <div className="contenedor grid gap-x-12 gap-y-10 py-20 md:py-28 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <TituloSeccion id="titulo-iniciativa" antetitulo="Sala 01 · La iniciativa">
            Una muestra que une arte y memoria
          </TituloSeccion>
          <p className="mt-6 max-w-sm text-gris">
            Una invitación a mirar el patrimonio desde nuevas perspectivas y convertir esa experiencia en una acción
            solidaria.
          </p>
          <Divisor className="mt-8 h-4 w-40 text-oro/70" />
        </div>
        <div className="relative overflow-hidden rounded-lg bg-white/70 p-6 shadow-suave ring-1 ring-white/60 backdrop-blur-md md:p-9 lg:col-span-7 lg:col-start-6">
          <OrnamentoRoseton className="pointer-events-none absolute -top-16 -right-16 w-48 text-oro/15" />
          <div className="relative">
            {resto.trim() && <Markdown texto={resto} />}
            <ul className="mt-10 divide-y divide-linea border-y border-tinta">
              {[
                { href: "/destino", texto: "Destino de lo recaudado" },
                { href: "/bases-y-condiciones", texto: "Bases y condiciones" },
              ].map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    className="group flex min-h-16 items-center justify-between gap-4 font-medium text-tinta transition-colors duration-200 hover:text-azul"
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
      </div>
    </section>
  );
}

async function AccesoObras() {
  const obras = await listarObras();
  const cantidad = obras.length;
  const descripcion = cantidad
    ? `Recorré las ${cantidad} obras, conocé a sus artistas y seguí el estado de cada oferta.`
    : "La colección completa va a estar disponible en esta sección cuando las obras sean publicadas.";

  return (
    // Sin fondo propio alrededor: la tarjeta queda colgada sobre la sala, como un cuadro.
    <section id="catalogo" className="contenedor pt-[30svh] md:pt-[40svh]" aria-labelledby="titulo-acceso-obras">
      <Link
        href="/obras"
        className="fondo-noche group relative block overflow-hidden px-6 py-10 shadow-elevada sm:px-10 sm:py-12 md:px-14 md:py-16"
      >
        <OrnamentoArco className="pointer-events-none absolute -right-6 -bottom-20 hidden w-64 text-oro/25 md:block" />
        {/* Filete interior en oro, como el marco de los cuadros de la sala. */}
        <span
          aria-hidden
          className="absolute inset-3 border border-oro/45 transition-colors duration-300 group-hover:border-oro/90"
        />
        <span className="relative grid gap-10 md:grid-cols-12 md:items-end">
          <span className="md:col-span-7">
            <span className="block text-rotulo font-semibold text-oro-claro uppercase">Sala 03 · Colección completa</span>
            <h2 id="titulo-acceso-obras" className="mt-3 text-[clamp(2.6rem,1.8rem+2.8vw,4.6rem)] leading-none">
              Descubrí las obras
            </h2>
            <span className="mt-5 block max-w-xl text-marfil/80">{descripcion}</span>
          </span>
          <span className="flex items-center gap-4 font-semibold text-marfil md:col-span-4 md:col-start-9 md:justify-end">
            Abrir el catálogo
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-oro text-noche transition-[background-color,transform] duration-300 group-hover:translate-x-1 group-hover:bg-oro-claro">
              <IconoFlecha className="text-xl" />
            </span>
          </span>
        </span>
      </Link>
    </section>
  );
}

function EsqueletoHero() {
  const bloque = "animate-pulse rounded-md bg-white/10 motion-reduce:animate-none";
  return (
    <div aria-busy="true" aria-label="Cargando la portada">
      <div className="bg-noche lg:w-[58%]">
        <div className="contenedor flex min-h-[78svh] flex-col justify-end gap-5 pt-32 pb-14 lg:min-h-[84svh] lg:justify-center">
          <div className={`h-4 w-56 ${bloque}`} />
          <div className={`h-32 w-full max-w-xl ${bloque}`} />
          <div className={`h-16 w-full max-w-lg ${bloque}`} />
          <div className={`h-12 w-48 ${bloque}`} />
        </div>
      </div>
      <div className="h-36 border-y border-linea bg-papel/85" />
    </div>
  );
}

function EsqueletoAccesoObras() {
  return (
    <div className="contenedor pt-[30svh] md:pt-[40svh]">
      <div className="h-72 animate-pulse bg-noche/85 motion-reduce:animate-none" />
    </div>
  );
}
