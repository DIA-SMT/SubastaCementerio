import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FotoObra } from "@/components/FotoObra";
import { IconoCheck, IconoEditar, IconoMartillo, IconoMas, IconoObra, IconoVer } from "@/components/Iconos";
import { Dato, EsqueletoTabla, EstadoVacio, Etiqueta, MensajeAccion, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { listarObrasAdmin, type ObraEnListado } from "@/lib/datos/admin/obras";
import { pesos, tituloObra } from "@/lib/formato";
import { FiltroObras, type EstadoObra } from "./FiltroObras";

export const metadata: Metadata = { title: "Obras" };

export default function PaginaObras(props: PageProps<"/admin/obras">) {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Obras"
        bajada="Cargá, editá y publicá las obras de la subasta. Están ordenadas por número."
        acciones={
          <Link href="/admin/obras/nueva" className="boton-primario">
            <IconoMas className="text-lg" />
            Nueva obra
          </Link>
        }
      />
      <Suspense fallback={<EsqueletoTabla />}>
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

      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        <Dato etiqueta="Obras cargadas" valor={obras.length} icono={IconoObra} compacto />
        <Dato etiqueta="Publicadas" valor={publicadas} icono={IconoCheck} compacto />
        <Dato etiqueta="Sin fotos" valor={sinFotos} icono={IconoObra} tono={sinFotos > 0 ? "ambar" : "azul"} compacto />
      </dl>

      {publicadasSinFotos > 0 && (
        <p className="rounded-md bg-ambar-suave px-4 py-3 text-tinta ring-1 ring-ambar/30 ring-inset">
          {publicadasSinFotos === 1
            ? "Hay 1 obra publicada sin fotos: "
            : `Hay ${publicadasSinFotos} obras publicadas sin fotos: `}
          en el sitio se muestran con el cartel «Foto pendiente».
        </p>
      )}

      {obras.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay obras cargadas."
          icono={IconoObra}
          accion={
            <Link href="/admin/obras/nueva" className="boton-primario">
              Cargar la primera obra
            </Link>
          }
        />
      ) : (
        <FiltroObras
          encabezado={
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Foto de portada</span>
                </th>
                <th scope="col">N°</th>
                <th scope="col">Obra</th>
                <th scope="col">Estado</th>
                <th scope="col" className="text-right">
                  Oferta actual
                </th>
                <th scope="col" className="text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
          }
          filas={obras.map((obra) => ({
            id: obra.id,
            texto: `${obra.numero} ${tituloObra(obra.titulo)} ${obra.artistaNombre}`,
            estados: [
              obra.publicada ? "publicada" : "no_publicada",
              ...(obra.cantidadFotos === 0 ? ["sin_fotos" as const] : []),
            ] satisfies EstadoObra[],
            fila: <FilaObra obra={obra} />,
          }))}
        />
      )}
    </>
  );
}

function FilaObra({ obra }: { obra: ObraEnListado }) {
  const nombre = `la obra N° ${obra.numero}`;
  return (
    <tr>
      {/* En el celular, la miniatura flota a la izquierda del número y el título. */}
      <td className="max-lg:float-left max-lg:mr-4">
        <div className="relative h-14 w-12 overflow-hidden rounded-md bg-piedra ring-1 ring-linea">
          {obra.portada ? (
            // La miniatura es decorativa: el título está en la misma fila.
            <FotoObra foto={{ ...obra.portada, alt: "" }} tamanos="48px" />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-[0.72rem] leading-tight text-gris">
              Sin foto
            </span>
          )}
        </div>
      </td>
      {/* N° y obra sin rótulo: en el celular van junto a la miniatura, como encabezado de la tarjeta. */}
      <td>
        <span className="inline-flex h-8 min-w-8 items-center justify-center justify-self-start rounded-md bg-smt-suave px-2 font-semibold text-smt-intenso">
          {obra.numero}
        </span>
      </td>
      <td className="max-lg:mt-1 max-lg:overflow-hidden lg:min-w-56">
        <span>
          <span className={`block font-semibold text-tinta ${obra.titulo ? "" : "italic"}`}>{tituloObra(obra.titulo)}</span>
          <span className="block text-[0.9rem] text-gris">{obra.artistaNombre}</span>
        </span>
      </td>
      <td data-etiqueta="Estado">
        <div className="flex flex-wrap gap-1.5">
          {obra.publicada ? <Etiqueta tono="verde">Publicada</Etiqueta> : <Etiqueta tono="gris">No publicada</Etiqueta>}
          {obra.cantidadFotos === 0 && <Etiqueta tono="ambar">Sin fotos</Etiqueta>}
          {obra.esEjemplo && <Etiqueta tono="azul">Ejemplo</Etiqueta>}
        </div>
      </td>
      <td data-etiqueta="Oferta actual" className="text-right whitespace-nowrap">
        <span>
          {obra.ofertaActual != null ? (
            <span className="font-semibold text-tinta">{pesos(obra.ofertaActual)}</span>
          ) : (
            <span className="text-gris">Sin ofertas</span>
          )}
          <span className="block text-[0.85rem] text-gris">
            {obra.cantidadOfertas === 1 ? "1 oferta válida" : `${obra.cantidadOfertas} ofertas válidas`}
          </span>
        </span>
      </td>
      <td>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link href={`/admin/obras/${obra.id}`} className="boton-tabla">
            <IconoEditar className="text-[1.05rem]" />
            Editar<span className="sr-only"> {nombre}</span>
          </Link>
          <Link href={`/admin/obras/${obra.id}/ofertas`} className="boton-tabla">
            <IconoMartillo className="text-[1.05rem]" />
            Ofertas<span className="sr-only"> de {nombre}</span>
          </Link>
          {obra.publicada && (
            <Link href={`/obras/${obra.numero}`} className="boton-tabla">
              <IconoVer className="text-[1.05rem]" />
              Ver en el sitio<span className="sr-only">: {nombre}</span>
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
