import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FotoObra } from "@/components/FotoObra";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Esqueleto, Etiqueta, MensajeAccion, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { SubirFoto } from "@/components/admin/SubirFoto";
import { requerirAdmin } from "@/lib/admin/sesion";
import { obtenerArtistaAdmin, type ArtistaEnEdicion } from "@/lib/datos/admin/artistas";
import { tituloObra } from "@/lib/formato";
import { FormularioBorrar } from "../../obras/FormularioBorrar";
import { borrarArtistaAccion, quitarFotoArtistaAccion, subirFotoArtistaAccion } from "../acciones";
import { FormularioArtista } from "../FormularioArtista";

export const metadata: Metadata = { title: "Editar artista" };

export default function PaginaEditarArtista(props: PageProps<"/admin/artistas/[id]">) {
  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/artistas" className="enlace">
          ← Volver a los artistas
        </Link>
      </p>
      <Suspense fallback={<Esqueleto />}>
        <Contenido params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params, searchParams }: Pick<PageProps<"/admin/artistas/[id]">, "params" | "searchParams">) {
  const admin = await requerirAdmin();
  const { id } = await params;
  const [artista, parametros] = await Promise.all([obtenerArtistaAdmin(admin, id), searchParams]);
  if (!artista) notFound();
  // "?creado=1" queda en la dirección: el aviso deja de mostrarse cuando ya tiene foto.
  const recienCreado = parametros.creado === "1" && !artista.fotoRuta;

  return (
    <>
      <TituloPanel
        titulo={artista.nombre}
        bajada={
          artista.obras.length === 0
            ? "Todavía no tiene obras asignadas."
            : artista.obras.length === 1
              ? "Tiene 1 obra asignada."
              : `Tiene ${artista.obras.length} obras asignadas.`
        }
      />
      {artista.esEjemplo && (
        <p>
          <Etiqueta tono="azul">Ejemplo</Etiqueta>
        </p>
      )}

      {recienCreado && (
        <MensajeAccion estado={{ ok: true, mensaje: "El artista quedó cargado. Si tenés su foto, subila más abajo." }} />
      )}

      <Tarjeta titulo="Datos del artista" className="max-w-4xl">
        <FormularioArtista
          artista={{ id: artista.id, nombre: artista.nombre, resena: artista.resena, enlace: artista.enlace }}
        />
      </Tarjeta>

      <FotoArtista artista={artista} />

      <Tarjeta titulo="Obras" className="max-w-4xl">
        {artista.obras.length === 0 ? (
          <p>
            No tiene obras asignadas. Podés asignarle una desde{" "}
            <Link href="/admin/obras/nueva" className="enlace">
              Nueva obra
            </Link>{" "}
            o desde la edición de una obra existente.
          </p>
        ) : (
          <ul className="space-y-2">
            {artista.obras.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/admin/obras/${o.id}`} className="enlace">
                  Obra N° {o.numero}: <span className={o.titulo ? "" : "italic"}>{tituloObra(o.titulo)}</span>
                </Link>
                {!o.publicada && <Etiqueta tono="gris">No publicada</Etiqueta>}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Borrar el artista" className="max-w-4xl">
        {artista.obras.length > 0 ? (
          <p>
            No se puede borrar porque tiene{" "}
            {artista.obras.length === 1 ? "1 obra asignada" : `${artista.obras.length} obras asignadas`}. Para borrarlo,
            primero asigná esas obras a otro artista o borralas.
          </p>
        ) : (
          <div className="space-y-4">
            <p>{artista.fotoRuta ? "Se borran sus datos y su foto." : "Se borran sus datos."} No se puede deshacer.</p>
            <FormularioBorrar
              borrarAction={borrarArtistaAccion}
              id={artista.id}
              confirmacion="Confirmo que quiero borrar este artista"
              textoBoton="Borrar el artista"
            />
          </div>
        )}
      </Tarjeta>
    </>
  );
}

function FotoArtista({ artista }: { artista: ArtistaEnEdicion }) {
  return (
    <Tarjeta titulo="Foto del artista (opcional)" className="max-w-4xl">
      {artista.fotoRuta ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative aspect-square w-40 shrink-0 overflow-hidden rounded-md bg-linea">
            <FotoObra
              foto={{ ruta: artista.fotoRuta, alt: `Foto de ${artista.nombre}`, ancho: null, alto: null }}
              tamanos="160px"
            />
          </div>
          <div className="space-y-3">
            <p>Esta es la foto actual. Si subís otra, reemplaza a esta.</p>
            <details className="group">
              <summary className="boton-secundario cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Quitar la foto</span>
                <span className="hidden group-open:inline">Cancelar</span>
              </summary>
              <form
                action={quitarFotoArtistaAccion}
                className="mt-3 max-w-md space-y-3 rounded-md border-2 border-rojo bg-white p-4"
              >
                <input type="hidden" name="artista_id" value={artista.id} />
                <p className="text-tinta">La foto se borra del almacenamiento. No se puede deshacer.</p>
                <BotonEnviar variante="peligro" enviando="Quitando…">
                  Sí, quitar la foto
                </BotonEnviar>
              </form>
            </details>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-gris">Todavía no tiene foto.</p>
      )}
      <SubirFoto
        guardarAction={subirFotoArtistaAccion}
        ocultos={{ artista_id: artista.id }}
        conTextoAlternativo={false}
        etiqueta={artista.fotoRuta ? "Foto nueva" : "Foto"}
        textoBoton={artista.fotoRuta ? "Reemplazar la foto" : "Subir la foto"}
      />
    </Tarjeta>
  );
}
