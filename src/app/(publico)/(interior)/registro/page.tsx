import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Cabecera, Columna } from "@/components/Cabecera";
import { Markdown } from "@/components/Markdown";
import { ciudadanoActual } from "@/lib/auth/ciudadano";
import { esOferente, miPersona } from "@/lib/datos/oferente";
import { obtenerPagina } from "@/lib/datos/publico";
import type { SlugPagina } from "@/lib/datos/tipos";
import { rutaSegura } from "@/lib/validacion";
import { FormularioRegistro, type TextoLegal } from "./FormularioRegistro";

/** Bases o privacidad, para leerlas en un recuadro sin salir del formulario. */
async function textoLegal(slug: SlugPagina, tituloPorDefecto: string): Promise<TextoLegal> {
  const pagina = await obtenerPagina(slug);
  return {
    titulo: pagina?.titulo ?? tituloPorDefecto,
    contenido: pagina ? <Markdown texto={pagina.contenido} /> : <p className="mt-4">Texto no disponible por el momento.</p>,
  };
}

export const metadata: Metadata = { title: "Tus datos", robots: { index: false } };

export default function PaginaRegistro({ searchParams }: PageProps<"/registro">) {
  return (
    <>
      <Cabecera
        antetitulo="Registro"
        titulo="Completá tus datos"
        bajada="Lo hacés una sola vez. Después podés ofertar por cualquier obra."
        ancho="angosto"
      />
      <Columna ancho="angosto">
        <div className="superficie-tarjeta p-6 md:p-8">
          <Suspense fallback={<div className="esqueleto h-96" aria-busy="true" />}>
            <Registro searchParams={searchParams} />
          </Suspense>
        </div>
      </Columna>
    </>
  );
}

async function Registro({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const volver = rutaSegura((await searchParams).volver);
  const usuario = await ciudadanoActual();
  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(volver)}`);
  if (await esOferente(usuario.id)) redirect(volver);
  const persona = await miPersona(usuario.id);
  // Una sesión de una persona que ya no está en la base (se reinició o se borró): se descarta
  // la cookie, o /ingresar volvería a mandar acá.
  if (!persona) redirect(`/auth/cidituc/descartar?volver=${encodeURIComponent(volver)}`);
  const [bases, privacidad] = await Promise.all([
    textoLegal("bases-y-condiciones", "Bases y condiciones"),
    textoLegal("privacidad", "Política de privacidad"),
  ]);
  return <FormularioRegistro volver={volver} persona={persona} bases={bases} privacidad={privacidad} />;
}
