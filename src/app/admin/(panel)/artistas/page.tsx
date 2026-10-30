import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconoArtista, IconoEditar, IconoMas } from "@/components/Iconos";
import { EsqueletoTabla, EstadoVacio, Etiqueta, MensajeAccion, TablaContenedor, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { listarArtistasAdmin } from "@/lib/datos/admin/artistas";

export const metadata: Metadata = { title: "Artistas" };

export default function PaginaArtistas(props: PageProps<"/admin/artistas">) {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Artistas"
        bajada="Quienes intervinieron las obras. Cada obra tiene un artista asignado."
        acciones={
          <Link href="/admin/artistas/nuevo" className="boton-primario">
            <IconoMas className="text-lg" />
            Cargar un artista
          </Link>
        }
      />
      <Suspense fallback={<EsqueletoTabla />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: Pick<PageProps<"/admin/artistas">, "searchParams">) {
  const admin = await requerirAdmin();
  const [artistas, parametros] = await Promise.all([listarArtistasAdmin(admin), searchParams]);
  const borrado = parametros.borrado === "1";
  const sinObras = artistas.filter((a) => a.cantidadObras === 0).length;

  return (
    <>
      {borrado && <MensajeAccion estado={{ ok: true, mensaje: "El artista quedó borrado." }} />}

      <p className="text-[0.94rem] text-gris">
        {artistas.length === 1 ? "1 artista cargado" : `${artistas.length} artistas cargados`}
        {sinObras > 0 && ` · ${sinObras === 1 ? "1 sin obras asignadas" : `${sinObras} sin obras asignadas`}`}
      </p>

      {artistas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay artistas cargados."
          icono={IconoArtista}
          accion={
            <Link href="/admin/artistas/nuevo" className="boton-primario">
              Cargar el primero
            </Link>
          }
        />
      ) : (
        <TablaContenedor etiqueta="Listado de artistas" apilable>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col" className="text-right">
                Obras
              </th>
              <th scope="col">Datos</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {artistas.map((a) => (
              <tr key={a.id}>
                <td className="lg:min-w-56">
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-smt-suave text-[0.9rem] font-semibold text-smt-intenso"
                    >
                      {iniciales(a.nombre)}
                    </span>
                    <span className="font-semibold text-tinta">{a.nombre}</span>
                  </span>
                </td>
                <td data-etiqueta="Obras" className="text-right">
                  {a.cantidadObras}
                </td>
                <td data-etiqueta="Datos">
                  <div className="flex flex-wrap gap-1.5">
                    {a.cantidadObras === 0 && <Etiqueta tono="ambar">Sin obras</Etiqueta>}
                    {!a.tieneFoto && <Etiqueta tono="gris">Sin foto</Etiqueta>}
                    {a.esEjemplo && <Etiqueta tono="azul">Ejemplo</Etiqueta>}
                  </div>
                </td>
                <td className="lg:text-right">
                  <Link href={`/admin/artistas/${a.id}`} className="boton-tabla">
                    <IconoEditar className="text-[1.05rem]" />
                    Editar<span className="sr-only"> a {a.nombre}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TablaContenedor>
      )}
    </>
  );
}

/** "Ana Torres" → "AT" (para el círculo de la fila; es decorativo). */
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}
