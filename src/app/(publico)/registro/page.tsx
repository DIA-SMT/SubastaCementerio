import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TituloSeccion } from "@/components/TituloSeccion";
import { usuarioActual } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";
import { FormularioRegistro } from "./FormularioRegistro";

export const metadata: Metadata = { title: "Tus datos", robots: { index: false } };

export default function PaginaRegistro({ searchParams }: PageProps<"/registro">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 md:py-12">
      <TituloSeccion nivel={1}>Completá tus datos</TituloSeccion>
      <p className="mt-3 text-lg">Lo hacés una sola vez. Después podés ofertar por cualquier obra.</p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-linea" aria-busy="true" />}>
          <Registro searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Registro({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const volver = rutaSegura((await searchParams).volver);
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(volver)}`);
  if (await miPerfil(usuario.id)) redirect(volver);
  return <FormularioRegistro volver={volver} email={usuario.email} />;
}
