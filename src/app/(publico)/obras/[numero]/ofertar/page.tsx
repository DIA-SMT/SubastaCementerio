import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Recuadro } from "@/components/Avisos";
import { FotoObra } from "@/components/FotoObra";
import { usuarioActual } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { estadoSubasta, obtenerObra } from "@/lib/datos/publico";
import { tituloObra } from "@/lib/formato";
import { numeroDeObra } from "@/lib/validacion";
import { FormularioOferta } from "./FormularioOferta";

export const metadata: Metadata = { title: "Ofertar", robots: { index: false } };

export default function PaginaOfertar({ params }: PageProps<"/obras/[numero]/ofertar">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <div className="superficie-tarjeta p-6 md:p-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-linea" aria-busy="true" />}>
          <Ofertar params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Ofertar({ params }: Pick<PageProps<"/obras/[numero]/ofertar">, "params">) {
  const numero = numeroDeObra((await params).numero);
  if (!numero) notFound();

  const destino = `/obras/${numero}/ofertar`;
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(destino)}`);
  const perfil = await miPerfil(usuario.id);
  if (!perfil) redirect(`/registro?volver=${encodeURIComponent(destino)}`);

  const [estado, obra] = await Promise.all([estadoSubasta(), obtenerObra(numero, usuario.id)]);
  if (!obra) notFound();

  // Va en medio de la oración: "por la obra N° 3 — …".
  const descripcion = `obra N° ${obra.numero} — ${tituloObra(obra.titulo)}, de ${obra.artistaNombre}`;

  let bloqueo: { titulo: string; detalle?: ReactNode; esMia?: boolean } | null = null;
  if (estado.fase === "cerrada") bloqueo = { titulo: "La etapa virtual ya cerró. No se aceptan más ofertas." };
  else if (estado.fase !== "abierta") bloqueo = { titulo: "La etapa virtual todavía no empezó." };
  else if (perfil.bloqueado) {
    bloqueo = { titulo: "Tu cuenta no puede ofertar. Comunicate con la Dirección de Cementerios." };
  } else if (obra.ofertaActualEsMia) {
    bloqueo = {
      esMia: true,
      titulo: "Ya tenés la oferta más alta de esta obra.",
      detalle: perfil.avisosPorCorreo ? (
        "Si alguien la supera, te avisamos por correo."
      ) : (
        <>
          Tenés los avisos por correo desactivados; podés activarlos en{" "}
          <Link href="/mis-ofertas" className="enlace">
            Mis ofertas
          </Link>
          .
        </>
      ),
    };
  }

  return (
    <>
      <p>
        <Link href={`/obras/${obra.numero}`} className="enlace">
          ← Volver a la obra
        </Link>
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-linea">
          <FotoObra foto={obra.portada} tamanos="80px" />
        </div>
        <div>
          <p className="font-bold text-gris">Obra N° {obra.numero}</p>
          <h1 className="text-2xl">{tituloObra(obra.titulo)}</h1>
          <p>de {obra.artistaNombre}</p>
        </div>
      </div>

      <div className="mt-6">
        {bloqueo ? (
          <Recuadro tono={bloqueo.esMia ? "exito" : "alerta"} titulo={bloqueo.titulo} rol="status">
            {bloqueo.detalle}
          </Recuadro>
        ) : (
          <FormularioOferta
            obraId={obra.id}
            numero={obra.numero}
            descripcion={descripcion}
            ofertaActual={obra.ofertaActual}
            minimo={obra.minimoSiguiente}
            incremento={estado.incrementoMinimo}
            email={perfil.email}
            avisos={perfil.avisosPorCorreo}
          />
        )}
      </div>
    </>
  );
}
