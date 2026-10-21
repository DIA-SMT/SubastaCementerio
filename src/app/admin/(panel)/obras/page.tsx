import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FotoObra } from "@/components/FotoObra";
import { Esqueleto, Etiqueta, MensajeAccion, TablaContenedor, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { listarObrasAdmin, type ObraEnListado } from "@/lib/datos/admin/obras";
import { pesos, tituloObra } from "@/lib/formato";

export const metadata: Metadata = { title: "Obras" };

export default function PaginaObras(props: PageProps<"/admin/obras">) {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Obras"
        bajada="Cargá, editá y publicá las obras de la subasta. Están ordenadas por número."
        acciones={
          <Link href="/admin/obras/nueva" className="boton-primario">
            Nueva obra
          </Link>
        }
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: Pick<PageProps<"/admin/obras">, "searchParams">) {
  const admin = await requerirAdmin();
  const [obras, parametros] = await Promise.all([listarObrasAdmin(admin), searchParams]);
  const borrada = typeof parametros.borrada === "string" && /^\d{1,3}$/.test(parametros.borrada) ? parametros.borrada : null;

  const publicadas = obras.filter((o) => o.publicada).length;
  const sinFotos = obras.filter((o) => o.cantidadFotos === 0).length;
  const publicadasSinFotos = obras.filter((o) => o.publicada && o.cantidadFotos === 0).length;

  return (
    <>
      {borrada && <MensajeAccion estado={{ ok: true, mensaje: `Se borró la obra N° ${borrada}.` }} />}

      <dl className="grid gap-3 sm:grid-cols-3">
        <Dato titulo="Obras cargadas" valor={obras.length} />
        <Dato titulo="Publicadas" valor={publicadas} />
        <Dato titulo="Sin fotos" valor={sinFotos} alerta={sinFotos > 0} />
      </dl>

      {publicadasSinFotos > 0 && (
        <p className="rounded-md border-l-2 border-ambar bg-ambar-suave px-4 py-3 text-tinta">
          {publicadasSinFotos === 1
            ? "Hay 1 obra publicada sin fotos: "
            : `Hay ${publicadasSinFotos} obras publicadas sin fotos: `}
          en el sitio se muestran con el cartel «Foto pendiente».
        </p>
      )}

      {obras.length === 0 ? (
        <div className="rounded-lg border border-linea bg-white p-6">
          <p className="text-lg">Todavía no hay obras cargadas.</p>
          <p className="mt-4">
            <Link href="/admin/obras/nueva" className="boton-primario">
              Cargar la primera obra
            </Link>
          </p>
        </div>
      ) : (
        <TablaContenedor etiqueta="Listado de obras">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Foto de portada</span>
              </th>
              <th scope="col">N°</th>
              <th scope="col">Título</th>
              <th scope="col">Artista</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-right">
                Oferta actual
              </th>
              <th scope="col" className="text-right">
                Ofertas válidas
              </th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {obras.map((obra) => (
              <FilaObra key={obra.id} obra={obra} />
            ))}
          </tbody>
        </TablaContenedor>
      )}
    </>
  );
}

function Dato({ titulo, valor, alerta = false }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className={`rounded-lg border px-5 py-4 ${alerta ? "border-ambar bg-ambar-suave" : "border-linea bg-white"}`}>
      {/* El gris solo alcanza el contraste sobre blanco: sobre el ámbar suave, el texto va en tinta. */}
      <dt className={`text-base ${alerta ? "text-tinta" : "text-gris"}`}>{titulo}</dt>
      <dd className="text-3xl font-semibold text-tinta">{valor}</dd>
    </div>
  );
}

function FilaObra({ obra }: { obra: ObraEnListado }) {
  const nombre = `la obra N° ${obra.numero}`;
  return (
    <tr>
      <td>
        <div className="relative h-16 w-14 overflow-hidden rounded-lg bg-linea">
          {obra.portada ? (
            // La miniatura es decorativa: el título está en la misma fila.
            <FotoObra foto={{ ...obra.portada, alt: "" }} tamanos="56px" />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-sm leading-tight text-texto">
              Sin foto
            </span>
          )}
        </div>
      </td>
      <td className="text-xl font-semibold text-tinta">{obra.numero}</td>
      <td className={`font-semibold text-tinta ${obra.titulo ? "" : "italic"}`}>{tituloObra(obra.titulo)}</td>
      <td>{obra.artistaNombre}</td>
      <td>
        <div className="flex flex-wrap gap-1.5">
          {obra.publicada ? <Etiqueta tono="verde">Publicada</Etiqueta> : <Etiqueta tono="gris">No publicada</Etiqueta>}
          {obra.cantidadFotos === 0 && <Etiqueta tono="ambar">Sin fotos</Etiqueta>}
          {obra.esEjemplo && <Etiqueta tono="azul">Ejemplo</Etiqueta>}
        </div>
      </td>
      <td className="text-right whitespace-nowrap">
        {obra.ofertaActual != null ? (
          <span className="font-semibold text-tinta">{pesos(obra.ofertaActual)}</span>
        ) : (
          <span className="text-gris">Sin ofertas</span>
        )}
      </td>
      <td className="text-right">{obra.cantidadOfertas}</td>
      <td>
        <ul className="flex flex-col gap-1.5 whitespace-nowrap">
          <li>
            <Link href={`/admin/obras/${obra.id}`} className="enlace">
              Editar<span className="sr-only"> {nombre}</span>
            </Link>
          </li>
          <li>
            <Link href={`/admin/obras/${obra.id}/ofertas`} className="enlace">
              Ver ofertas<span className="sr-only"> de {nombre}</span>
            </Link>
          </li>
          {obra.publicada && (
            <li>
              <Link href={`/obras/${obra.numero}`} className="enlace">
                Ver en el sitio<span className="sr-only">: {nombre}</span>
              </Link>
            </li>
          )}
        </ul>
      </td>
    </tr>
  );
}
