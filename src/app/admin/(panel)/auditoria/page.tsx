import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Recuadro } from "@/components/Recuadros";
import { Campo, Esqueleto, Etiqueta, TablaContenedor, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import {
  listarAuditoria,
  POR_PAGINA,
  valoresDeFiltro,
  type EntradaAuditoria,
  type Referencias,
} from "@/lib/datos/admin/auditoria";
import { numeroConPuntos, ZONA } from "@/lib/formato";
import {
  ACCIONES,
  detalleLegible,
  hrefPagina,
  leerFiltros,
  nombreAccion,
  nombreTabla,
  opciones,
  quien,
  registro,
  resumirCambios,
  TABLAS,
  type LecturaFiltros,
} from "./resumen";

export const metadata: Metadata = { title: "Auditoría" };

const formatoDia = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const formatoHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Cambios que se muestran a la vista; el resto queda en un desplegable. */
const CAMBIOS_VISIBLES = 4;

export default function PaginaAuditoria(props: PageProps<"/admin/auditoria">) {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Auditoría"
        bajada="Registro de los cambios hechos desde el panel y el sitio, y de las exportaciones. Es de solo lectura: nadie puede modificarlo ni borrarlo. Los cambios de oferentes se registran sin nombre, apellido, DNI, teléfono ni correo: solo queda qué dato cambió."
      />
      <Suspense fallback={<Esqueleto alto="h-96" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: Pick<PageProps<"/admin/auditoria">, "searchParams">) {
  const admin = await requerirAdmin();
  const lectura = leerFiltros(await searchParams);
  const [resultado, valores] = await Promise.all([
    listarAuditoria(admin, lectura.filtros),
    valoresDeFiltro(admin),
  ]);
  const { entradas, referencias, total, pagina, paginas } = resultado;
  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(total, pagina * POR_PAGINA);

  return (
    <div className="space-y-6">
      <Filtros lectura={lectura} tablas={valores.tablas} acciones={valores.acciones} />

      {(lectura.errores.desde || lectura.errores.hasta) && (
        <Recuadro tono="alerta" titulo="Revisá las fechas del filtro" rol="alert">
          {lectura.errores.desde && <p>Desde: {lectura.errores.desde}</p>}
          {lectura.errores.hasta && <p>Hasta: {lectura.errores.hasta}</p>}
        </Recuadro>
      )}

      <p role="status" className="text-lg">
        {total === 0 ? (
          lectura.activos ? (
            "No hay registros con estos filtros."
          ) : (
            "Todavía no hay registros."
          )
        ) : entradas.length === 0 ? (
          "Esta página no tiene registros."
        ) : (
          <>
            Mostrando <strong className="text-tinta">{numeroConPuntos(desde)}</strong> a{" "}
            <strong className="text-tinta">{numeroConPuntos(hasta)}</strong> de{" "}
            <strong className="text-tinta">{numeroConPuntos(total)}</strong>{" "}
            {total === 1 ? "registro" : "registros"}
            {lectura.activos ? " con estos filtros" : ""}, del más reciente al más antiguo.
          </>
        )}
      </p>

      {total > 0 && entradas.length === 0 && (
        <p>
          <Link href={hrefPagina(lectura.valores, 1)} className="enlace">
            Ir a la primera página
          </Link>
        </p>
      )}

      {entradas.length > 0 && (
        <TablaContenedor etiqueta="Registro de auditoría">
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Quién</th>
              <th scope="col">Acción</th>
              <th scope="col">Tabla</th>
              <th scope="col">Registro</th>
              <th scope="col" className="min-w-[22rem]">
                Qué cambió
              </th>
            </tr>
          </thead>
          <tbody>
            {entradas.map((e) => (
              <Fila key={e.id} entrada={e} referencias={referencias} />
            ))}
          </tbody>
        </TablaContenedor>
      )}

      {paginas > 1 && <Paginacion lectura={lectura} pagina={pagina} paginas={paginas} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function Filtros({ lectura, tablas, acciones }: { lectura: LecturaFiltros; tablas: string[]; acciones: string[] }) {
  const { valores, errores } = lectura;
  // Al navegar, React conserva el formulario, y los campos no controlados no toman los nuevos
  // defaultValue. La key lo vuelve a armar cuando cambian los filtros aplicados (por ejemplo,
  // con «Quitar los filtros» o cuando una fecha no se aplicó).
  return (
    <Form
      key={hrefPagina(valores, 1)}
      action="/admin/auditoria"
      className="tarjeta-panel p-4 md:p-5"
      aria-label="Filtros"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Campo id="filtro-tabla" etiqueta="Tabla">
          <select id="filtro-tabla" name="tabla" defaultValue={valores.tabla} className="campo">
            <option value="">Todas</option>
            {opciones(TABLAS, [...tablas, valores.tabla]).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="filtro-accion" etiqueta="Acción">
          <select id="filtro-accion" name="accion" defaultValue={valores.accion} className="campo">
            <option value="">Todas</option>
            {opciones(ACCIONES, [...acciones, valores.accion]).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="filtro-desde" etiqueta="Desde" ayuda="Día completo, hora de Tucumán." error={errores.desde}>
          <input
            id="filtro-desde"
            name="desde"
            type="date"
            defaultValue={valores.desde}
            className="campo"
            aria-invalid={errores.desde ? true : undefined}
            aria-describedby={errores.desde ? "filtro-desde-ayuda filtro-desde-error" : "filtro-desde-ayuda"}
          />
        </Campo>
        <Campo id="filtro-hasta" etiqueta="Hasta" ayuda="Incluye todo ese día." error={errores.hasta}>
          <input
            id="filtro-hasta"
            name="hasta"
            type="date"
            defaultValue={valores.hasta}
            className="campo"
            aria-invalid={errores.hasta ? true : undefined}
            aria-describedby={errores.hasta ? "filtro-hasta-ayuda filtro-hasta-error" : "filtro-hasta-ayuda"}
          />
        </Campo>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" className="boton-primario">
          Filtrar
        </button>
        {lectura.activos && (
          <Link href="/admin/auditoria" className="boton-secundario">
            Quitar los filtros
          </Link>
        )}
      </div>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Filas
// ---------------------------------------------------------------------------

const TONO_ACCION: Record<string, "verde" | "azul" | "rojo" | "ambar" | "gris"> = {
  insert: "verde",
  update: "azul",
  delete: "rojo",
  anular: "rojo",
  exportar_listado: "ambar",
};

function Fila({ entrada: e, referencias }: { entrada: EntradaAuditoria; referencias: Referencias }) {
  const actor = quien(e, referencias);
  const reg = registro(e, referencias);
  return (
    <tr>
      <td className="whitespace-nowrap tabular-nums">
        <time dateTime={e.ocurridoAt.toISOString()}>
          {formatoDia.format(e.ocurridoAt)}
          <span className="block text-gris">{formatoHora.format(e.ocurridoAt)}</span>
        </time>
      </td>
      <td>
        <span className="font-semibold text-tinta">{actor.nombre}</span>
        {actor.rol && <span className="block text-sm text-gris">{actor.rol}</span>}
      </td>
      <td>
        <Etiqueta tono={TONO_ACCION[e.accion] ?? "gris"}>{nombreAccion(e.accion)}</Etiqueta>
      </td>
      <td className="whitespace-nowrap">{nombreTabla(e.tabla)}</td>
      <td className="min-w-[12rem]">
        {reg.href ? (
          <Link href={reg.href} className="enlace">
            {reg.texto}
          </Link>
        ) : (
          reg.texto
        )}
      </td>
      <td className="min-w-[22rem]">
        <QueCambio entrada={e} referencias={referencias} />
      </td>
    </tr>
  );
}

function QueCambio({ entrada: e, referencias }: { entrada: EntradaAuditoria; referencias: Referencias }) {
  const cambios = resumirCambios(e, referencias);
  const detalle = detalleLegible(e, referencias);

  if (cambios.length === 0 && !detalle) {
    return <span className="text-gris">{e.antes && e.despues ? "Sin cambios visibles." : "—"}</span>;
  }

  const items = cambios.map((c, i) => (
    <li key={`${c.campo}-${i}`} className="break-words">
      <span className="font-semibold text-tinta">{c.campo}:</span>{" "}
      {c.antes !== undefined && c.despues !== undefined ? (
        <>
          {c.antes} <span aria-hidden>→</span>
          <span className="sr-only">pasa a</span> {c.despues}
        </>
      ) : (
        (c.despues ?? c.antes)
      )}
    </li>
  ));

  return (
    <div className="space-y-2">
      {cambios.length > 0 && (
        <>
          <ul className="space-y-1">{items.slice(0, CAMBIOS_VISIBLES)}</ul>
          {items.length > CAMBIOS_VISIBLES && (
            <details>
              <summary className="enlace cursor-pointer">
                Ver {items.length - CAMBIOS_VISIBLES} {items.length - CAMBIOS_VISIBLES === 1 ? "campo más" : "campos más"}
              </summary>
              <ul className="mt-1 space-y-1">{items.slice(CAMBIOS_VISIBLES)}</ul>
            </details>
          )}
        </>
      )}
      {detalle && (
        <ul className="space-y-1">
          {detalle.map((renglon, i) => (
            <li key={i} className="break-words">
              {renglon}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paginación
// ---------------------------------------------------------------------------

function Paginacion({ lectura, pagina, paginas }: { lectura: LecturaFiltros; pagina: number; paginas: number }) {
  // Con ?pagina= más allá de la última, no se muestra «Página X de Y» (no sería cierto).
  const fueraDeRango = pagina > paginas;
  return (
    <nav aria-label="Páginas del registro" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3">
        {pagina > 1 && (
          <Link href={hrefPagina(lectura.valores, Math.min(pagina - 1, paginas))} className="boton-secundario">
            <span aria-hidden>←</span> {fueraDeRango ? "Ir a la última página" : "Anterior"}
          </Link>
        )}
        {pagina < paginas && (
          <Link href={hrefPagina(lectura.valores, pagina + 1)} className="boton-secundario">
            Siguiente <span aria-hidden>→</span>
          </Link>
        )}
      </div>
      {!fueraDeRango && (
        <p className="text-lg">
          Página <strong className="text-tinta">{numeroConPuntos(pagina)}</strong> de{" "}
          <strong className="text-tinta">{numeroConPuntos(paginas)}</strong>
        </p>
      )}
    </nav>
  );
}
