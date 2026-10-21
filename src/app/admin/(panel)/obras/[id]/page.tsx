import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FotoObra, urlFoto } from "@/components/FotoObra";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Esqueleto, Etiqueta, MensajeAccion, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { SubirFoto } from "@/components/admin/SubirFoto";
import { requerirAdmin } from "@/lib/admin/sesion";
import { opcionesDeArtistas } from "@/lib/datos/admin/artistas";
import {
  listarFotosObra,
  obtenerObraAdmin,
  precioSalidaGeneral,
  type FotoEnPanel,
  type ObraEnEdicion,
} from "@/lib/datos/admin/obras";
import { pesos, tituloObra } from "@/lib/formato";
import { borrarFotoAccion, borrarObraAccion, moverFotoAccion, subirFotoObraAccion } from "../acciones";
import { FormularioBorrar } from "../FormularioBorrar";
import { FormularioObra } from "../FormularioObra";
import { TextoAlternativo } from "./TextoAlternativo";

export const metadata: Metadata = { title: "Editar obra" };

export default function PaginaEditarObra(props: PageProps<"/admin/obras/[id]">) {
  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/obras" className="enlace">
          ← Volver a las obras
        </Link>
      </p>
      <Suspense fallback={<Esqueleto />}>
        <Contenido params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params, searchParams }: Pick<PageProps<"/admin/obras/[id]">, "params" | "searchParams">) {
  const admin = await requerirAdmin();
  const { id } = await params;
  const [obra, fotos, artistas, precioGeneral, parametros] = await Promise.all([
    obtenerObraAdmin(admin, id),
    listarFotosObra(admin, id),
    opcionesDeArtistas(admin),
    precioSalidaGeneral(admin),
    searchParams,
  ]);
  if (!obra) notFound();
  // "?creada=1" queda en la dirección mientras se trabaja en la página: el aviso deja de
  // mostrarse cuando ya se cargó la primera foto.
  const recienCreada = parametros.creada === "1" && fotos.length === 0;

  return (
    <>
      <TituloPanel
        titulo={`Obra N° ${obra.numero}`}
        bajada={
          <>
            <span className={obra.titulo ? "" : "italic"}>{tituloObra(obra.titulo)}</span>, de {obra.artistaNombre}
          </>
        }
        acciones={
          <>
            <Link href={`/admin/obras/${obra.id}/ofertas`} className="boton-secundario">
              Ver ofertas
            </Link>
            {obra.publicada && (
              <Link href={`/obras/${obra.numero}`} className="boton-secundario">
                Ver en el sitio
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          {obra.publicada ? <Etiqueta tono="verde">Publicada</Etiqueta> : <Etiqueta tono="gris">No publicada</Etiqueta>}
          {obra.esEjemplo && <Etiqueta tono="azul">Ejemplo</Etiqueta>}
        </div>
        <p>
          Oferta actual:{" "}
          <span className="font-semibold text-tinta">
            {obra.ofertaActual != null ? pesos(obra.ofertaActual) : "sin ofertas"}
          </span>
          {obra.cantidadOfertasValidas > 0 && (
            <span className="text-gris">
              {" "}
              ({obra.cantidadOfertasValidas === 1 ? "1 oferta válida" : `${obra.cantidadOfertasValidas} ofertas válidas`})
            </span>
          )}
        </p>
      </div>

      {recienCreada && (
        <MensajeAccion
          estado={{ ok: true, mensaje: "La obra quedó creada. Ahora cargá las fotos: la primera de la lista es la portada." }}
        />
      )}

      <Tarjeta titulo="Datos de la obra" className="max-w-4xl">
        <FormularioObra
          obra={{
            id: obra.id,
            numero: obra.numero,
            titulo: obra.titulo,
            artistaId: obra.artistaId,
            resena: obra.resena,
            tecnica: obra.tecnica,
            precioSalida: obra.precioSalida,
            publicada: obra.publicada,
          }}
          artistas={artistas}
          precioGeneral={precioGeneral}
        />
      </Tarjeta>

      <Fotos obra={obra} fotos={fotos} />

      <ZonaBorrar obra={obra} cantidadFotos={fotos.length} />
    </>
  );
}

function Fotos({ obra, fotos }: { obra: ObraEnEdicion; fotos: FotoEnPanel[] }) {
  return (
    <Tarjeta titulo="Fotos" className="max-w-4xl">
      <p className="text-gris">
        Se muestran en este orden en la ficha de la obra. La primera es la portada: es la que aparece en el catálogo.
      </p>

      {fotos.length === 0 ? (
        <p
          className={`mt-4 rounded-md px-4 py-3 text-tinta ${obra.publicada ? "border-l-2 border-ambar bg-ambar-suave" : "bg-fondo"}`}
        >
          Todavía no hay fotos.{" "}
          {obra.publicada
            ? "La obra está publicada: en el sitio se muestra con el cartel «Foto pendiente»."
            : "Cargá al menos una antes de publicar la obra."}
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {fotos.map((foto, i) => (
            <FilaFoto key={foto.id} foto={foto} posicion={i + 1} total={fotos.length} />
          ))}
        </ol>
      )}

      <div className="mt-8 border-t border-linea pt-6">
        <h3 className="mb-4 text-lg">Subir una foto nueva</h3>
        <SubirFoto guardarAction={subirFotoObraAccion} ocultos={{ obra_id: obra.id }} etiqueta="Foto de la obra" />
      </div>
    </Tarjeta>
  );
}

function FilaFoto({ foto, posicion, total }: { foto: FotoEnPanel; posicion: number; total: number }) {
  const nombre = `la foto ${posicion}`;
  return (
    <li className="grid gap-4 rounded-md border border-linea p-4 sm:grid-cols-[9rem_1fr]">
      <div className="relative aspect-4/5 w-36 overflow-hidden rounded-lg bg-linea">
        <FotoObra
          foto={{ ruta: foto.ruta, alt: foto.textoAlternativo, ancho: foto.ancho, alto: foto.alto }}
          tamanos="144px"
        />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-semibold text-tinta">
            Foto {posicion} de {total}
          </p>
          {posicion === 1 && <Etiqueta tono="azul">Portada</Etiqueta>}
          {foto.ancho != null && foto.alto != null && (
            <p className="text-base text-gris">
              {foto.ancho} × {foto.alto} px
            </p>
          )}
          <a href={urlFoto(foto.ruta)} target="_blank" rel="noreferrer" className="enlace text-base">
            Ver en tamaño completo<span className="sr-only"> ({nombre}, se abre en otra pestaña)</span>
          </a>
        </div>

        <TextoAlternativo fotoId={foto.id} texto={foto.textoAlternativo} posicion={posicion} />

        <div className="flex flex-wrap items-start gap-3">
          {posicion > 1 && (
            <form action={moverFotoAccion}>
              <input type="hidden" name="foto_id" value={foto.id} />
              <input type="hidden" name="direccion" value="subir" />
              <BotonEnviar variante="secundario" enviando="Moviendo…">
                <span aria-hidden>↑</span> Subir<span className="sr-only"> {nombre} un lugar</span>
              </BotonEnviar>
            </form>
          )}
          {posicion < total && (
            <form action={moverFotoAccion}>
              <input type="hidden" name="foto_id" value={foto.id} />
              <input type="hidden" name="direccion" value="bajar" />
              <BotonEnviar variante="secundario" enviando="Moviendo…">
                <span aria-hidden>↓</span> Bajar<span className="sr-only"> {nombre} un lugar</span>
              </BotonEnviar>
            </form>
          )}
          <details className="group">
            <summary className="boton-secundario cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">
                Borrar<span className="sr-only"> {nombre}</span>
              </span>
              <span className="hidden group-open:inline">
                Cancelar<span className="sr-only"> el borrado de {nombre}</span>
              </span>
            </summary>
            <form action={borrarFotoAccion} className="mt-3 max-w-md space-y-3 rounded-md border-2 border-rojo bg-white p-4">
              <input type="hidden" name="foto_id" value={foto.id} />
              <p className="text-tinta">La foto se borra del sitio y del almacenamiento. No se puede deshacer.</p>
              <BotonEnviar variante="peligro" enviando="Borrando…">
                Sí, borrar {nombre}
              </BotonEnviar>
            </form>
          </details>
        </div>
      </div>
    </li>
  );
}

function ZonaBorrar({ obra, cantidadFotos }: { obra: ObraEnEdicion; cantidadFotos: number }) {
  const ofertas = obra.cantidadOfertasRegistradas;
  return (
    <Tarjeta titulo="Borrar la obra" className="max-w-4xl">
      {ofertas > 0 ? (
        <div className="space-y-3">
          <p>
            Esta obra no se puede borrar porque tiene{" "}
            {ofertas === 1 ? "1 oferta registrada" : `${ofertas} ofertas registradas`} (las anuladas también cuentan): las
            ofertas se conservan siempre.
          </p>
          <p>
            {obra.publicada
              ? "Si no querés que se vea en el sitio, despublicala: desmarcá «Publicada en el sitio» en los datos de la obra y guardá los cambios."
              : "La obra no está publicada, así que no se ve en el sitio, no recibe ofertas y no figura en el listado final."}
            {obra.publicada &&
              obra.cantidadOfertasValidas > 0 &&
              " Tené en cuenta que una obra despublicada no figura en el listado final para el martillero, aunque tenga ofertas válidas."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p>
            {cantidadFotos === 0
              ? "Se borra la obra."
              : cantidadFotos === 1
                ? "Se borran la obra y su foto."
                : `Se borran la obra y sus ${cantidadFotos} fotos.`}{" "}
            No se puede deshacer. Si solo querés sacarla del sitio, despublicala.
          </p>
          <FormularioBorrar
            borrarAction={borrarObraAccion}
            id={obra.id}
            confirmacion="Confirmo que quiero borrar esta obra"
            textoBoton="Borrar la obra"
          />
        </div>
      )}
    </Tarjeta>
  );
}
