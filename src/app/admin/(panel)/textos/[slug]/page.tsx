import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Recuadro } from "@/components/Avisos";
import { Esqueleto, Etiqueta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { aceptacionesDeBases, obtenerPaginaAdmin, paginaEditable, type AceptacionesBases } from "@/lib/datos/admin/textos";
import { fechaHoraLarga, numeroConPuntos } from "@/lib/formato";
import { FormularioTexto } from "./FormularioTexto";

export const metadata: Metadata = { title: "Editar texto" };

export default function Pagina(props: PageProps<"/admin/textos/[slug]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Esqueleto alto="h-96" />}>
        <Contenido params={props.params} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/admin/textos/[slug]">["params"] }) {
  const admin = await requerirAdmin();
  const { slug } = await params;
  const info = paginaEditable(slug);
  if (!info) notFound();

  const esBases = info.slug === "bases-y-condiciones";
  const [pagina, aceptaciones] = await Promise.all([
    obtenerPaginaAdmin(admin, info.slug),
    esBases ? aceptacionesDeBases(admin) : Promise.resolve(null),
  ]);
  if (!pagina) notFound();

  return (
    <>
      <TituloPanel
        migas={[{ href: "/admin/textos", texto: "Textos" }]}
        titulo={info.nombre}
        bajada={
          <>
            Versión {pagina.version} · actualizada el {fechaHoraLarga(pagina.actualizadaAt)}
            {pagina.actualizadaPor ? `, por ${pagina.actualizadaPor}` : ""}.{" "}
            {pagina.provisorio && <Etiqueta tono="ambar">Provisorio</Etiqueta>}
          </>
        }
        acciones={
          <a href={info.ruta} target="_blank" rel="noopener" className="boton-secundario">
            Ver en el sitio<span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        }
      />

      {info.aprobacion && (
        <Recuadro tono="alerta" titulo="Contenido que requiere aprobación" rol="note">
          <p>{info.aprobacion}</p>
        </Recuadro>
      )}

      {esBases && aceptaciones && <AvisoVersiones version={pagina.version} aceptaciones={aceptaciones} />}

      <FormularioTexto
        slug={info.slug}
        guardado={{
          titulo: pagina.titulo,
          contenido: pagina.contenido,
          provisorio: pagina.provisorio,
          version: pagina.version,
          marca: pagina.actualizadaAt.toISOString(),
        }}
        esBases={esBases}
        requiereAprobacion={info.aprobacion !== null}
      />

      <p className="text-base text-gris">
        Cada cambio queda registrado en la{" "}
        <Link href="/admin/auditoria" className="enlace">
          auditoría
        </Link>
        , con el texto anterior y el nuevo.
      </p>
    </>
  );
}

function AvisoVersiones({ version, aceptaciones }: { version: number; aceptaciones: AceptacionesBases }) {
  const total = aceptaciones.reduce((suma, a) => suma + a.cantidad, 0);
  const personas = (n: number) => (n === 1 ? "1 oferente" : `${numeroConPuntos(n)} oferentes`);
  return (
    <Recuadro tono="info" titulo="Versiones de las bases" rol="note">
      <div className="space-y-3">
        <p>
          Cada cambio en el título o el contenido sube la versión (ahora es la {version}). Cada persona acepta las
          bases al registrarse y el sistema guarda qué versión aceptó: quienes ya se registraron aceptaron una versión
          anterior a la que publiques. Cambiar solo la casilla de texto provisorio no sube la versión.
        </p>
        {total === 0 ? (
          <p>Todavía no se registró ningún oferente.</p>
        ) : (
          <ul className="space-y-1">
            {aceptaciones.map((a) => (
              <li key={a.version} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Versión {a.version}:</span>
                <span>{personas(a.cantidad)}</span>
                {a.version === version && <Etiqueta tono="verde">Vigente</Etiqueta>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Recuadro>
  );
}
