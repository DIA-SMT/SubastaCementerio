import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Recuadro } from "@/components/Avisos";
import { Esqueleto, Etiqueta, TablaContenedor, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { obtenerOferente, ofertasDeOferente, type OferenteDetalle } from "@/lib/datos/admin/oferentes";
import type { OfertaAdmin } from "@/lib/datos/admin/ofertas";
import { pesos, tituloObra } from "@/lib/formato";
import { EnlaceCorreo, EnlaceTelefono, EstadoDeOferta, FechaHora } from "../../ofertas/partes";
import { FormularioBloqueo } from "./FormularioBloqueo";

export const metadata: Metadata = { title: "Ficha de oferente" };

export default function Pagina(props: PageProps<"/admin/oferentes/[id]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Esqueleto />}>
        <Contenido params={props.params} />
      </Suspense>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/admin/oferentes/[id]">["params"] }) {
  const admin = await requerirAdmin();
  const { id } = await params;
  const [oferente, ofertas] = await Promise.all([obtenerOferente(admin, id), ofertasDeOferente(admin, id)]);
  if (!oferente) notFound();

  return (
    <>
      <TituloPanel
        titulo={`Oferente ${oferente.alias}`}
        bajada={`${oferente.nombre} ${oferente.apellido}`}
        acciones={
          <Link href="/admin/oferentes" className="boton-secundario">
            Volver a oferentes
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {oferente.bloqueado ? <Etiqueta tono="rojo">Bloqueado</Etiqueta> : <Etiqueta tono="verde">Habilitado para ofertar</Etiqueta>}
        {oferente.esEjemplo && <Etiqueta tono="ambar">Ejemplo</Etiqueta>}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Datos oferente={oferente} />
        <Bloqueo oferente={oferente} />
      </div>

      <section aria-labelledby="titulo-ofertas" className="space-y-3">
        <h2 id="titulo-ofertas" className="text-xl">
          Sus ofertas
        </h2>
        <p className="text-gris">
          {oferente.ofertasValidas} {oferente.ofertasValidas === 1 ? "válida" : "válidas"} · {oferente.ofertasAnuladas}{" "}
          {oferente.ofertasAnuladas === 1 ? "anulada" : "anuladas"} · tiene la oferta más alta en {oferente.obrasMasAlta}{" "}
          {oferente.obrasMasAlta === 1 ? "obra" : "obras"}.
        </p>
        {ofertas.length === 0 ? (
          <Tarjeta>
            <p>Esta persona todavía no hizo ofertas.</p>
          </Tarjeta>
        ) : (
          <TablaOfertas ofertas={ofertas} />
        )}
      </section>
    </>
  );
}

function Fila({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-tinta">{termino}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function Datos({ oferente: o }: { oferente: OferenteDetalle }) {
  const basesDesactualizadas = o.basesVersionVigente != null && o.basesVersion < o.basesVersionVigente;
  return (
    <Tarjeta titulo="Datos">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <Fila termino="Nombre">{o.nombre}</Fila>
        <Fila termino="Apellido">{o.apellido}</Fila>
        <Fila termino="DNI">{o.dni}</Fila>
        <Fila termino="Teléfono">
          <EnlaceTelefono telefono={o.telefono} />
        </Fila>
        <Fila termino="Correo">
          <EnlaceCorreo email={o.email} />
        </Fila>
        <Fila termino="En el sitio">Oferente {o.alias}</Fila>
        <Fila termino="Registro">
          <FechaHora fecha={o.creadoAt} />
        </Fila>
        <Fila termino="Bases y condiciones">
          Aceptó la versión {o.basesVersion} el <FechaHora fecha={o.basesAceptadasAt} />
          {basesDesactualizadas && (
            <span className="mt-1 block">
              <Etiqueta tono="ambar">La versión vigente es la {o.basesVersionVigente}</Etiqueta>
            </span>
          )}
        </Fila>
        <Fila termino="Privacidad">
          Aceptó la política el <FechaHora fecha={o.privacidadAceptadaAt} />
        </Fila>
        <Fila termino="Avisos por correo">{o.avisosPorCorreo ? "Sí, quiere recibirlos" : "No quiere recibirlos"}</Fila>
        <Fila termino="Última modificación">
          <FechaHora fecha={o.actualizadoAt} />
        </Fila>
      </dl>
      <p className="mt-4 text-base text-gris">
        Los datos los carga cada persona al registrarse. Desde el panel solo se puede bloquear o desbloquear.
      </p>
    </Tarjeta>
  );
}

function Bloqueo({ oferente: o }: { oferente: OferenteDetalle }) {
  return (
    <Tarjeta titulo={o.bloqueado ? "Cuenta bloqueada" : "Bloquear"}>
      <div className="space-y-4">
        {o.bloqueado ? (
          <Recuadro tono="error" titulo="Esta persona no puede hacer nuevas ofertas">
            <p>
              <span className="font-semibold">Motivo:</span> {o.bloqueoMotivo}
            </p>
          </Recuadro>
        ) : (
          <p>
            Bloquear impide que esta persona haga nuevas ofertas. <strong>No anula las ofertas que ya hizo:</strong> si
            alguna no corresponde, anulala desde las ofertas de la obra, una por una.
          </p>
        )}
        {o.bloqueado && o.ofertasValidas > 0 && (
          <p>
            {o.ofertasValidas === 1
              ? "Su oferta válida sigue vigente."
              : `Sus ${o.ofertasValidas} ofertas válidas siguen vigentes.`}{" "}
            Si alguna no corresponde, anulala desde la obra: los enlaces están en la tabla de abajo.
          </p>
        )}
        <FormularioBloqueo oferenteId={o.id} bloqueado={o.bloqueado} />
      </div>
    </Tarjeta>
  );
}

function TablaOfertas({ ofertas }: { ofertas: OfertaAdmin[] }) {
  return (
    <TablaContenedor etiqueta="Ofertas de la persona">
      <caption className="sr-only">Ofertas de la persona, de la más reciente a la más antigua</caption>
      <thead>
        <tr>
          <th scope="col">Fecha y hora</th>
          <th scope="col">Obra</th>
          <th scope="col" className="text-right">
            Monto
          </th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {ofertas.map((o) => (
          <tr key={o.id} className={o.esLaMasAlta ? "bg-verde-suave" : undefined}>
            <td>
              <FechaHora fecha={o.creadaAt} />
            </td>
            <td className="min-w-56">
              <Link href={`/admin/obras/${o.obraId}/ofertas#oferta-${o.id}`} className="enlace">
                N° {o.numero} · {tituloObra(o.titulo)}
              </Link>
              {/* Sin text-gris: en la fila resaltada (bg-verde-suave) no alcanzaría el contraste AA. */}
              <span className="block text-base">{o.artistaNombre}</span>
            </td>
            <td className={`text-right font-semibold whitespace-nowrap text-tinta ${o.estado === "anulada" ? "line-through" : ""}`}>
              {pesos(o.monto)}
            </td>
            <td className="min-w-56">
              <EstadoDeOferta estado={o.estado} esLaMasAlta={o.esLaMasAlta} />
              {o.estado === "anulada" && (
                <span className="mt-1 block text-base">
                  <span className="font-semibold text-tinta">Motivo:</span> {o.motivoAnulacion}
                  <span className="block text-gris">
                    Anulada por {o.anuladaPorNombre ?? "el equipo"}
                    {o.anuladaAt && (
                      <>
                        {" el "}
                        <FechaHora fecha={o.anuladaAt} />
                      </>
                    )}
                  </span>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TablaContenedor>
  );
}
