import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Esqueleto, Etiqueta, MensajeAccion, TablaContenedor, TituloPanel } from "@/components/admin/Panel";
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
            Cargar un artista
          </Link>
        }
      />
      <Suspense fallback={<Esqueleto />}>
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

      <p className="text-gris">
        {artistas.length === 1 ? "1 artista cargado" : `${artistas.length} artistas cargados`}
        {sinObras > 0 && ` · ${sinObras === 1 ? "1 sin obras asignadas" : `${sinObras} sin obras asignadas`}`}
      </p>

      {artistas.length === 0 ? (
        <div className="rounded-lg border border-linea bg-white p-6">
          <p className="text-lg">Todavía no hay artistas cargados.</p>
          <p className="mt-4">
            <Link href="/admin/artistas/nuevo" className="boton-primario">
              Cargar el primero
            </Link>
          </p>
        </div>
      ) : (
        <TablaContenedor etiqueta="Listado de artistas">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col" className="text-right">
                Obras
              </th>
              <th scope="col">Datos</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {artistas.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold text-tinta">{a.nombre}</td>
                <td className="text-right">{a.cantidadObras}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {a.cantidadObras === 0 && <Etiqueta tono="ambar">Sin obras</Etiqueta>}
                    {!a.tieneFoto && <Etiqueta tono="gris">Sin foto</Etiqueta>}
                    {a.esEjemplo && <Etiqueta tono="azul">Ejemplo</Etiqueta>}
                  </div>
                </td>
                <td>
                  <Link href={`/admin/artistas/${a.id}`} className="enlace whitespace-nowrap">
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
