import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Recuadro } from "@/components/Recuadros";
import { Plazo } from "@/components/Plazo";
import { Esqueleto, Etiqueta, TablaContenedor, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { obtenerListadoFinal, type ListadoFinal } from "@/lib/datos/admin/exportacion";
import { fechaCorta, filasConOferenteBloqueado, horaCorta, resumenOfertas } from "@/lib/exportacion/comun";
import { fechaHoraLarga, numeroConPuntos, pesos, tituloObra } from "@/lib/formato";

export const metadata: Metadata = { title: "Listado final" };

export default function PaginaExportar() {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Listado final"
        bajada="Precio base de cada obra para la subasta presencial: la mayor oferta virtual válida. Revisalo antes de descargarlo para el martillero."
        acciones={
          <>
            {/* Formularios POST comunes: la ruta responde con el archivo y la página no cambia. No
                son enlaces para que otro sitio no pueda disparar una descarga con datos personales. */}
            <form method="post" action="/admin/exportar/planilla">
              <button type="submit" className="boton-primario">
                Descargar planilla (Excel)
              </button>
            </form>
            <form method="post" action="/admin/exportar/pdf">
              <button type="submit" className="boton-secundario">
                Descargar PDF
              </button>
            </form>
          </>
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
  const listado = await obtenerListadoFinal(admin);
  const { meta, totales, estado, noPublicadas } = listado;
  const bloqueadas = filasConOferenteBloqueado(listado.filas);
  const noPublicadasConOfertas = noPublicadas.filter((o) => o.cantidadOfertas > 0);

  return (
    <>
      {meta.preliminar ? (
        <Recuadro tono="alerta" rol="note" titulo="PRELIMINAR: la etapa virtual todavía no cerró; los precios base pueden cambiar.">
          Los archivos que descargues ahora llevan la marca PRELIMINAR.{" "}
          {estado.fechasConfirmadas
            ? `El listado definitivo se genera después del cierre (${fechaHoraLarga(estado.cierre)}, hora de Tucumán).`
            : "El listado definitivo se genera después del cierre de la etapa virtual, cuyas fechas todavía están por confirmarse."}
        </Recuadro>
      ) : (
        <Recuadro tono="exito" rol="note" titulo="FINAL: la etapa virtual cerró.">
          Cerró el {fechaHoraLarga(estado.cierre)} (hora de Tucumán). Estos son los precios base para la subasta
          presencial.
        </Recuadro>
      )}

      {bloqueadas.length > 0 && (
        <Recuadro
          tono="alerta"
          rol="note"
          titulo={
            bloqueadas.length === 1
              ? "En 1 obra la mayor oferta es de una persona bloqueada"
              : `En ${bloqueadas.length} obras la mayor oferta es de una persona bloqueada`
          }
        >
          <p>
            Bloquear a una persona no anula sus ofertas: si no se anulan, su oferta queda como precio base y sus datos
            le llegan al martillero. Revisá cada obra antes de descargar el listado y, si corresponde, anulá la oferta
            con un motivo.
          </p>
          <ul className="mt-1 list-disc pl-6">
            {bloqueadas.map((f) => (
              <li key={f.numero}>
                <Link href={`/admin/obras/${f.obraId}/ofertas`} className="enlace">
                  Ofertas de la obra N° {f.numero}
                </Link>{" "}
                ({pesos(f.precioBase)}, Oferente {f.oferente.alias})
              </li>
            ))}
          </ul>
          <p className="mt-1">La planilla y el PDF marcan estas obras como BLOQUEADO.</p>
        </Recuadro>
      )}

      <Recuadro tono="info" rol="note" titulo="Contiene datos personales">
        El listado incluye DNI y datos de contacto de quienes hicieron la mayor oferta: compartilo solo con el
        martillero (Ley 25.326). No lo reenvíes ni lo publiques. Cada descarga queda registrada en la auditoría.
      </Recuadro>

      {noPublicadas.length > 0 && (
        <Recuadro
          tono="alerta"
          rol="note"
          titulo={
            noPublicadas.length === 1
              ? "Hay 1 obra sin publicar que queda afuera del listado"
              : `Hay ${noPublicadas.length} obras sin publicar que quedan afuera del listado`
          }
        >
          <ul className="list-disc pl-6">
            {noPublicadas.map((o) => (
              <li key={o.numero}>
                <Link href={`/admin/obras/${o.obraId}`} className="enlace">
                  N° {o.numero} · {tituloObra(o.titulo)}
                </Link>
                : {resumenOfertas(o)}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            {noPublicadasConOfertas.length > 0 &&
              "Las ofertas de las obras sin publicar no cuentan en el listado: la planilla y el PDF solo las mencionan en una nota. "}
            Si tienen que ir a la subasta presencial, publicalas desde su ficha.
          </p>
        </Recuadro>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Obras en el listado" valor={numeroConPuntos(totales.obras)} />
        <Indicador
          titulo="Obras con ofertas"
          valor={numeroConPuntos(totales.obrasConOfertas)}
          detalle={`${numeroConPuntos(totales.obras - totales.obrasConOfertas)} sin ofertas`}
        />
        <Indicador
          titulo="Monto acumulado"
          valor={pesos(totales.montoAcumulado)}
          detalle="Suma de los precios base"
        />
        <Tarjeta titulo="Etapa virtual">
          <Plazo estado={estado} />
        </Tarjeta>
      </div>

      <section aria-labelledby="titulo-vista-previa" className="space-y-3">
        <h2 id="titulo-vista-previa" className="text-2xl">
          Vista previa
        </h2>
        <Tabla listado={listado} />
      </section>
    </>
  );
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-linea bg-white p-5">
      <p className="text-gris">{titulo}</p>
      <p className="mt-1 text-3xl font-extrabold text-tinta">{valor}</p>
      {detalle && <p className="mt-1 text-base text-gris">{detalle}</p>}
    </div>
  );
}

function Tabla({ listado }: { listado: ListadoFinal }) {
  if (listado.filas.length === 0) {
    return (
      <Recuadro tono="info" rol="status">
        Todavía no hay obras publicadas.{" "}
        <Link href="/admin/obras" className="enlace">
          Ir a Obras
        </Link>
      </Recuadro>
    );
  }
  return (
    <TablaContenedor etiqueta="Vista previa del listado final">
      <caption className="sr-only">
        Listado final: una fila por obra publicada, con el precio base y los datos de quien hizo la mayor oferta.
      </caption>
      <thead>
        <tr>
          <th scope="col" className="text-right">
            N°
          </th>
          <th scope="col">Obra</th>
          <th scope="col" className="text-right">
            Precio base
          </th>
          <th scope="col">Oferente</th>
          <th scope="col">DNI</th>
          <th scope="col">Contacto</th>
          <th scope="col">Fecha y hora</th>
          <th scope="col" className="text-right">
            Ofertas
          </th>
        </tr>
      </thead>
      <tbody>
        {listado.filas.map((f) => (
          <tr key={f.numero}>
            <td className="text-right font-bold text-tinta">{f.numero}</td>
            <td className="min-w-48">
              <span className={`font-bold text-tinta ${f.titulo?.trim() ? "" : "italic"}`}>{tituloObra(f.titulo)}</span>
              <span className="block text-gris">de {f.artista}</span>
            </td>
            <td className="text-right whitespace-nowrap">
              {f.precioBase != null ? (
                <span className="font-bold text-tinta">{pesos(f.precioBase)}</span>
              ) : (
                <>
                  <Etiqueta tono="gris">Sin ofertas</Etiqueta>
                  <span className="mt-1 block text-sm text-gris">Salida: {pesos(f.precioSalida)}</span>
                </>
              )}
            </td>
            <td className="min-w-40">
              {f.oferente ? (
                <>
                  <span className="font-bold text-tinta">
                    {f.oferente.nombre} {f.oferente.apellido}
                  </span>
                  <span className="block text-gris">Oferente {f.oferente.alias}</span>
                  {f.oferente.bloqueado && (
                    <span className="mt-1 block">
                      <Etiqueta tono="rojo">Bloqueado</Etiqueta>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gris">—</span>
              )}
            </td>
            <td className="whitespace-nowrap">{f.oferente?.dni}</td>
            <td>
              {f.oferente && (
                <>
                  <span className="block whitespace-nowrap">{f.oferente.telefono}</span>
                  <span className="block break-all">{f.oferente.email}</span>
                </>
              )}
            </td>
            <td className="whitespace-nowrap">
              {f.ofertaAt && (
                <>
                  {fechaCorta(f.ofertaAt)}
                  <span className="block text-gris">{horaCorta(f.ofertaAt)} h</span>
                </>
              )}
            </td>
            <td className="text-right">{f.cantidadOfertas}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-fondo">
          <th scope="row" colSpan={2} className="text-left">
            Totales
          </th>
          <td className="text-right font-bold whitespace-nowrap text-tinta">{pesos(listado.totales.montoAcumulado)}</td>
          {/* Texto en "texto" y no en gris: sobre el fondo celeste suave el gris no llega al contraste AA. */}
          <td colSpan={5} className="text-texto">
            {numeroConPuntos(listado.totales.obrasConOfertas)} de {numeroConPuntos(listado.totales.obras)} obras con
            ofertas
          </td>
        </tr>
      </tfoot>
    </TablaContenedor>
  );
}
