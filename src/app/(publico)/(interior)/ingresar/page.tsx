import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IngresoDividido } from "@/components/IngresoDividido";
import { ciudadanoActual } from "@/lib/auth/ciudadano";
import { CIDITUC_CONFIGURADO } from "@/lib/auth/cidituc/config";
import { textoDeError } from "@/lib/auth/cidituc/errores";
import { esOferente } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  return (
    <IngresoDividido
      antetitulo="Para ofertar"
      titulo="Ingresá con Ciudadano Digital"
      bajada="Usá tu cuenta de Ciudadano Digital (Cidituc), la de los trámites de la Municipalidad. Tu nombre y tu DNI los trae Ciudadano Digital: no hace falta cargarlos."
      imagen="angel"
    >
      <Suspense fallback={<div className="esqueleto h-40" aria-busy="true" />}>
        <Ingreso searchParams={searchParams} />
      </Suspense>
    </IngresoDividido>
  );
}

async function Ingreso({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  const parametros = await searchParams;
  const volver = rutaSegura(parametros.volver);
  const usuario = await ciudadanoActual();
  if (usuario) {
    redirect((await esOferente(usuario.id)) ? volver : `/registro?volver=${encodeURIComponent(volver)}`);
  }

  const error = textoDeError(parametros.error);
  // Un <a> y no un <Link>: el prefetch de Link abriría el arranque del ingreso (y su cookie)
  // sin que la persona lo pida.
  const inicio = `/auth/cidituc/inicio?${new URLSearchParams({ volver })}`;

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-md border-l-2 border-rojo bg-rojo-suave px-4 py-3 font-medium text-tinta">
          {error}
        </p>
      )}
      {CIDITUC_CONFIGURADO ? (
        <>
          <a href={inicio} className="boton-primario w-full">
            Ingresar con Ciudadano Digital
          </a>
          <p className="text-gris">
            Te llevamos a la pantalla de ingreso de la Municipalidad y volvés acá. Si no tenés cuenta, la podés crear
            ahí.
          </p>
        </>
      ) : (
        !error && (
          <p className="rounded-md border-l-2 border-ambar bg-ambar-suave px-4 py-3 font-medium text-tinta">
            El ingreso con Ciudadano Digital todavía no está habilitado en este sitio.
          </p>
        )
      )}
    </div>
  );
}
