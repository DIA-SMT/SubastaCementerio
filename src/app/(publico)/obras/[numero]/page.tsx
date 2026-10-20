import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Recuadro } from "@/components/Avisos";
import { EstadoChip } from "@/components/EstadoChip";
import { FotoObra, urlFoto } from "@/components/FotoObra";
import { Galeria } from "@/components/Galeria";
import { PlazoDestacado, textoPresencial } from "@/components/Plazo";
import { RefrescoPeriodico } from "@/components/RefrescoPeriodico";
import { TituloSeccion } from "@/components/TituloSeccion";
import { usuarioActual } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { estadoSubasta, historialDeObra, obtenerObra } from "@/lib/datos/publico";
import type { EstadoSubasta, ObraDetalle, OfertaPublica } from "@/lib/datos/tipos";
import { haceCuanto, pesos, tituloObra } from "@/lib/formato";
import { numeroDeObra } from "@/lib/validacion";

export async function generateMetadata({ params }: PageProps<"/obras/[numero]">): Promise<Metadata> {
  const numero = numeroDeObra((await params).numero);
  const obra = numero ? await obtenerObra(numero) : null;
  if (!obra) return { title: "Obra no encontrada" };
  const titulo = `Obra N° ${obra.numero}: ${tituloObra(obra.titulo)}, de ${obra.artistaNombre}`;
  const portada = obra.portada && !obra.portada.ruta.endsWith(".svg") ? urlFoto(obra.portada.ruta) : undefined;
  return {
    title: titulo,
    description: `Ofertá por esta obra en la subasta solidaria del Cementerio del Oeste.`,
    openGraph: { title: titulo, images: portada ? [portada] : undefined },
  };
}

export default function PaginaObra({ params }: PageProps<"/obras/[numero]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:pb-0">
      <p>
        <Link href="/obras" className="enlace">
          ← Todas las obras
        </Link>
      </p>
      <Suspense fallback={<EsqueletoFicha />}>
        <Ficha params={params} />
      </Suspense>
    </div>
  );
}

async function Ficha({ params }: Pick<PageProps<"/obras/[numero]">, "params">) {
  const numero = numeroDeObra((await params).numero);
  if (!numero) notFound();
  const usuario = await usuarioActual();
  const [estado, obra] = await Promise.all([estadoSubasta(), obtenerObra(numero, usuario?.id)]);
  if (!obra) notFound();
  // El perfil solo hace falta para decir si le avisamos por correo a quien tiene la oferta más alta.
  const [historial, perfil] = await Promise.all([
    historialDeObra(obra.id, usuario?.id),
    usuario && obra.ofertaActualEsMia ? miPerfil(usuario.id) : null,
  ]);
  const puedeOfertar = estado.fase === "abierta" && !obra.ofertaActualEsMia;

  return (
    <article className="mt-5">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <Galeria fotos={obra.fotos} />

        <div className="lg:sticky lg:top-28">
          <div className="flex flex-wrap items-center gap-3">
            <span className="antetitulo">Obra N° {obra.numero}</span>
            <EstadoChip fase={estado.fase} />
          </div>
          <h1 className={`mt-2 text-4xl md:text-5xl ${obra.titulo ? "" : "italic"}`}>{tituloObra(obra.titulo)}</h1>
          <p className="mt-2 text-xl text-texto">
            de <span className="font-extrabold text-tinta">{obra.artistaNombre}</span>
          </p>

          <PanelOferta obra={obra} estado={estado} avisos={perfil?.avisosPorCorreo ?? true} />
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="superficie-tarjeta p-6 md:p-8" aria-labelledby="titulo-obra">
          <TituloSeccion id="titulo-obra" antetitulo="La obra">
            Sobre la obra
          </TituloSeccion>
          <p className="mt-4 text-lg whitespace-pre-line">{obra.resena || "Reseña pendiente."}</p>
          {obra.tecnica && (
            <p className="mt-4 rounded-2xl bg-superficie px-4 py-3">
              <span className="font-bold text-tinta">Técnica:</span> {obra.tecnica}
            </p>
          )}
        </section>

        <section className="superficie-tarjeta p-6 md:p-8" aria-labelledby="titulo-artista">
          <TituloSeccion id="titulo-artista" antetitulo="Artista">
            {obra.artistaNombre}
          </TituloSeccion>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            {obra.artistaFotoRuta && (
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-linea ring-4 ring-fondo">
                <FotoObra
                  foto={{ ruta: obra.artistaFotoRuta, alt: `Foto de ${obra.artistaNombre}`, ancho: null, alto: null }}
                  tamanos="112px"
                />
              </div>
            )}
            <p className="text-lg whitespace-pre-line">{obra.artistaResena || "Reseña pendiente."}</p>
          </div>
          {obra.artistaEnlace && /^https?:\/\//.test(obra.artistaEnlace) && (
            <p className="mt-4">
              <a href={obra.artistaEnlace} className="enlace" rel="noopener noreferrer" target="_blank">
                Ver más sobre {obra.artistaNombre} (se abre en otra pestaña)
              </a>
            </p>
          )}
        </section>
      </div>

      <section className="superficie-tarjeta mt-6 p-6 md:p-8" aria-labelledby="titulo-historial">
        <TituloSeccion id="titulo-historial" antetitulo="Ofertas">
          Historial de ofertas
        </TituloSeccion>
        <Historial ofertas={historial} ahora={estado.ahora} />
      </section>

      {/* En el celular, la oferta actual y el botón quedan siempre a mano. */}
      {puedeOfertar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(12_28_46/0.12)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-texto">{obra.ofertaActual != null ? "Oferta más alta" : "Desde"}</p>
              <p className="text-2xl leading-tight font-extrabold text-tinta tabular-nums">
                {pesos(obra.ofertaActual ?? obra.precioSalida)}
              </p>
            </div>
            <Link href={`/obras/${obra.numero}/ofertar`} className="boton-primario px-8">
              Ofertá
            </Link>
          </div>
        </div>
      )}

      {estado.fase === "abierta" && <RefrescoPeriodico segundos={20} />}
    </article>
  );
}

