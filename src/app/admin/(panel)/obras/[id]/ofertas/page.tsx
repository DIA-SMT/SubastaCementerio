import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Recuadro } from "@/components/Recuadros";
import { Esqueleto, Etiqueta, TablaContenedor, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { ofertasDeObra, type ObraConOfertas, type OfertaAdmin } from "@/lib/datos/admin/ofertas";
import { pesos, tituloObra } from "@/lib/formato";
import {
  EnlaceCorreo,
  EnlaceOferente,
  EnlaceTelefono,
  EstadoDeOferta,
  FechaHora,
  claseBotonChico,
  idDeOferta,
} from "../../../ofertas/partes";
import { FormularioAnulacion } from "./FormularioAnulacion";

export const metadata: Metadata = { title: "Ofertas de la obra" };

export default function Pagina(props: PageProps<"/admin/obras/[id]/ofertas">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Esqueleto />}>
        <Contenido params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/obras/[id]/ofertas">["params"];
  searchParams: PageProps<"/admin/obras/[id]/ofertas">["searchParams"];
}) {
  const admin = await requerirAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const datos = await ofertasDeObra(admin, id);
  if (!datos) notFound();
  const { obra, ofertas } = datos;
  const base = `/admin/obras/${obra.id}/ofertas`;

  const idAnular = idDeOferta(sp.anular);
  const aAnular = idAnular ? ofertas.find((o) => o.id === idAnular) : undefined;
  const idAnulada = idDeOferta(sp.anulada);
  const recienAnulada = idAnulada ? ofertas.find((o) => o.id === idAnulada && o.estado === "anulada") : undefined;

  return (
    <>
      <TituloPanel
        titulo={`Ofertas de la obra N° ${obra.numero}`}
        bajada={
          <>
            {tituloObra(obra.titulo)} · {obra.artistaNombre}
          </>
        }
        acciones={
          <>
            <Link href={`/admin/obras/${obra.id}`} className="boton-secundario">
              Volver a la obra
            </Link>
            <Link href={`/admin/ofertas?obra=${obra.numero}`} className="boton-secundario">
              Ver en todas las ofertas
            </Link>
          </>
        }
      />

      <Resumen obra={obra} />

      {obra.mejor?.bloqueado && (
        <Recuadro tono="alerta" rol="note" titulo="La oferta más alta es de una persona bloqueada">
          Bloquear no anula sus ofertas: si no la anulás, sigue siendo la oferta más alta
          {obra.publicada && " y queda como precio base en el listado final, con sus datos para el martillero"}. Si
          corresponde, anulala con un motivo desde la tabla de ofertas.
        </Recuadro>
      )}

      {recienAnulada && <AvisoAnulada oferta={recienAnulada} obra={obra} cerrar={base} />}

      {idAnular && (!aAnular || aAnular.estado !== "valida") && (
        <Recuadro tono="info" rol="status" titulo="Esta oferta no se puede anular">
          {aAnular ? "Ya está anulada." : "No es una oferta de esta obra."}{" "}
          <Link href={base} className="enlace">
            Volver al listado
          </Link>
        </Recuadro>
      )}

      {aAnular && aAnular.estado === "valida" && <SeccionAnular oferta={aAnular} ofertas={ofertas} obra={obra} cancelar={base} />}

      {ofertas.length === 0 ? (
        <Tarjeta>
          <p>Esta obra todavía no recibió ofertas.</p>
        </Tarjeta>
      ) : (
        <TablaOfertas ofertas={ofertas} base={base} anulando={aAnular?.id} />
      )}
    </>
  );
}

