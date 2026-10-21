import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Esqueleto, TablaContenedor, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { listarOfertas, obrasParaFiltro, type FiltroEstado, type ObraOpcion } from "@/lib/datos/admin/ofertas";
import { numeroConPuntos, pesos, tituloObra } from "@/lib/formato";
import { numeroDeObra } from "@/lib/validacion";
import { EnlaceOferente, EstadoDeOferta, FechaHora, parametro } from "./partes";

export const metadata: Metadata = { title: "Ofertas" };

const ESTADOS: { valor: FiltroEstado; texto: string }[] = [
  { valor: "todas", texto: "Todas" },
  { valor: "validas", texto: "Válidas" },
  { valor: "anuladas", texto: "Anuladas" },
];

export default function Pagina(props: PageProps<"/admin/ofertas">) {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Ofertas"
        bajada="Las últimas ofertas de todas las obras, de la más reciente a la más antigua. Para ver los datos de contacto o anular una oferta, abrí la obra."
      />
      <Suspense fallback={<Esqueleto />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

type Filtros = { numeroObra: number | null; estado: FiltroEstado; pagina: number };

function leerFiltros(sp: Record<string, string | string[] | undefined>): Filtros {
  const estado = parametro(sp.estado);
  const pagina = Number(parametro(sp.pagina));
  return {
    numeroObra: numeroDeObra(parametro(sp.obra)),
    estado: estado === "validas" || estado === "anuladas" ? estado : "todas",
    pagina: Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

function enlace(filtros: Filtros, pagina: number) {
  const p = new URLSearchParams();
  if (filtros.numeroObra != null) p.set("obra", String(filtros.numeroObra));
  if (filtros.estado !== "todas") p.set("estado", filtros.estado);
  if (pagina > 1) p.set("pagina", String(pagina));
  const q = p.toString();
  return q ? `/admin/ofertas?${q}` : "/admin/ofertas";
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/admin/ofertas">["searchParams"] }) {
  const admin = await requerirAdmin();
  const filtros = leerFiltros(await searchParams);
  const [obras, resultado] = await Promise.all([obrasParaFiltro(admin), listarOfertas(admin, filtros)]);
  const { ofertas, total, pagina, paginas, porPagina } = resultado;
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  const hayFiltros = filtros.numeroObra != null || filtros.estado !== "todas";

  return (
    <>
      {/* La clave vuelve a crear el formulario cuando cambian los filtros (por ejemplo, al quitarlos). */}
      <FormularioFiltros key={enlace(filtros, 1)} obras={obras} filtros={filtros} hayFiltros={hayFiltros} />

      <p role="status" className="text-gris">
        {total === 0 ? (
          "No hay ofertas con estos filtros."
        ) : ofertas.length === 0 ? (
          <>
            Esta página no tiene ofertas: el listado tiene {paginas} {paginas === 1 ? "página" : "páginas"}.{" "}
            <Link href={enlace(filtros, 1)} className="enlace">
              Ir a la primera página
            </Link>
          </>
        ) : (
          `Mostrando ${numeroConPuntos(desde)} a ${numeroConPuntos(hasta)} de ${numeroConPuntos(total)} ${
            total === 1 ? "oferta" : "ofertas"
          }.`
        )}
      </p>

      {ofertas.length > 0 && (
        <TablaContenedor etiqueta="Últimas ofertas">
          <caption className="sr-only">Últimas ofertas, de la más reciente a la más antigua</caption>
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Obra</th>
              <th scope="col">Oferente</th>
              <th scope="col">Nombre y apellido</th>
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
                <td>
                  <EnlaceOferente id={o.oferenteId} alias={o.alias} bloqueado={o.bloqueado} />
                </td>
                <td className="min-w-40">
                  {o.nombre} {o.apellido}
                </td>
                <td
                  className={`text-right font-semibold whitespace-nowrap text-tinta ${o.estado === "anulada" ? "line-through" : ""}`}
                >
                  {pesos(o.monto)}
                </td>
                <td className="min-w-40">
                  <EstadoDeOferta estado={o.estado} esLaMasAlta={o.esLaMasAlta} />
                  {o.estado === "anulada" && o.motivoAnulacion && (
                    <span className="mt-1 block text-base">
                      <span className="font-semibold text-tinta">Motivo:</span> {o.motivoAnulacion}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TablaContenedor>
      )}

      {paginas > 1 && (
        <nav aria-label="Páginas del listado" className="flex flex-wrap items-center gap-3">
          {pagina > 1 && (
            <Link href={enlace(filtros, pagina - 1)} className="boton-secundario">
              Más recientes
            </Link>
          )}
          <span className="text-gris">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={enlace(filtros, pagina + 1)} className="boton-secundario">
              Más antiguas
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function FormularioFiltros({ obras, filtros, hayFiltros }: { obras: ObraOpcion[]; filtros: Filtros; hayFiltros: boolean }) {
  return (
    <Tarjeta>
      <Form action="/admin/ofertas" className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
        <div>
          <label htmlFor="filtro-obra" className="etiqueta">
            Obra
          </label>
          <select
            id="filtro-obra"
            name="obra"
            defaultValue={filtros.numeroObra == null ? "" : String(filtros.numeroObra)}
            className="campo"
          >
            <option value="">Todas las obras</option>
            {/* Si en la URL viene un N° que no existe, el filtro aplicado se sigue viendo en el selector. */}
            {filtros.numeroObra != null && !obras.some((o) => o.numero === filtros.numeroObra) && (
              <option value={filtros.numeroObra}>N° {filtros.numeroObra} · no hay una obra con ese número</option>
            )}
            {obras.map((o) => (
              <option key={o.id} value={o.numero}>
                N° {o.numero} · {tituloObra(o.titulo)} · {o.artistaNombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-estado" className="etiqueta">
            Estado
          </label>
          <select id="filtro-estado" name="estado" defaultValue={filtros.estado} className="campo">
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.texto}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="boton-primario">
            Filtrar
          </button>
          {hayFiltros && (
            <Link href="/admin/ofertas" className="boton-secundario">
              Quitar filtros
            </Link>
          )}
        </div>
      </Form>
    </Tarjeta>
  );
}
