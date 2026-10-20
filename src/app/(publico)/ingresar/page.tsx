import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TituloSeccion } from "@/components/TituloSeccion";
import { usuarioActual } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 md:py-12">
      <TituloSeccion nivel={1}>Ingresá con tu correo</TituloSeccion>
      <p className="mt-3 text-lg">
        Para ofertar necesitamos confirmar que el correo es tuyo. No hace falta contraseña: te mandamos un código.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-linea" aria-busy="true" />}>
          <Ingreso searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Ingreso({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  const volver = rutaSegura((await searchParams).volver);
  const usuario = await usuarioActual();
  if (usuario) {
    const perfil = await miPerfil(usuario.id);
    redirect(perfil ? volver : `/registro?volver=${encodeURIComponent(volver)}`);
  }
  return <FormularioIngreso volver={volver} />;
}
