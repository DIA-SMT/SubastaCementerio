import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ComponentType, type ReactNode, type SVGProps } from "react";
import { Recuadro } from "@/components/Avisos";
import { EstadoChip } from "@/components/EstadoChip";
import {
  IconoAjustes,
  IconoArtista,
  IconoCampana,
  IconoCheck,
  IconoFlecha,
  IconoListado,
  IconoMartillo,
  IconoMas,
  IconoMonto,
  IconoObra,
  IconoPersonas,
  IconoQr,
  IconoSiguiente,
} from "@/components/Iconos";
import { Plazo } from "@/components/Plazo";
import { GraficoOfertasPorDia, serieDiaria } from "@/components/admin/GraficoOfertas";
import {
  Dato,
  Esqueleto,
  EsqueletoDatos,
  EsqueletoTabla,
  EstadoVacio,
  TablaContenedor,
  Tarjeta,
  TituloPanel,
} from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { listarArtistasAdmin } from "@/lib/datos/admin/artistas";
import { listarObrasAdmin } from "@/lib/datos/admin/obras";
import {
  indicadoresTablero,
  obrasPublicadasSinOfertas,
  ofertasPorDia,
  resumenAvisos,
  ultimasOfertas,
} from "@/lib/datos/admin/tablero";
import { estadoSubasta } from "@/lib/datos/publico";
import type { Fase } from "@/lib/datos/tipos";
import { fechaHoraLarga, fechaLarga, haceCuanto, numeroConPuntos, pesos, tituloObra, ZONA } from "@/lib/formato";
import { EstadoDeOferta } from "./ofertas/partes";

export const metadata: Metadata = { title: "Tablero" };

const formatoHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "19/10, 14:32" en hora de Tucumán. */
function fechaHoraCorta(fecha: Date) {
  return formatoHora.format(fecha);
}

/** "2026-10-31" en hora de Tucumán. */
const diaTucuman = (fecha: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(fecha);

/** "1 oferta" / "3 ofertas" */
function cantidad(n: number, singular: string, plural: string) {
  return `${numeroConPuntos(n)} ${n === 1 ? singular : plural}`;
}

export default function PaginaTablero() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <TituloPanel
        titulo="Tablero"
        bajada="Cómo viene la subasta. Los números se calculan cada vez que abrís esta página."
        acciones={
          <Suspense fallback={null}>
            <ResumenEtapa />
          </Suspense>
        }
      />

      <Suspense fallback={<EsqueletoDatos />}>
        <Indicadores />
      </Suspense>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] [&>*]:min-w-0">
        <Suspense fallback={<Esqueleto alto="h-[28rem]" />}>
          <EstadoEtapa />
        </Suspense>
        <Suspense fallback={<Esqueleto alto="h-[28rem]" />}>
          <MontoAcumulado />
        </Suspense>
      </div>

      <AccesosRapidos />

      <Suspense fallback={<EsqueletoTabla />}>
        <UltimasOfertas />
      </Suspense>

      <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Suspense fallback={<Esqueleto />}>
          <SinOfertas />
        </Suspense>
        <Suspense fallback={<Esqueleto />}>
          <AvisosCorreo />
        </Suspense>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumen de la etapa (encabezado)
// ---------------------------------------------------------------------------

const FASES: Record<Fase, { texto: string; punto: string }> = {
  abierta: { texto: "Abierta: acepta ofertas", punto: "bg-verde" },
  antes: { texto: "Todavía no empezó", punto: "bg-smt" },
  cerrada: { texto: "Cerrada", punto: "bg-gris-suave" },
  por_confirmar: { texto: "Fechas a confirmar", punto: "bg-amarillo ring-4 ring-amarillo/30" },
};