function Resumen({ obra }: { obra: ObraConOfertas }) {
  return (
    <Tarjeta>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <div className="sm:col-span-3 md:col-span-1">
          <dt className="font-semibold text-tinta">Oferta más alta vigente</dt>
          {obra.mejor ? (
            <dd>
              <span className="block text-3xl font-semibold text-tinta">{pesos(obra.mejor.monto)}</span>
              <span className="block">
                Oferente {obra.mejor.alias} · {obra.mejor.nombre} {obra.mejor.apellido}
              </span>
              {obra.mejor.bloqueado && (
                <span className="mt-1 block">
                  <Etiqueta tono="rojo">Bloqueado</Etiqueta>
                </span>
              )}
              <span className="block text-gris">
                <FechaHora fecha={obra.mejor.creadaAt} />
              </span>
            </dd>
          ) : (
            <dd>
              <span className="block text-xl font-semibold text-tinta">Sin ofertas válidas</span>
              <span className="block text-gris">Precio de salida: {pesos(obra.precioSalida)}</span>
            </dd>
          )}
        </div>
        <div>
          <dt className="font-semibold text-tinta">Ofertas válidas</dt>
          <dd className="text-3xl font-semibold text-tinta">{obra.cantidadValidas}</dd>
        </div>
        <div>
          <dt className="font-semibold text-tinta">Ofertas anuladas</dt>
          <dd className="text-3xl font-semibold text-tinta">{obra.cantidadAnuladas}</dd>
        </div>
      </dl>
      {!obra.publicada && (
        <p className="mt-4">
          <Etiqueta tono="ambar">No publicada</Etiqueta>{" "}
          <span className="text-gris">La obra no se ve en el sitio y no recibe ofertas nuevas.</span>
        </p>
      )}
    </Tarjeta>
  );
}

function AvisoAnulada({ oferta, obra, cerrar }: { oferta: OfertaAdmin; obra: ObraConOfertas; cerrar: string }) {
  return (
    <Recuadro tono="exito" rol="status" titulo="Oferta anulada">
      <p>
        La oferta de {pesos(oferta.monto)} de Oferente {oferta.alias} ({oferta.nombre} {oferta.apellido}) quedó
        registrada como anulada. Motivo: {oferta.motivoAnulacion}
      </p>
      <p className="mt-1">
        {obra.mejor ? (
          <>
            Ahora la oferta más alta es <strong>{pesos(obra.mejor.monto)}</strong>, de Oferente {obra.mejor.alias} (
            {obra.mejor.nombre} {obra.mejor.apellido}).
          </>
        ) : (
          <>
            La obra quedó sin ofertas válidas. El precio de salida es <strong>{pesos(obra.precioSalida)}</strong>.
          </>
        )}
      </p>
      <p className="mt-2">
        <Link href={cerrar} className="enlace">
          Cerrar este aviso
        </Link>
      </p>
    </Recuadro>
  );
}

function SeccionAnular({
  oferta,
  ofertas,
  obra,
  cancelar,
}: {
  oferta: OfertaAdmin;
  ofertas: OfertaAdmin[];
  obra: ObraConOfertas;
  cancelar: string;
}) {
  // Las ofertas ya vienen de mayor a menor monto (y, a igual monto, la más antigua primero).
  const siguiente = ofertas.find((o) => o.estado === "valida" && o.id !== oferta.id);
  return (
    <section
      id="anular-oferta"
      aria-labelledby="titulo-anular"
      className="scroll-mt-6 rounded-lg border-2 border-rojo bg-white p-5"
    >
      <h2 id="titulo-anular" className="text-xl">
        Anular la oferta de {pesos(oferta.monto)}
      </h2>
      <p className="mt-2">
        De Oferente {oferta.alias} ({oferta.nombre} {oferta.apellido}, DNI {oferta.dni}), registrada el{" "}
        <FechaHora fecha={oferta.creadaAt} />.
        {oferta.bloqueado && " La persona está bloqueada: no puede hacer ofertas nuevas, pero las que ya hizo siguen vigentes mientras no se anulen."}
      </p>

      <div className="mt-4 space-y-3">
        <Recuadro tono="alerta" titulo="Antes de anular">
          <p>
            La oferta no se borra: queda registrada como anulada, con el motivo, quién la anuló y cuándo. No se
            puede deshacer y deja de mostrarse en el historial público.
          </p>
          {oferta.esLaMasAlta ? (
            <p className="mt-1">
              <strong>Es la oferta más alta de esta obra.</strong>{" "}
              {siguiente ? (
                <>
                  Si la anulás, pasa a valer la siguiente oferta válida: {pesos(siguiente.monto)}, de Oferente{" "}
                  {siguiente.alias} ({siguiente.nombre} {siguiente.apellido}
                  {siguiente.bloqueado && (oferta.bloqueado ? ", que también está bloqueada" : ", que está bloqueada")}).
                </>
              ) : (
                <>
                  No hay otra oferta válida: si la anulás, la obra queda sin ofertas y vuelve al precio de salida (
                  {pesos(obra.precioSalida)}).
                </>
              )}
            </p>
          ) : (
            <p className="mt-1">
              No es la oferta más alta de esta obra, así que la oferta más alta no cambia. Cuando se anula la más alta,
              pasa a valer la siguiente oferta válida.
            </p>
          )}
        </Recuadro>
      </div>

      <div className="mt-5">
        <FormularioAnulacion key={oferta.id} ofertaId={oferta.id} />
      </div>
      <p className="mt-4">
        <Link href={cancelar} className="enlace">
          Cancelar
        </Link>
      </p>
    </section>
  );
}

