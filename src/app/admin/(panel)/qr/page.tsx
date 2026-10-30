import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Recuadro } from "@/components/Avisos";
import { IconoDescargar } from "@/components/Iconos";
import { Esqueleto, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { obrasParaCarteles } from "@/lib/datos/admin/exportacion";
import { urlSitio } from "@/lib/entorno";
import { esDireccionLocal, urlCorta } from "@/lib/exportacion/comun";
import { qrSvg } from "@/lib/exportacion/qr";
import type { ObraCartel } from "@/lib/exportacion/tipos";
import { tituloObra } from "@/lib/formato";

export const metadata: Metadata = { title: "Carteles QR" };

export default function PaginaQr() {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Carteles QR"
        bajada="Un cartel por obra para imprimir y poner junto a cada cabeza. El código lleva a la ficha de la obra, donde se puede ofertar."
        acciones={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- es una descarga (Route Handler), no una página
          <a href="/admin/qr/pdf" className="boton-primario">
            <IconoDescargar className="text-lg" />
            Descargar carteles (PDF)
          </a>
        }
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const admin = await requerirAdmin();
  const { obras, noPublicadas } = await obrasParaCarteles(admin, urlSitio);
  const svgs = await Promise.all(obras.map((o) => qrSvg(o.url)));

  return (
    <>
      {esDireccionLocal(urlSitio) && (
        <Recuadro tono="alerta" rol="note" titulo="Antes de imprimir, configurá NEXT_PUBLIC_URL_SITIO con la dirección pública del sitio">
          Los códigos de esta página apuntan a {urlSitio}, que solo funciona en esta computadora. Escaneados desde un
          celular no van a abrir la ficha de la obra.
        </Recuadro>
      )}

      <Recuadro tono="info" rol="note" titulo="Para imprimir">
        El PDF trae un cartel por página, en A4 vertical, con el código de más de 10 cm de lado. Imprimilo al 100 % (sin
        ajustar a la página) y probá escanear uno antes de imprimir todos.
      </Recuadro>

      {noPublicadas > 0 && (
        <p className="text-gris">
          {noPublicadas === 1
            ? "Hay 1 obra sin publicar que no tiene cartel."
            : `Hay ${noPublicadas} obras sin publicar que no tienen cartel.`}{" "}
          Se suman cuando las publicás desde{" "}
          <Link href="/admin/obras" className="enlace">
            Obras
          </Link>
          .
        </p>
      )}

      {obras.length === 0 ? (
        <Recuadro tono="info" rol="status">
          Todavía no hay obras publicadas, así que no hay carteles para imprimir.
        </Recuadro>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Códigos QR de las obras">
          {obras.map((obra, i) => (
            <TarjetaQr key={obra.numero} obra={obra} svg={svgs[i]} />
          ))}
        </ul>
      )}
    </>
  );
}

function TarjetaQr({ obra, svg }: { obra: ObraCartel; svg: string }) {
  const titulo = tituloObra(obra.titulo);
  return (
    <li className="tarjeta-panel flex flex-col p-5">
      <p className="text-[0.9rem] font-semibold text-smt-intenso">Obra N° {obra.numero}</p>
      <h2 className={`mt-0.5 text-xl ${obra.titulo?.trim() ? "" : "italic"}`}>{titulo}</h2>
      <p>
        de <span className="font-semibold text-tinta">{obra.artista}</span>
      </p>
      <div
        role="img"
        aria-label={`Código QR de la obra N° ${obra.numero}, lleva a ${urlCorta(obra.url)}`}
        className="mx-auto my-5 w-full max-w-56 rounded-md bg-white p-2 ring-1 ring-linea [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        // SVG generado en el servidor por la librería qrcode a partir de la dirección de la obra.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-center text-[0.9rem] break-all text-gris">{urlCorta(obra.url)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* El nombre accesible empieza con el texto visible ("Bajar PNG"), así funciona el control por voz. */}
        <a href={`/admin/qr/${obra.numero}?formato=png`} className="boton-tabla">
          <IconoDescargar className="text-[1.05rem]" />
          Bajar PNG<span className="sr-only"> del QR de la obra N° {obra.numero}</span>
        </a>
        <a href={`/admin/qr/${obra.numero}?formato=svg`} className="boton-tabla">
          <IconoDescargar className="text-[1.05rem]" />
          Bajar SVG<span className="sr-only"> del QR de la obra N° {obra.numero}</span>
        </a>
      </div>
    </li>
  );
}
