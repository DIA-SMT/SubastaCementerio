import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { IconoCampana, IconoFlecha, IconoGrilla, IconoMartillo, IconoObra } from "@/components/Iconos";
import { Markdown } from "@/components/Markdown";
import { FranjaPlazo } from "@/components/Plazo";
import { TituloSeccion } from "@/components/TituloSeccion";
import { estadoSubasta, listarObras, obtenerPagina } from "@/lib/datos/publico";

const PASOS = [
  {
    titulo: "Explorá la colección",
    texto: "Entrá a Obras para recorrer el catálogo completo y conocer cada pieza en detalle.",
    Icono: IconoGrilla,
  },
  {
    titulo: "Elegí una obra",
    texto: "En su ficha encontrás las fotos, la historia, la oferta actual y el monto mínimo para superarla.",
    Icono: IconoObra,
  },
  {
    titulo: "Realizá tu oferta",
    texto: "Ingresá con tu correo y el código que te enviamos. Revisá el monto y confirmalo de forma segura.",
    Icono: IconoMartillo,
  },
  {
    titulo: "Seguí el resultado",
    texto: "Si alguien supera tu oferta, te avisamos por correo. También podés seguirla desde Mis ofertas.",
    Icono: IconoCampana,
  },
];

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

      <section id="como-funciona" className="border-y border-white/50 bg-papel/[0.62] backdrop-blur-md" aria-labelledby="titulo-pasos">
        <div className="contenedor grid gap-x-12 gap-y-12 py-20 md:py-28 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <TituloSeccion id="titulo-pasos" antetitulo="Sala 02 · Participar">
              Cómo funciona la subasta
            </TituloSeccion>
            <p className="mt-5 max-w-sm text-texto">
              No necesitás crear una contraseña. Te identificás con tu correo y un código de seis números.
            </p>
            <p className="mt-7">
              <Link href="/como-participar" className="enlace-sutil group">
                Ver la guía completa
                <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>

          <ol className="grid gap-x-8 border-t border-tinta sm:grid-cols-2 lg:col-span-8">
            {PASOS.map(({ titulo, texto, Icono }, i) => (
              <li
                key={titulo}
                className={`revelar border-b border-linea py-7 sm:py-8 ${i % 2 === 0 ? "sm:pr-6" : "sm:border-l sm:pl-6"}`}
              >
                <div className="flex items-center justify-between gap-5">
                  <span className="font-serif text-[1.35rem] leading-none font-medium text-dorado tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icono className="text-[1.55rem] text-gris-suave" />
                </div>
                <h3 className="mt-6 text-subtitulo">{titulo}</h3>
                <p className="mt-2 max-w-sm text-texto">{texto}</p>
              </li>
            ))}
          </ol>
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
      <section aria-labelledby="titulo-portada" className="relative">
        {/* Velo marfil: en el celular sube desde abajo (el texto va abajo); en computadora entra
            desde la izquierda y deja a la vista las arcadas de la derecha. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-b from-papel/10 via-papel/80 via-45% to-papel/95 lg:bg-linear-to-r lg:from-papel/95 lg:via-papel/80 lg:via-35% lg:to-papel/0 lg:to-72%"
        />
        <div className="contenedor relative flex min-h-[82svh] flex-col justify-end pt-48 pb-14 lg:justify-center lg:py-24">
          <div className="max-w-[38rem]">
            <p className="antetitulo entrada">Muestra y subasta solidaria</p>
            <span aria-hidden className="entrada mt-5 block h-px w-14 bg-dorado-suave" style={retraso(40)} />
            <h1 id="titulo-portada" className="entrada mt-6 text-display" style={retraso(80)}>
              {pagina?.titulo ?? "Memorias del futuro"}
            </h1>
            {bajada && (
              <p className="entrada mt-6 max-w-[34rem] text-texto" style={retraso(160)}>
                {bajada}
              </p>
            )}
            <div className="entrada mt-9 flex flex-wrap items-center gap-x-8 gap-y-5" style={retraso(260)}>
              <Link href="/obras" className="boton-primario group">
                Explorar las obras
                <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="#iniciativa" className="enlace-sutil">
                Conocer la iniciativa
              </Link>
            </div>
            <p
              className="entrada mt-12 border-t border-dorado-suave/50 pt-5 text-[0.78rem] font-medium tracking-[0.12em] text-gris uppercase"
              style={retraso(320)}
            >
              Cementerio del Oeste · San Miguel de Tucumán
            </p>
          </div>
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
        </div>
        <div className="rounded-lg bg-white/60 p-6 shadow-suave ring-1 ring-white/60 backdrop-blur-md md:p-9 lg:col-span-7 lg:col-start-6">
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
    // Sin fondo propio: la tarjeta queda colgada sobre la sala, como un cuadro.
    <section id="catalogo" className="contenedor pt-[30svh] md:pt-[40svh]" aria-labelledby="titulo-acceso-obras">
      <Link
        href="/obras"
        className="group relative block bg-pizarra/[0.93] px-6 py-10 text-white shadow-elevada backdrop-blur-sm sm:px-10 sm:py-12 md:px-14 md:py-16"
      >
        {/* Filete interior dorado, como el marco de los cuadros de la sala. */}
        <span
          aria-hidden
          className="absolute inset-3 border border-dorado-suave/45 transition-colors duration-300 group-hover:border-dorado-suave/80"
        />
        <span className="relative grid gap-10 md:grid-cols-12 md:items-end">
          <span className="md:col-span-7">
            <span className="block text-rotulo font-semibold text-[#d9c08f] uppercase">Sala 03 · Colección completa</span>
            <h2 id="titulo-acceso-obras" className="mt-3 text-[clamp(2.6rem,1.8rem+2.8vw,4.6rem)] leading-none text-white">
              Descubrí las obras
            </h2>
            <span className="mt-5 block max-w-xl text-white/80">{descripcion}</span>
          </span>
          <span className="flex items-center gap-4 font-semibold md:col-span-4 md:col-start-9 md:justify-end">
            Abrir el catálogo
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 transition-[background-color,color,transform] duration-300 group-hover:translate-x-1 group-hover:bg-white group-hover:text-pizarra">
              <IconoFlecha className="text-xl" />
            </span>
          </span>
        </span>
      </Link>
    </section>
  );
}

function EsqueletoHero() {
  return (
    <div aria-busy="true" aria-label="Cargando la portada">
      <div className="bg-linear-to-r from-papel/95 via-papel/80 to-papel/0">
        <div className="contenedor flex min-h-[82svh] flex-col justify-end gap-5 pt-48 pb-14 lg:justify-center">
          <div className="esqueleto h-4 w-56" />
          <div className="esqueleto h-32 w-full max-w-xl" />
          <div className="esqueleto h-16 w-full max-w-lg" />
          <div className="esqueleto h-12 w-48" />
        </div>
      </div>
      <div className="h-36 border-y border-linea bg-papel/85" />
    </div>
  );
}

function EsqueletoAccesoObras() {
  return (
    <div className="contenedor pt-[30svh] md:pt-[40svh]">
      <div className="h-72 animate-pulse bg-pizarra/80 motion-reduce:animate-none" />
    </div>
  );
}
