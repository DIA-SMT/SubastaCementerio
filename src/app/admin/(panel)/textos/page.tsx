import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Esqueleto, Etiqueta, TablaContenedor, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { listarPaginas, PAGINAS_EDITABLES } from "@/lib/datos/admin/textos";
import { fechaHoraLarga } from "@/lib/formato";

export const metadata: Metadata = { title: "Textos" };

export default function Pagina() {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Textos"
        bajada="Textos del sitio que se editan desde el panel. Elegí una página para cambiar su título o su contenido."
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const admin = await requerirAdmin();
  const paginas = await listarPaginas(admin);

  return (
    <>
      <TablaContenedor etiqueta="Textos del sitio">
        <thead>
          <tr>
            <th scope="col">Página</th>
            <th scope="col">Versión</th>
            <th scope="col">Estado</th>
            <th scope="col">Última actualización</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {PAGINAS_EDITABLES.map((info) => {
            const p = paginas.find((x) => x.slug === info.slug);
            return (
              <tr key={info.slug}>
                <td>
                  {p ? (
                    <Link href={`/admin/textos/${info.slug}`} className="enlace">
                      {info.nombre}
                    </Link>
                  ) : (
                    <span className="font-bold text-tinta">{info.nombre}</span>
                  )}
                  {p && p.titulo !== info.nombre && <p className="text-gris">{p.titulo}</p>}
                </td>
                <td>{p ? p.version : "—"}</td>
                <td>
                  {!p ? (
                    <Etiqueta tono="rojo">Falta en la base</Etiqueta>
                  ) : p.provisorio ? (
                    <Etiqueta tono="ambar">Provisorio</Etiqueta>
                  ) : (
                    <Etiqueta tono="verde">Definitivo</Etiqueta>
                  )}
                </td>
                <td>
                  {p ? (
                    <>
                      {fechaHoraLarga(p.actualizadaAt)}
                      {p.actualizadaPor && <p className="text-gris">por {p.actualizadaPor}</p>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 whitespace-nowrap">
                    {p && (
                      <Link href={`/admin/textos/${info.slug}`} className="enlace">
                        Editar<span className="sr-only"> {info.nombre}</span>
                      </Link>
                    )}
                    <a href={info.ruta} target="_blank" rel="noopener" className="enlace">
                      Ver en el sitio<span className="sr-only"> {info.nombre} (se abre en otra pestaña)</span>
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TablaContenedor>
      <p className="text-base text-gris">
        Las bases y condiciones y el destino de lo recaudado los aprueban la Dirección de Cementerios y el área legal;
        la política de privacidad la revisa el área legal. Cada cambio queda registrado en la{" "}
        <Link href="/admin/auditoria" className="enlace">
          auditoría
        </Link>
        .
      </p>
    </>
  );
}
