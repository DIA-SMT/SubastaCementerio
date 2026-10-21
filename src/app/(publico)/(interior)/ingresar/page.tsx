import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Cabecera, Columna } from "@/components/Cabecera";
import { usuarioActual } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  return (
    <>
      <Cabecera
        antetitulo="Para ofertar"
        titulo="Ingresá con tu correo"
        bajada="Necesitamos confirmar que el correo es tuyo. No hace falta contraseña: te mandamos un código."
        ancho="angosto"
      />
      <Columna ancho="angosto">
        <div className="superficie-tarjeta p-6 md:p-8">
          <Suspense fallback={<div className="esqueleto h-40" aria-busy="true" />}>
            <Ingreso searchParams={searchParams} />
          </Suspense>
        </div>
      </Columna>
    </>
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
