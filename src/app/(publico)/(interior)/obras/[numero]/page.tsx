import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Recuadro } from "@/components/Avisos";
import { EstadoChip } from "@/components/EstadoChip";
import { FotoObra, urlFoto } from "@/components/FotoObra";
import { Galeria } from "@/components/Galeria";
import { IconoAnterior, IconoFlecha } from "@/components/Iconos";
import { PlazoCompacto, textoPresencial } from "@/components/Plazo";
import { RefrescoPeriodico } from "@/components/RefrescoPeriodico";
import { usuarioActual } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { estadoSubasta, historialDeObra, obtenerObra } from "@/lib/datos/publico";
import type { EstadoSubasta, ObraDetalle, OfertaPublica } from "@/lib/datos/tipos";
import { haceCuanto, medidasTexto, pesos, tituloObra } from "@/lib/formato";
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
    <div className="contenedor pt-4 md:pt-8">
      <p>
        <Link href="/obras" className="group inline-flex min-h-11 items-center gap-2 text-[0.9rem] font-medium text-gris transition-colors duration-200 hover:text-tinta">
          <IconoAnterior className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          Todas las obras
        </Link>
      </p>
      <Suspense fallback={<EsqueletoFicha />}>
        <Ficha params={params} />
      </Suspense>
    </div>
  );
}

/** Sección de la ficha con filete superior y rótulo, como en un catálogo impreso. */
function Apartado({ id, titulo, extra, children }: { id: string; titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 border-t border-tinta pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="font-sans text-rotulo font-semibold tracking-[0.14em] text-tinta uppercase">
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
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
  const puedeOfertar = obra.fase === "abierta" && !obra.ofertaActualEsMia;
  const titulo = tituloObra(obra.titulo);
  const medidas = medidasTexto(obra.medidas);

  return (
    <article className="mt-4 md:mt-6">
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-12 xl:gap-x-16">
        <div className="-mx-4 sm:mx-0 lg:sticky lg:top-24 lg:col-span-7 lg:self-start">
          <Galeria fotos={obra.fotos} titulo={titulo} />
        </div>

        <div className="lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="antetitulo">Obra N° {obra.numero}</p>
            <EstadoChip fase={obra.fase} texto={obra.fase === "abierta" && obra.cierre > estado.cierre ? "Tiempo extra" : undefined} />
          </div>
          <span aria-hidden className="filete mt-4" />
          <h1 className={`mt-4 text-titulo ${obra.titulo ? "" : "italic"}`}>{titulo}</h1>
          <p className="mt-3 text-lg text-texto">
            de <span className="font-semibold text-tinta">{obra.artistaNombre}</span>
          </p>
          {(obra.tecnica || medidas) && (
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-linea pt-4 text-[0.94rem]">
              {obra.tecnica && (
                <>
                  <dt className="text-gris">Técnica y materiales</dt>
                  <dd className="text-tinta">{obra.tecnica}</dd>
                </>
              )}
              {medidas && (
                <>
                  <dt className="text-gris">Medidas</dt>
                  <dd className="text-tinta tabular-nums">
                    {medidas}
                    <span className="sr-only"> (alto por ancho{obra.medidas.profundidad != null && " por profundidad"})</span>
                  </dd>
                </>
              )}
            </dl>
          )}

          <PanelOferta obra={obra} estado={estado} avisos={perfil?.avisosPorCorreo ?? true} />

          <Apartado id="titulo-obra" titulo="Memoria conceptual">
            <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-texto">
              {obra.resena || "Memoria conceptual pendiente."}
            </p>
          </Apartado>

          <Apartado id="titulo-artista" titulo="Artista">
            <div className="mt-5 flex items-start gap-5">
              {obra.artistaFotoRuta && (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-piedra">
                  <FotoObra
                    foto={{ ruta: obra.artistaFotoRuta, alt: `Foto de ${obra.artistaNombre}`, ancho: null, alto: null }}
                    tamanos="80px"
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-display text-subtitulo font-semibold text-tinta">{obra.artistaNombre}</p>
                {obra.artistaResena && <p className="mt-2 whitespace-pre-line text-texto">{obra.artistaResena}</p>}
                {obra.artistaInstagram && (
                  <p className="mt-3">
                    <a
                      href={`https://www.instagram.com/${obra.artistaInstagram}/`}
                      className="enlace"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      @{obra.artistaInstagram}
                      <span className="sr-only"> en Instagram (se abre en otra pestaña)</span>
                    </a>
                  </p>
                )}
                {obra.artistaEnlace && /^https?:\/\//.test(obra.artistaEnlace) && (
                  <p className="mt-3">
                    <a href={obra.artistaEnlace} className="enlace" rel="noopener noreferrer" target="_blank">
                      Ver más sobre {obra.artistaNombre} (se abre en otra pestaña)
                    </a>
                  </p>
                )}
              </div>
            </div>
          </Apartado>

          <Apartado
            id="titulo-historial"
            titulo="Historial de ofertas"
            extra={
              historial.length > 0 && (
                <span className="text-[0.85rem] text-gris">
                  {historial.length} {historial.length === 1 ? "oferta" : "ofertas"}
                </span>
              )
            }
          >
            <Historial ofertas={historial} ahora={estado.ahora} />
          </Apartado>
        </div>
      </div>

      {/* En el celular, la oferta actual y el botón quedan siempre a mano. */}
      {puedeOfertar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-white/95 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-20px_rgb(23_25_28/0.35)] backdrop-blur-md md:hidden">
          <div className="contenedor flex items-center justify-between gap-4">
            <div>
              <p className="rotulo">{obra.ofertaActual != null ? "Oferta actual" : "Desde"}</p>
              <p className="font-display text-[1.45rem] leading-tight font-semibold tracking-[-0.02em] text-tinta tabular-nums">
                {pesos(obra.ofertaActual ?? obra.precioSalida)}
              </p>
            </div>
            <Link href={`/obras/${obra.numero}/ofertar`} className="boton-primario px-7">
              Ofertar
            </Link>
          </div>
        </div>
      )}

      {obra.fase === "abierta" && <RefrescoPeriodico segundos={obra.cierre > estado.cierre ? 10 : 20} />}
    </article>
  );
}