function PanelOferta({ obra, estado, avisos }: { obra: ObraDetalle; estado: EstadoSubasta; avisos: boolean }) {
  if (estado.fase === "cerrada") {
    return (
      <div className="fondo-institucional mt-6 rounded-3xl p-6 text-white shadow-elevada">
        {obra.ofertaActual != null ? (
          <>
            <p className="text-lg font-bold text-white">Pasa a subasta presencial con base de</p>
            <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{pesos(obra.ofertaActual)}</p>
          </>
        ) : (
          <p className="text-xl font-bold text-white">No recibió ofertas en la etapa virtual. Pasa a la subasta presencial.</p>
        )}
        <p className="mt-3 text-lg text-white">{textoPresencial(estado)}</p>
      </div>
    );
  }

  const puedeOfertar = estado.fase === "abierta";
  return (
    <div className="superficie-tarjeta mt-6 overflow-hidden">
      <div className="p-6">
        {obra.ofertaActual != null ? (
          <>
            <p className="font-bold text-texto">Oferta más alta</p>
            <p className="mt-1 text-5xl leading-none font-extrabold text-tinta tabular-nums">{pesos(obra.ofertaActual)}</p>
            <p className="mt-2 text-texto">
              {obra.ofertaActualEsMia ? "Tu oferta" : `Oferente ${obra.ofertaActualAlias}`}
              {obra.ofertaActualAt && ` · ${haceCuanto(obra.ofertaActualAt, estado.ahora)}`}
              {` · ${obra.cantidadOfertas} ${obra.cantidadOfertas === 1 ? "oferta" : "ofertas"}`}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-texto">Todavía no hay ofertas</p>
            <p className="mt-1 text-4xl leading-none font-extrabold text-tinta tabular-nums">Desde {pesos(obra.precioSalida)}</p>
          </>
        )}

        {puedeOfertar && (
          <div className="mt-6">
            {obra.ofertaActualEsMia ? (
              <Recuadro tono="exito" titulo="Tenés la oferta más alta">
                {avisos ? (
                  "Si alguien la supera, te avisamos por correo."
                ) : (
                  <>
                    Tenés los avisos por correo desactivados; podés activarlos en{" "}
                    <Link href="/mis-ofertas" className="enlace">
                      Mis ofertas
                    </Link>
                    .
                  </>
                )}
              </Recuadro>
            ) : (
              <>
                <p className="text-lg">
                  Para ofertar, el mínimo es <strong className="text-tinta">{pesos(obra.minimoSiguiente)}</strong>.
                </p>
                <Link href={`/obras/${obra.numero}/ofertar`} className="boton-primario mt-3 w-full text-xl">
                  Ofertá
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-linea bg-superficie/60 p-6">
        <PlazoDestacado estado={estado} />
      </div>
    </div>
  );
}

function Historial({ ofertas, ahora }: { ofertas: OfertaPublica[]; ahora: Date }) {
  if (ofertas.length === 0) {
    return <p className="mt-4 text-lg">Todavía no hay ofertas para esta obra.</p>;
  }
  return (
    <ol className="mt-5 divide-y divide-linea">
      {ofertas.map((o, i) => (
        <li key={o.id} className="flex items-center gap-4 py-3">
          <span
            aria-hidden
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
              i === 0 ? "bg-azul text-white" : "bg-fondo text-azul-profundo"
            }`}
          >
            {o.esPropia ? "Vos" : o.alias}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-tinta">
              {o.esPropia ? "Vos" : `Oferente ${o.alias}`}
              {i === 0 && <span className="ml-2 rounded-full bg-verde-suave px-2 py-0.5 text-sm text-tinta">Más alta</span>}
            </p>
            <p className="text-base text-texto">{haceCuanto(o.creadaAt, ahora)}</p>
          </div>
          <span className="text-xl font-extrabold text-tinta tabular-nums">{pesos(o.monto)}</span>
        </li>
      ))}
    </ol>
  );
}

function EsqueletoFicha() {
  return (
    <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_1fr]" aria-busy="true" aria-label="Cargando la obra">
      <div className="aspect-[4/5] animate-pulse rounded-3xl bg-linea" />
      <div className="space-y-4">
        <div className="h-12 w-2/3 animate-pulse rounded-xl bg-linea" />
        <div className="h-72 animate-pulse rounded-3xl bg-linea" />
      </div>
    </div>
  );
}
