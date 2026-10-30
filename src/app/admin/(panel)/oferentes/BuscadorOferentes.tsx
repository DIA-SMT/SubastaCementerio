"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { IconoBuscar, IconoPersonas } from "@/components/Iconos";
import { EstadoVacio, Etiqueta, MensajeAccion, TablaContenedor, Tarjeta } from "@/components/admin/Panel";
import { numeroConPuntos } from "@/lib/formato";
import { EnlaceCorreo, EnlaceTelefono, FechaHora } from "../ofertas/partes";
import { buscarOferentesAccion } from "./acciones";

/** Lo que muestra cada fila del listado (coincide con OferenteFila de los datos del panel). */
export type OferenteEnListado = {
  id: string;
  alias: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  creadoAt: Date;
  bloqueado: boolean;
  esEjemplo: boolean;
  ofertasValidas: number;
  obrasMasAlta: number;
};

export type ListadoOferentes = { oferentes: OferenteEnListado[]; total: number; limite: number };

/** null: sin búsqueda, se muestra el listado completo que armó el servidor. */
export type EstadoBusqueda =
  | null
  | { busqueda: string; resultado: ListadoOferentes }
  | { busqueda: string; error: string };

/**
 * Buscador y listado de oferentes. La búsqueda va por POST (Server Action) y no por la
 * dirección: un DNI o un correo no quedan en el historial ni en los registros de pedidos.
 * Se vuelve a crear en cada navegación nueva para no mostrar resultados viejos (por ejemplo,
 * después de bloquear a alguien); con «Atrás» del navegador se conserva la búsqueda.
 */
export function BuscadorOferentes({ todos }: { todos: ListadoOferentes }) {
  const { bfcacheId } = useRouter();
  return <Buscador key={bfcacheId} todos={todos} />;
}

function Buscador({ todos }: { todos: ListadoOferentes }) {
  const [estado, buscar, buscando] = useActionState(buscarOferentesAccion, null);
  const busqueda = estado?.busqueda ?? "";
  const resultado = estado && "resultado" in estado ? estado.resultado : estado ? null : todos;

  return (
    <>
      <Tarjeta>
        <form action={buscar} role="search" aria-label="Buscar oferentes">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="buscar" className="etiqueta">
                Buscar
              </label>
              {/* Después de cada búsqueda, React vuelve el formulario a estos valores: queda el texto buscado. */}
              <div className="relative">
                <IconoBuscar
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[1.2rem] text-gris"
                />
                <input
                  id="buscar"
                  name="q"
                  type="search"
                  defaultValue={busqueda}
                  maxLength={100}
                  autoComplete="off"
                  spellCheck={false}
                  className="campo pl-11"
                  aria-describedby="buscar-ayuda"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <BotonEnviar enviando="Buscando…">Buscar</BotonEnviar>
              {estado && (
                <button type="submit" name="accion" value="todas" className="boton-secundario">
                  Ver a todas
                </button>
              )}
            </div>
          </div>
          <p id="buscar-ayuda" className="mt-2 text-[0.94rem] text-gris">
            Por nombre, apellido, DNI, correo o número de oferente (por ejemplo, «Oferente 12»).
          </p>
        </form>
      </Tarjeta>

      {estado && "error" in estado && <MensajeAccion estado={{ error: estado.error }} />}

      {/* Un solo aviso que cambia de texto: los lectores de pantalla anuncian cada resultado. */}
      <p role="status" className="text-[0.94rem] text-gris">
        {buscando ? "Buscando…" : resultado ? textoCantidad(resultado, busqueda) : ""}
      </p>

      {resultado && resultado.oferentes.length > 0 && <TablaOferentes oferentes={resultado.oferentes} />}
      {resultado && resultado.total === 0 && (
        <EstadoVacio
          titulo={busqueda ? "Nadie coincide con la búsqueda." : "Todavía no hay personas registradas."}
          icono={IconoPersonas}
        >
          {busqueda
            ? "Revisá lo que escribiste o probá con menos palabras."
            : "Aparecen acá cuando alguien se registra en el sitio para ofertar."}
        </EstadoVacio>
      )}
    </>
  );
}

function textoCantidad({ total, limite }: ListadoOferentes, busqueda: string) {
  const cantidad =
    total === 0
      ? busqueda
        ? "No encontramos personas con esa búsqueda. Revisá lo que escribiste o probá con menos palabras."
        : "Todavía no hay personas registradas."
      : busqueda
        ? `${numeroConPuntos(total)} ${total === 1 ? "persona coincide" : "personas coinciden"} con la búsqueda.`
        : `${numeroConPuntos(total)} ${total === 1 ? "persona registrada" : "personas registradas"}.`;
  return total > limite ? `${cantidad} Se muestran las primeras ${limite}: afiná la búsqueda para encontrar a alguien.` : cantidad;
}

function TablaOferentes({ oferentes }: { oferentes: OferenteEnListado[] }) {
  return (
    <TablaContenedor etiqueta="Oferentes" apilable>
      <caption className="sr-only">Personas registradas para ofertar</caption>
      <thead>
        <tr>
          <th scope="col">Oferente</th>
          <th scope="col">Nombre y apellido</th>
          <th scope="col">DNI</th>
          <th scope="col">Teléfono</th>
          <th scope="col">Correo</th>
          <th scope="col">Registro</th>
          <th scope="col" className="text-right">
            Ofertas válidas
          </th>
          <th scope="col" className="text-right">
            Obras con la oferta más alta
          </th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {oferentes.map((o) => (
          <tr key={o.id}>
            <td>
              <Link href={`/admin/oferentes/${o.id}`} className="enlace whitespace-nowrap">
                Oferente {o.alias}
              </Link>
            </td>
            <td data-etiqueta="Nombre y apellido" className="lg:min-w-40">
              {o.nombre} {o.apellido}
            </td>
            <td data-etiqueta="DNI" className="whitespace-nowrap">
              {o.dni}
            </td>
            <td data-etiqueta="Teléfono">
              <EnlaceTelefono telefono={o.telefono} />
            </td>
            <td data-etiqueta="Correo" className="lg:min-w-48">
              <EnlaceCorreo email={o.email} />
            </td>
            <td data-etiqueta="Registro">
              <FechaHora fecha={o.creadoAt} />
            </td>
            <td data-etiqueta="Ofertas válidas" className="text-right font-semibold text-tinta">
              {o.ofertasValidas}
            </td>
            <td data-etiqueta="Obras con la oferta más alta" className="text-right font-semibold text-tinta">
              <span>
                {o.obrasMasAlta}
                <span className="sr-only"> {o.obrasMasAlta === 1 ? "obra" : "obras"}</span>
              </span>
            </td>
            <td data-etiqueta="Estado">
              <span className="flex flex-wrap gap-1.5">
                {o.bloqueado ? <Etiqueta tono="rojo">Bloqueado</Etiqueta> : <Etiqueta tono="gris">Habilitado</Etiqueta>}
                {o.esEjemplo && <Etiqueta tono="ambar">Ejemplo</Etiqueta>}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </TablaContenedor>
  );
}