function TablaOfertas({ ofertas, base, anulando }: { ofertas: OfertaAdmin[]; base: string; anulando?: number }) {
  return (
    <TablaContenedor etiqueta="Ofertas de la obra, de mayor a menor monto">
      <caption className="sr-only">Todas las ofertas de la obra, válidas y anuladas, de mayor a menor monto</caption>
      <thead>
        <tr>
          <th scope="col">Fecha y hora</th>
          <th scope="col">Oferente</th>
          <th scope="col">Nombre y apellido</th>
          <th scope="col">DNI</th>
          <th scope="col">Teléfono</th>
          <th scope="col">Correo</th>
          <th scope="col" className="text-right">
            Monto
          </th>
          <th scope="col">Estado</th>
          <th scope="col">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {ofertas.map((o) => (
          <tr
            key={o.id}
            id={`oferta-${o.id}`}
            className={`scroll-mt-6 ${o.esLaMasAlta ? "bg-verde-suave" : ""} ${anulando === o.id ? "outline-2 -outline-offset-2 outline-rojo" : ""}`}
          >
            <td>
              <FechaHora fecha={o.creadaAt} />
            </td>
            <td>
              <EnlaceOferente id={o.oferenteId} alias={o.alias} bloqueado={o.bloqueado} />
            </td>
            <td className="min-w-40">
              {o.nombre} {o.apellido}
            </td>
            <td className="whitespace-nowrap">{o.dni}</td>
            <td>
              <EnlaceTelefono telefono={o.telefono} />
            </td>
            <td className="min-w-48">
              <EnlaceCorreo email={o.email} />
            </td>
            <td className={`text-right font-semibold whitespace-nowrap text-tinta ${o.estado === "anulada" ? "line-through" : ""}`}>
              {pesos(o.monto)}
            </td>
            <td className="min-w-56">
              <EstadoDeOferta estado={o.estado} esLaMasAlta={o.esLaMasAlta} />
              {o.estado === "anulada" && (
                <div className="mt-2 text-base">
                  <p>
                    <span className="font-semibold text-tinta">Motivo:</span> {o.motivoAnulacion}
                  </p>
                  <p className="text-gris">
                    Anulada por {o.anuladaPorNombre ?? "el equipo"}
                    {o.anuladaAt && (
                      <>
                        {" el "}
                        <FechaHora fecha={o.anuladaAt} />
                      </>
                    )}
                  </p>
                </div>
              )}
            </td>
            <td>
              {o.estado === "valida" && (
                <Link
                  href={`${base}?anular=${o.id}#anular-oferta`}
                  className={`${claseBotonChico} border-rojo bg-rojo-suave text-tinta hover:bg-white`}
                  aria-label={`Anular la oferta de ${pesos(o.monto)} de Oferente ${o.alias}`}
                >
                  Anular
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TablaContenedor>
  );
}
