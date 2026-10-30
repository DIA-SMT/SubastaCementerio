import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconoEditar, IconoVer } from "@/components/Iconos";
import { EsqueletoTabla, Etiqueta, TablaContenedor, TituloPanel } from "@/components/admin/Panel";
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
      <Suspense fallback={<EsqueletoTabla filas={5} />}>
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
      <TablaContenedor etiqueta="Textos del sitio" apilable>
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
                    <span className="font-semibold text-tinta">{info.nombre}</span>
                  )}
                  {p && p.titulo !== info.nombre && <p className="text-[0.9rem] text-gris">{p.titulo}</p>}
                </td>
                <td data-etiqueta="Versión">{p ? p.version : "—"}</td>
                <td data-etiqueta="Estado">
                  {!p ? (
                    <Etiqueta tono="rojo">Falta en la base</Etiqueta>
                  ) : p.provisorio ? (
                    <Etiqueta tono="ambar">Provisorio</Etiqueta>
                  ) : (
                    <Etiqueta tono="verde">Definitivo</Etiqueta>
                  )}
                </td>
                <td data-etiqueta="Última actualización">
                  {p ? (
                    <span>
                      {fechaHoraLarga(p.actualizadaAt)}
                      {p.actualizadaPor && <span className="block text-[0.9rem] text-gris">por {p.actualizadaPor}</span>}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {p && (
                      <Link href={`/admin/textos/${info.slug}`} className="boton-tabla">
                        <IconoEditar className="text-[1.05rem]" />
                        Editar<span className="sr-only"> {info.nombre}</span>
                      </Link>
                    )}
                    <a href={info.ruta} target="_blank" rel="noopener" className="boton-tabla">
                      <IconoVer className="text-[1.05rem]" />
                      Ver en el sitio<span className="sr-only"> {info.nombre} (se abre en otra pestaña)</span>
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TablaContenedor>
      <p className="text-[0.94rem] text-gris">
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