const MONTO_DESTACADO =
  "mt-2 font-display text-[clamp(2.1rem,1.7rem+1vw,2.7rem)] leading-none font-semibold tracking-[-0.03em] text-tinta tabular-nums";

function PanelOferta({ obra, estado, avisos }: { obra: ObraDetalle; estado: EstadoSubasta; avisos: boolean }) {
  // La fase es la de la obra: con la extensión, cada obra puede cerrar a una hora distinta.
  if (obra.fase === "cerrada") {
    return (
      <section aria-label="Resultado de la subasta virtual" className="superficie-tarjeta mt-8 p-6 md:p-7">
        <p className="rotulo">Subasta virtual finalizada</p>
        {obra.ofertaActual != null ? (
          <>
            <p className="mt-4 text-texto">Pasa a subasta presencial con base de</p>
            <p className={MONTO_DESTACADO}>{pesos(obra.ofertaActual)}</p>
          </>
        ) : (
          <p className="mt-4 text-lg text-tinta">No recibió ofertas en la etapa virtual. Pasa a la subasta presencial.</p>
        )}
        <p className="mt-5 border-t border-linea pt-4 text-texto">{textoPresencial(estado)}</p>
      </section>
    );
  }

  const puedeOfertar = obra.fase === "abierta";
  return (
    <section aria-label="Oferta" className="superficie-tarjeta mt-8 overflow-hidden">
      <div className="p-6 md:p-7">
        {obra.ofertaActual != null ? (
          <>
            <p className="rotulo">Oferta actual</p>
            <p className={MONTO_DESTACADO}>{pesos(obra.ofertaActual)}</p>
            <p className="mt-3 text-[0.9rem] text-gris">
              {obra.ofertaActualEsMia ? "Tu oferta" : `Oferente ${obra.ofertaActualAlias}`}
              {obra.ofertaActualAt && ` · ${haceCuanto(obra.ofertaActualAt, estado.ahora)}`}
              {` · ${obra.cantidadOfertas} ${obra.cantidadOfertas === 1 ? "oferta" : "ofertas"}`}
            </p>
          </>
        ) : (
          <>
            <p className="rotulo">Todavía no hay ofertas</p>
            <p className={MONTO_DESTACADO}>Desde {pesos(obra.precioSalida)}</p>
          </>
        )}

        {puedeOfertar && (
          <div className="mt-6 border-t border-linea pt-6">
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
                <p className="flex items-baseline justify-between gap-4">
                  <span className="text-texto">Oferta mínima</span>
                  <strong className="font-display text-xl font-semibold tracking-[-0.02em] text-tinta tabular-nums">
                    {pesos(obra.minimoSiguiente)}
                  </strong>
                </p>
                <Link href={`/obras/${obra.numero}/ofertar`} className="boton-primario group mt-5 w-full">
                  Realizar oferta
                  <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <p className="mt-3 text-center text-[0.85rem] text-gris">Antes de registrarla, vas a confirmar el monto.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-linea bg-papel px-6 py-5 md:px-7">
        <PlazoCompacto estado={estado} obra={obra} />
      </div>
    </section>
  );
}

function Historial({ ofertas, ahora }: { ofertas: OfertaPublica[]; ahora: Date }) {
  if (ofertas.length === 0) {
    return <p className="mt-4 text-texto">Todavía no hay ofertas para esta obra.</p>;
  }
  return (
    <ol className="mt-2 divide-y divide-linea">
      {ofertas.map((o, i) => (
        <li key={o.id} className="flex items-center justify-between gap-4 py-3.5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 font-medium text-tinta">
              {o.esPropia ? "Vos" : `Oferente ${o.alias}`}
              {i === 0 && (
                <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-tinta">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-verde" />
                  Más alta
                </span>
              )}
            </p>
            <p className="text-[0.85rem] text-gris">{haceCuanto(o.creadaAt, ahora)}</p>
          </div>
          <span
            className={`font-display tracking-[-0.02em] tabular-nums ${
              i === 0 ? "text-lg font-semibold text-tinta" : "font-medium text-texto"
            }`}
          >
            {pesos(o.monto)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function EsqueletoFicha() {
  return (
    <div className="mt-4 grid gap-x-12 gap-y-8 md:mt-6 lg:grid-cols-12" aria-busy="true" aria-label="Cargando la obra">
      <div className="esqueleto aspect-[4/5] rounded-sm lg:col-span-7 lg:aspect-auto lg:h-[min(calc(100svh-13rem),50rem)]" />
      <div className="space-y-4 lg:col-span-5">
        <div className="esqueleto h-4 w-28" />
        <div className="esqueleto h-14 w-3/4" />
        <div className="esqueleto h-6 w-1/2" />
        <div className="esqueleto mt-8 h-80 rounded-lg" />
      </div>
    </div>
  );
}
