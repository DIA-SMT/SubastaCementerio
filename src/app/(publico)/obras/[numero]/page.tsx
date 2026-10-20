import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Recuadro } from "@/components/Avisos";
import { EstadoChip } from "@/components/EstadoChip";
import { FotoObra, urlFoto } from "@/components/FotoObra";
import { Galeria } from "@/components/Galeria";
import { Plazo, textoPresencial } from "@/components/Plazo";
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
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
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

  return (
    <article className="mt-4">
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <Galeria fotos={obra.fotos} />

        <div>
          <p className="text-lg font-bold text-gris">Obra N° {obra.numero}</p>
          <h1 className={`mt-1 text-3xl md:text-4xl ${obra.titulo ? "" : "italic"}`}>{tituloObra(obra.titulo)}</h1>
          <p className="mt-1 text-xl">
            de <span className="font-bold text-tinta">{obra.artistaNombre}</span>
          </p>
          <div className="mt-4">
            <EstadoChip fase={estado.fase} />
          </div>

          <PanelOferta obra={obra} estado={estado} avisos={perfil?.avisosPorCorreo ?? true} />
        </div>
      </div>

      <section className="mt-10" aria-labelledby="titulo-historial">
        <TituloSeccion id="titulo-historial">Historial de ofertas</TituloSeccion>
        <Historial ofertas={historial} ahora={estado.ahora} />
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="titulo-obra">
        <TituloSeccion id="titulo-obra">Sobre la obra</TituloSeccion>
        <p className="mt-4 text-lg whitespace-pre-line">{obra.resena || "Reseña pendiente."}</p>
        {obra.tecnica && (
          <p className="mt-3">
            <span className="font-bold text-tinta">Técnica:</span> {obra.tecnica}
          </p>
        )}
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="titulo-artista">
        <TituloSeccion id="titulo-artista">Sobre {obra.artistaNombre}</TituloSeccion>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {obra.artistaFotoRuta && (
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full bg-linea">
              <FotoObra
                foto={{ ruta: obra.artistaFotoRuta, alt: `Foto de ${obra.artistaNombre}`, ancho: null, alto: null }}
                tamanos="128px"
              />
            </div>
          )}
          <p className="text-lg whitespace-pre-line">{obra.artistaResena || "Reseña pendiente."}</p>
        </div>
        {obra.artistaEnlace && /^https?:\/\//.test(obra.artistaEnlace) && (
          <p className="mt-3">
            <a href={obra.artistaEnlace} className="enlace" rel="noopener noreferrer" target="_blank">
              Ver más sobre {obra.artistaNombre} (se abre en otra pestaña)
            </a>
          </p>
        )}
      </section>

      {estado.fase === "abierta" && <RefrescoPeriodico segundos={20} />}
    </article>
  );
}

function PanelOferta({ obra, estado, avisos }: { obra: ObraDetalle; estado: EstadoSubasta; avisos: boolean }) {
  if (estado.fase === "cerrada") {
    return (
      <div className="mt-6 rounded-2xl border-2 border-azul bg-fondo p-5">
        {obra.ofertaActual != null ? (
          <>
            <p className="text-lg text-tinta">Pasa a subasta presencial con base de</p>
            <p className="text-4xl font-extrabold text-tinta">{pesos(obra.ofertaActual)}</p>
          </>
        ) : (
          <p className="text-lg font-bold text-tinta">
            No recibió ofertas en la etapa virtual. Pasa a la subasta presencial.
          </p>
        )}
        <p className="mt-3">{textoPresencial(estado)}</p>
      </div>
    );
  }

  const puedeOfertar = estado.fase === "abierta";
  return (
    <div className="mt-6 rounded-2xl border border-linea bg-white p-5 shadow-sm">
      {obra.ofertaActual != null ? (
        <>
          <p className="text-lg text-gris">Oferta más alta</p>
          <p className="text-4xl font-extrabold text-tinta">{pesos(obra.ofertaActual)}</p>
          <p className="mt-1 text-gris">
            {obra.ofertaActualEsMia ? "Tu oferta" : `Oferente ${obra.ofertaActualAlias}`}
            {obra.ofertaActualAt && ` · ${haceCuanto(obra.ofertaActualAt, estado.ahora)}`}
            {` · ${obra.cantidadOfertas} ${obra.cantidadOfertas === 1 ? "oferta" : "ofertas"}`}
          </p>
        </>
      ) : (
        <>
          <p className="text-lg text-gris">Todavía no hay ofertas</p>
          <p className="text-3xl font-extrabold text-tinta">Desde {pesos(obra.precioSalida)}</p>
        </>
      )}

      {puedeOfertar && (
        <div className="mt-5">
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

      <div className="mt-5 border-t border-linea pt-4">
        <Plazo estado={estado} />
      </div>
    </div>
  );
}

function Historial({ ofertas, ahora }: { ofertas: OfertaPublica[]; ahora: Date }) {
  if (ofertas.length === 0) {
    return <p className="mt-4 text-lg">Todavía no hay ofertas para esta obra.</p>;
  }
  return (
    <ol className="mt-4 divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
      {ofertas.map((o, i) => (
        <li
          key={o.id}
          className={`grid grid-cols-[1fr_auto] items-baseline gap-x-3 px-4 py-3 sm:grid-cols-[12rem_1fr_auto] ${i === 0 ? "bg-fondo" : ""}`}
        >
          <span className="font-bold text-tinta">{o.esPropia ? "Vos" : `Oferente ${o.alias}`}</span>
          <span className="text-right text-xl font-bold text-tinta sm:text-left">{pesos(o.monto)}</span>
          <span className="col-span-2 text-base text-texto sm:col-span-1">{haceCuanto(o.creadaAt, ahora)}</span>
        </li>
      ))}
    </ol>
  );
}

function EsqueletoFicha() {
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2" aria-busy="true" aria-label="Cargando la obra">
      <div className="aspect-[4/5] animate-pulse rounded-2xl bg-linea" />
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-linea" />
        <div className="h-48 animate-pulse rounded-2xl bg-linea" />
      </div>
    </div>
  );
}
