import Link from "next/link";
import { Suspense } from "react";
import { FotoObra } from "@/components/FotoObra";
import { Markdown } from "@/components/Markdown";
import { Plazo } from "@/components/Plazo";
import { TituloSeccion } from "@/components/TituloSeccion";
import { estadoSubasta, listarObras, obtenerPagina } from "@/lib/datos/publico";

const PASOS = [
  { titulo: "Elegí una obra", texto: "Recorré el catálogo o escaneá el código QR que está junto a cada obra." },
  { titulo: "Ingresá con tu correo", texto: "Te mandamos un código de 6 números. La primera vez te pedimos tus datos." },
  { titulo: "Ofertá", texto: "Escribí cuánto ofrecés, revisalo y confirmalo. Si te superan, te avisamos." },
];

export default function Inicio() {
  return (
    <>
      <section className="bg-fondo">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
          <Suspense fallback={<EsqueletoPresentacion />}>
            <Presentacion />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10" aria-labelledby="titulo-obras">
        <TituloSeccion id="titulo-obras">Algunas de las obras</TituloSeccion>
        <Suspense fallback={<div className="mt-5 h-64 animate-pulse rounded-2xl bg-linea" />}>
          <Muestra />
        </Suspense>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="titulo-pasos">
        <TituloSeccion id="titulo-pasos">Cómo participar</TituloSeccion>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="rounded-2xl border border-linea bg-white p-5">
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-full bg-azul text-xl font-extrabold text-white"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 text-xl">{p.titulo}</h3>
              <p className="mt-1">{p.texto}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5">
          <Link href="/como-participar" className="enlace">
            Leer la explicación completa
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="titulo-destino">
        <TituloSeccion id="titulo-destino">Destino de lo recaudado</TituloSeccion>
        {/* El destino de los fondos está pendiente: se informa solo en la página editable /destino. */}
        <p className="mt-4 text-lg">
          <Link href="/destino" className="enlace">
            Ver la información sobre el destino de lo recaudado
          </Link>
        </p>
        <p className="mt-2 text-gris">La plataforma no cobra ni procesa pagos.</p>
      </section>
    </>
  );
}

async function Presentacion() {
  const [estado, pagina, obras] = await Promise.all([
    estadoSubasta(),
    obtenerPagina("portada"),
    listarObras(),
  ]);
  return (
    <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-start">
      <div>
        {pagina?.provisorio && (
          <p className="mb-3 inline-block rounded-full bg-ambar-suave px-3 py-1 text-base font-bold text-tinta">
            Texto provisorio
          </p>
        )}
        <h1 className="text-3xl md:text-5xl">{pagina?.titulo}</h1>
        <div className="mt-4">
          <Markdown texto={pagina?.contenido ?? ""} />
        </div>
      </div>
      <div className="rounded-2xl border border-linea bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl">Etapa virtual</h2>
        <div className="mt-2">
          <Plazo estado={estado} />
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <Link href="/obras" className="boton-primario">
            Ver las {obras.length} obras
          </Link>
          <Link href="/como-participar" className="boton-secundario">
            Cómo participar
          </Link>
        </div>
      </div>
    </div>
  );
}

async function Muestra() {
  const obras = (await listarObras()).slice(0, 6);
  return (
    <>
      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {obras.map((o, i) => (
          <li key={o.id}>
            <Link
              href={`/obras/${o.numero}`}
              className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-linea"
            >
              <FotoObra foto={o.portada} tamanos="(min-width: 768px) 33vw, 50vw" prioridad={i < 2} />
              <span className="absolute inset-x-0 bottom-0 bg-tinta/80 px-3 py-2 font-bold text-white">
                N° {o.numero} · {o.artistaNombre}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5">
        <Link href="/obras" className="boton-secundario w-full md:w-auto">
          Ver todas las obras
        </Link>
      </p>
    </>
  );
}

function EsqueletoPresentacion() {
  return (
    <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]" aria-busy="true">
      <div className="space-y-3">
        <div className="h-12 w-3/4 animate-pulse rounded-lg bg-linea" />
        <div className="h-24 animate-pulse rounded-lg bg-linea" />
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-linea" />
    </div>
  );
}