/** Estado de la etapa virtual en una línea, con enlace a Configuración. */
async function ResumenEtapa() {
  await requerirAdmin();
  const estado = await estadoSubasta();
  return (
    <Link
      href="/admin/configuracion"
      className="group flex min-h-14 items-center gap-3.5 rounded-lg bg-white py-2.5 pr-3 pl-4 shadow-tarjeta ring-1 ring-linea transition-[box-shadow] duration-200 hover:ring-smt/40"
    >
      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${FASES[estado.fase].punto}`} />
      <span className="leading-tight">
        <span className="block text-[0.8rem] text-gris">Etapa virtual</span>
        <span className="block font-semibold text-tinta">{FASES[estado.fase].texto}</span>
      </span>
      <IconoSiguiente className="ml-2 text-lg text-gris transition-transform duration-200 group-hover:translate-x-0.5" />
      <span className="sr-only">: revisar en Configuración</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

async function Indicadores() {
  const admin = await requerirAdmin();
  const [i, obras, artistas] = await Promise.all([
    indicadoresTablero(admin),
    listarObrasAdmin(admin),
    listarArtistasAdmin(admin),
  ]);
  const artistasSinObras = artistas.filter((a) => a.cantidadObras === 0).length;

  return (
    <section aria-labelledby="titulo-indicadores">
      <h2 id="titulo-indicadores" className="sr-only">
        Indicadores
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Dato etiqueta="Obras publicadas" valor={numeroConPuntos(i.obrasPublicadas)} icono={IconoObra}>
          {obras.length === 0 ? "Todavía no hay obras cargadas." : `De ${cantidad(obras.length, "obra cargada", "obras cargadas")}.`}
        </Dato>
        <Dato etiqueta="Artistas" valor={numeroConPuntos(artistas.length)} icono={IconoArtista}>
          {artistas.length === 0
            ? "Todavía no hay artistas cargados."
            : artistasSinObras === 0
              ? "Todos tienen una obra asignada."
              : `${cantidad(artistasSinObras, "sin obra asignada", "sin obras asignadas")}.`}
        </Dato>
        <Dato etiqueta="Oferentes registrados" valor={numeroConPuntos(i.oferentesRegistrados)} icono={IconoPersonas}>
          <span className="block">
            {i.oferentesConOfertas === 1
              ? "1 ofertó al menos una vez."
              : `${numeroConPuntos(i.oferentesConOfertas)} ofertaron al menos una vez.`}
          </span>
          <span className="mt-0.5 block">
            {i.ingresosSinRegistro === 0
              ? "No hay ingresos sin completar el registro."
              : `${cantidad(
                  i.ingresosSinRegistro,
                  "ingreso sin completar el registro",
                  "ingresos sin completar el registro",
                )} (empezaron con su correo, pero no cargaron sus datos).`}
          </span>
        </Dato>
        <Dato etiqueta="Ofertas válidas" valor={numeroConPuntos(i.ofertasValidas)} icono={IconoMartillo} tono="amarillo">
          {i.ofertasAnuladas === 0
            ? "No hay ofertas anuladas."
            : `Aparte, ${cantidad(i.ofertasAnuladas, "oferta anulada, que no se cuenta", "ofertas anuladas, que no se cuentan")}.`}
        </Dato>
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Estado de la etapa virtual y cronograma
// ---------------------------------------------------------------------------

async function EstadoEtapa() {
  await requerirAdmin();
  const estado = await estadoSubasta();
  const sinConfirmar = !estado.fechasConfirmadas;
  const paso = (fecha: Date): Hito["estado"] => (sinConfirmar ? "pendiente" : fecha <= estado.ahora ? "hecho" : "proximo");

  return (
    <Tarjeta titulo="Estado de la etapa virtual">
      <div className="space-y-3 rounded-md bg-superficie p-4">
        <EstadoChip fase={estado.fase} />
        <Plazo estado={estado} />
      </div>

      <h3 className="mt-6 text-[0.95rem] text-tinta">Cronograma</h3>
      <ol className="mt-3">
        <Hito titulo="Inicio" estado={paso(estado.inicio)}>
          {fechaHoraLarga(estado.inicio)}
        </Hito>
        <Hito titulo="Cierre" estado={paso(estado.cierre)}>
          {fechaHoraLarga(estado.cierre)}
        </Hito>
        <Hito titulo="Extensión del cierre" estado={estado.extension ? "proximo" : "apagado"}>
          {estado.extension
            ? `Activa: una oferta en los últimos ${estado.extension.minutos} minutos extiende el cierre de esa obra`
            : "Apagada"}
        </Hito>
        {estado.cierreFinal > estado.cierre && (
          <Hito titulo="Última obra en cerrar" estado={paso(estado.cierreFinal)}>
            {fechaHoraLarga(estado.cierreFinal)}, por ofertas de último momento
          </Hito>
        )}
        <Hito titulo="Subasta presencial" estado={estado.fechaPresencial ? "proximo" : "pendiente"} ultimo>
          {estado.fechaPresencial ? fechaLarga(estado.fechaPresencial) : "A confirmar"}
          {estado.fechaPresencial && estado.detallePresencial && (
            <span className="block text-gris">{estado.detallePresencial}</span>
          )}
        </Hito>
      </ol>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-superficie px-4 py-3">
          <dt className="text-[0.88rem] text-gris">Incremento mínimo</dt>
          <dd className="text-xl font-semibold text-tinta">{pesos(estado.incrementoMinimo)}</dd>
        </div>
        <div className="rounded-md bg-superficie px-4 py-3">
          <dt className="text-[0.88rem] text-gris">Precio de salida</dt>
          <dd className="text-xl font-semibold text-tinta">{pesos(estado.precioSalida)}</dd>
          <dd className="text-[0.85rem] text-gris">Salvo las obras que tengan uno propio.</dd>
        </div>
      </dl>
      <p className="mt-4 text-[0.9rem] text-gris">Todas las horas son de Tucumán.</p>
      {estado.fase === "por_confirmar" && (
        <div className="mt-4">
          <Recuadro tono="alerta" titulo="Las fechas no están confirmadas" rol="note">
            Mientras no las confirmes, el sitio muestra «Fechas a confirmar» y no acepta ofertas.{" "}
            <Link href="/admin/configuracion" className="enlace">
              Revisá y confirmá las fechas en Configuración
            </Link>
            .
          </Recuadro>
        </div>
      )}
    </Tarjeta>
  );
}

type Hito = { estado: "hecho" | "proximo" | "pendiente" | "apagado" };

/** Paso del cronograma: punto (amarillo si falta confirmar), línea que lo une al siguiente y dato. */
function Hito({
  titulo,
  estado,
  ultimo = false,
  children,
}: Hito & { titulo: string; ultimo?: boolean; children: ReactNode }) {
  const punto = {
    hecho: "bg-smt text-white",
    proximo: "bg-white ring-2 ring-smt ring-inset",
    pendiente: "bg-amarillo ring-4 ring-amarillo/30",
    apagado: "bg-white ring-2 ring-gris-suave ring-inset",
  }[estado];
  return (
    <li className="relative flex gap-4 pb-4 last:pb-0">
      {!ultimo && <span aria-hidden className="absolute top-5 bottom-0 left-[0.5625rem] w-px bg-linea" />}
      <span aria-hidden className={`relative mt-1 flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full ${punto}`}>
        {estado === "hecho" && <IconoCheck className="text-[0.7rem]" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-tinta">
          {titulo}
          {estado === "pendiente" && (
            <span className="rounded-full bg-ambar-suave px-2 py-px text-[0.75rem] font-semibold text-tinta">Sin confirmar</span>
          )}
          {estado === "hecho" && <span className="sr-only">(ya pasó)</span>}
        </p>
        <p className="text-texto">{children}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Monto acumulado y actividad
// ---------------------------------------------------------------------------

async function MontoAcumulado() {
  const admin = await requerirAdmin();
  const [i, porDia, estado] = await Promise.all([indicadoresTablero(admin), ofertasPorDia(admin), estadoSubasta()]);
  const proporcion = i.obrasPublicadas > 0 ? Math.round((i.obrasConOfertas / i.obrasPublicadas) * 100) : 0;
  // Con la etapa abierta, el gráfico llega hasta hoy (los días sin ofertas también cuentan).
  const serie = serieDiaria(porDia, estado.fase === "abierta" ? diaTucuman(estado.ahora) : "");

  return (
    <Tarjeta titulo="Monto acumulado" icono={IconoMonto}>
      <p className="text-[clamp(2.6rem,2rem+2vw,3.4rem)] leading-none font-semibold tracking-[-0.025em] text-tinta">
        {pesos(i.montoAcumulado)}
      </p>
      <p className="mt-3 max-w-xl text-[0.94rem] text-gris">
        Es la suma de la oferta más alta vigente de cada obra publicada. Sirve como referencia: la plataforma no cobra ni
        procesa pagos, y la oferta más alta de cada obra pasa a ser el precio base de la subasta presencial.
      </p>

      <div className="mt-6 border-t border-linea pt-5">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="font-semibold text-tinta">Obras con ofertas</span>
          <span className="text-tinta">
            <strong className="text-xl font-semibold">{numeroConPuntos(i.obrasConOfertas)}</strong>{" "}
            <span className="text-gris">de {numeroConPuntos(i.obrasPublicadas)}</span>
          </span>
        </p>
        {i.obrasPublicadas === 0 ? (
          <p className="mt-1 text-gris">Todavía no hay obras publicadas.</p>
        ) : (
          <>
            <span aria-hidden className="mt-2.5 block h-2.5 overflow-hidden rounded-full bg-smt-suave">
              <span className="barra-progreso block h-full rounded-full bg-smt" style={{ width: `${proporcion}%` }} />
            </span>
            <p className="mt-2 text-[0.9rem] text-gris">
              {i.obrasPublicadas === 1
                ? "Obra publicada con al menos una oferta vigente."
                : `Obras publicadas con al menos una oferta vigente (${proporcion} %).`}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 border-t border-linea pt-5">
        {new Set(porDia.map((d) => d.dia)).size >= 2 ? (
          <GraficoOfertasPorDia serie={serie} />
        ) : (
          <p className="text-[0.9rem] text-gris">
            El gráfico de ofertas por día aparece cuando haya ofertas válidas en al menos dos días distintos.
          </p>
        )}
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Accesos rápidos
// ---------------------------------------------------------------------------

const ACCESOS: { href: string; texto: string; detalle: string; Icono: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/admin/obras/nueva", texto: "Nueva obra", detalle: "Cargar una obra", Icono: IconoMas },
  { href: "/admin/ofertas", texto: "Ofertas", detalle: "Todas las ofertas", Icono: IconoMartillo },
  { href: "/admin/oferentes", texto: "Oferentes", detalle: "Buscar personas", Icono: IconoPersonas },
  { href: "/admin/configuracion", texto: "Configuración", detalle: "Fechas y montos", Icono: IconoAjustes },
  { href: "/admin/exportar", texto: "Listado final", detalle: "Para el martillero", Icono: IconoListado },
  { href: "/admin/qr", texto: "Carteles QR", detalle: "Para imprimir", Icono: IconoQr },
];

function AccesosRapidos() {
  return (
    <nav aria-labelledby="titulo-accesos">
      <h2 id="titulo-accesos" className="mb-3 text-[1.05rem] text-tinta">
        Accesos rápidos
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {ACCESOS.map(({ href, texto, detalle, Icono }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full min-h-14 items-center gap-3 rounded-lg bg-white p-3.5 shadow-tarjeta ring-1 ring-linea transition-[transform,box-shadow] duration-200 ease-suave hover:-translate-y-0.5 hover:shadow-elevada hover:ring-smt/30 motion-reduce:hover:translate-y-0"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-smt-suave text-[1.2rem] text-smt transition-colors duration-200 group-hover:bg-smt group-hover:text-white"
              >
                <Icono />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block font-semibold text-tinta">{texto}</span>
                <span className="block text-[0.82rem] text-gris">{detalle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Últimas ofertas
// ---------------------------------------------------------------------------

async function UltimasOfertas() {
  const admin = await requerirAdmin();
  const [ofertas, estado] = await Promise.all([ultimasOfertas(admin, 10), estadoSubasta()]);

  return (
    <section aria-labelledby="titulo-ultimas" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="titulo-ultimas" className="text-[1.05rem] text-tinta">
          Últimas ofertas
        </h2>
        <Link href="/admin/ofertas" className="enlace-sutil text-[0.94rem] text-azul">
          Ver todas las ofertas
          <IconoFlecha />
        </Link>
      </div>
      {ofertas.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay ofertas." icono={IconoMartillo}>
          Las ofertas aparecen acá apenas alguien oferta desde el sitio.
        </EstadoVacio>
      ) : (
        <TablaContenedor etiqueta="Últimas ofertas" apilable>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Obra</th>
              <th scope="col">Oferente</th>
              <th scope="col" className="text-right">
                Monto
              </th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ofertas.map((o) => (
              <tr key={o.id}>
                <td data-etiqueta="Hora" className="whitespace-nowrap">
                  <span>
                    <time dateTime={o.creadaAt.toISOString()}>{fechaHoraCorta(o.creadaAt)}</time>
                    <span className="block text-[0.85rem] text-gris">{haceCuanto(o.creadaAt, estado.ahora)}</span>
                  </span>
                </td>
                <td data-etiqueta="Obra">
                  <span>
                    <span className="font-semibold text-tinta">N° {o.numero}</span> · {tituloObra(o.titulo)}
                    <span className="block text-[0.85rem] text-gris">{o.artistaNombre}</span>
                  </span>
                </td>
                <td data-etiqueta="Oferente" className="whitespace-nowrap">
                  Oferente {o.alias}
                </td>
                <td data-etiqueta="Monto" className="text-right font-semibold whitespace-nowrap text-tinta">
                  {pesos(o.monto)}
                </td>
                <td data-etiqueta="Estado">
                  <EstadoDeOferta estado={o.estado} esLaMasAlta={o.esLaMasAlta} />
                </td>
                <td className="text-right">
                  <Link href={`/admin/obras/${o.obraId}/ofertas`} className="boton-tabla">
                    Ver ofertas<span className="sr-only"> de la obra N° {o.numero}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TablaContenedor>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Obras publicadas sin ofertas
// ---------------------------------------------------------------------------

async function SinOfertas() {
  const admin = await requerirAdmin();
  const { publicadas, sinOfertas } = await obrasPublicadasSinOfertas(admin);

  return (
    <Tarjeta titulo={`Obras publicadas sin ofertas (${sinOfertas.length})`} icono={IconoObra}>
      {publicadas === 0 ? (
        <p>
          Todavía no hay obras publicadas.{" "}
          <Link href="/admin/obras" className="enlace">
            Ir a Obras
          </Link>
        </p>
      ) : sinOfertas.length === 0 ? (
        <p className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-verde-suave text-verde">
            <IconoCheck className="text-[0.85rem]" strokeWidth={2.5} />
          </span>
          Todas las obras publicadas tienen al menos una oferta vigente.
        </p>
      ) : (
        <ul className="-my-2.5 divide-y divide-linea">
          {sinOfertas.map((o) => (
            <li key={o.id} className="py-2.5">
              <Link href={`/admin/obras/${o.id}`} className="enlace">
                N° {o.numero} · {tituloObra(o.titulo)}
              </Link>
              <span className="block text-[0.94rem] text-gris">
                {o.artistaNombre} · precio de salida {pesos(o.precioSalida)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Avisos por correo
// ---------------------------------------------------------------------------

async function AvisosCorreo() {
  const admin = await requerirAdmin();
  const a = await resumenAvisos(admin);

  return (
    <Tarjeta titulo="Avisos por correo" icono={IconoCampana}>
      <p className="text-[0.94rem] text-gris">
        Cuando alguien supera una oferta, el sistema le avisa por correo a quien quedó atrás, si tiene los avisos
        activados. El correo sale en el momento y, si falla, el sistema lo vuelve a intentar solo, hasta 5 intentos
        en total.
      </p>
      {a.faltas.length > 0 && (
        <div className="mt-4">
          <Recuadro tono="alerta" titulo="Falta configurar el envío de avisos" rol="note">
            <ul className="list-disc space-y-1 pl-5">
              {a.faltas.includes("correo") && (
                <li>
                  El proveedor de correo (RESEND_API_KEY y CORREO_REMITENTE). Mientras falte, los avisos quedan
                  pendientes y no se envían.
                </li>
              )}
              {a.faltas.includes("url_sitio") && (
                <li>
                  La dirección pública del sitio (NEXT_PUBLIC_URL_SITIO). Mientras falte o sea una dirección local, los
                  avisos quedan pendientes y no se envían.
                </li>
              )}
              {a.faltas.includes("cron") && (
                <li>
                  La clave del reintento automático (CRON_SECRET). Sin ella, los avisos que fallan o quedan pendientes
                  no se vuelven a intentar solos.
                </li>
              )}
            </ul>
            <p className="mt-2">Revisalo con el área técnica.</p>
          </Recuadro>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <ConteoAviso etiqueta="Pendientes" valor={a.pendientes} tono={a.pendientes > 0 ? "ambar" : null} />
        <ConteoAviso etiqueta="Enviados" valor={a.enviados} tono={a.enviados > 0 ? "verde" : null} />
        <ConteoAviso etiqueta="Con error" valor={a.conError} tono={a.conError > 0 ? "rojo" : null} />
      </dl>
      {a.descartados > 0 && (
        <p className="mt-3 text-texto">{cantidad(a.descartados, "aviso descartado", "avisos descartados")}.</p>
      )}
      {a.sinReintentos > 0 && (
        <div className="mt-4">
          <Recuadro tono="error" titulo="Hay avisos que ya no se van a reintentar" rol="note">
            {a.sinReintentos === 1
              ? "1 aviso falló 5 veces."
              : `${numeroConPuntos(a.sinReintentos)} avisos fallaron 5 veces.`}{" "}
            Revisá con el área técnica la configuración del correo.
          </Recuadro>
        </div>
      )}
    </Tarjeta>
  );
}

function ConteoAviso({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono: "ambar" | "verde" | "rojo" | null }) {
  const estilo = {
    ambar: { caja: "bg-ambar-suave", punto: "bg-ambar" },
    verde: { caja: "bg-verde-suave", punto: "bg-verde" },
    rojo: { caja: "bg-rojo-suave", punto: "bg-rojo" },
  };
  const t = tono ? estilo[tono] : { caja: "bg-superficie", punto: "bg-gris-suave" };
  return (
    <div className={`rounded-md px-3.5 py-3 text-tinta sm:px-4 ${t.caja}`}>
      <dt className="flex items-center gap-2 text-[0.88rem] font-semibold">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${t.punto}`} />
        {etiqueta}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold">{numeroConPuntos(valor)}</dd>
    </div>
  );
}
