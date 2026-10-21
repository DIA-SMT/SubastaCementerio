import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Recuadro } from "@/components/Avisos";
import { EstadoChip } from "@/components/EstadoChip";
import { Plazo } from "@/components/Plazo";
import { Esqueleto, TablaContenedor, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { requerirAdmin } from "@/lib/admin/sesion";
import { indicadoresTablero, obrasPublicadasSinOfertas, resumenAvisos, ultimasOfertas } from "@/lib/datos/admin/tablero";
import { estadoSubasta } from "@/lib/datos/publico";
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

/** "1 oferta" / "3 ofertas" */
function cantidad(n: number, singular: string, plural: string) {
  return `${numeroConPuntos(n)} ${n === 1 ? singular : plural}`;
}

export default function PaginaTablero() {
  return (
    <div className="space-y-8">
      <TituloPanel
        titulo="Tablero"
        bajada="Cómo viene la etapa virtual. Los números se calculan cada vez que abrís esta página."
        acciones={
          <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-3">
            <Link href="/admin/configuracion" className="boton-secundario">
              Configuración
            </Link>
            <Link href="/admin/exportar" className="boton-secundario">
              Listado final
            </Link>
            <Link href="/admin/qr" className="boton-secundario">
              Carteles QR
            </Link>
          </nav>
        }
      />

      <Suspense fallback={<Esqueleto alto="h-40" />}>
        <EstadoEtapa />
      </Suspense>

      <Suspense fallback={<Esqueleto alto="h-96" />}>
        <Indicadores />
      </Suspense>

      <Suspense fallback={<Esqueleto />}>
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
// Estado de la etapa virtual
// ---------------------------------------------------------------------------

async function EstadoEtapa() {
  await requerirAdmin();
  const estado = await estadoSubasta();
  return (
    <Tarjeta titulo="Estado de la etapa virtual">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <EstadoChip fase={estado.fase} />
          <Plazo estado={estado} />
        </div>
        <dl className="grid content-start gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold text-tinta">Inicio</dt>
          <dd>
            {fechaHoraLarga(estado.inicio)}
            {!estado.fechasConfirmadas && " (sin confirmar)"}
          </dd>
          <dt className="font-semibold text-tinta">Cierre</dt>
          <dd>
            {fechaHoraLarga(estado.cierre)}
            {!estado.fechasConfirmadas && " (sin confirmar)"}
          </dd>
          <dt className="font-semibold text-tinta">Extensión del cierre</dt>
          <dd>
            {estado.extension
              ? `Activa: una oferta en los últimos ${estado.extension.minutos} minutos extiende el cierre de esa obra`
              : "Apagada"}
          </dd>
          {estado.cierreFinal > estado.cierre && (
            <>
              <dt className="font-semibold text-tinta">Última obra en cerrar</dt>
              <dd>
                {fechaHoraLarga(estado.cierreFinal)}, por ofertas de último momento
              </dd>
            </>
          )}
          <dt className="font-semibold text-tinta">Subasta presencial</dt>
          <dd>
            {estado.fechaPresencial ? fechaLarga(estado.fechaPresencial) : "A confirmar"}
            {estado.fechaPresencial && estado.detallePresencial && (
              <span className="block text-texto">{estado.detallePresencial}</span>
            )}
          </dd>
          <dt className="font-semibold text-tinta">Incremento mínimo</dt>
          <dd>{pesos(estado.incrementoMinimo)}</dd>
          <dt className="font-semibold text-tinta">Precio de salida</dt>
          <dd>{pesos(estado.precioSalida)} (salvo las obras que tengan uno propio)</dd>
        </dl>
      </div>
      <p className="mt-4 text-texto">Todas las horas son de Tucumán.</p>
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

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

async function Indicadores() {
  const admin = await requerirAdmin();
  const i = await indicadoresTablero(admin);
  const proporcion = i.obrasPublicadas > 0 ? Math.round((i.obrasConOfertas / i.obrasPublicadas) * 100) : 0;

  return (
    <section aria-labelledby="titulo-indicadores">
      <h2 id="titulo-indicadores" className="mb-4 text-xl">
        Indicadores
      </h2>
      <dl className="grid gap-4 md:grid-cols-3">
        <Indicador
          etiqueta="Monto acumulado"
          valor={pesos(i.montoAcumulado)}
          destacado
          className="md:col-span-3"
        >
          Es la suma de la oferta más alta vigente de cada obra publicada. Sirve como referencia: la plataforma
          no cobra ni procesa pagos, y la oferta más alta de cada obra pasa a ser el precio base de la subasta
          presencial.
        </Indicador>

        <Indicador etiqueta="Ofertas válidas" valor={numeroConPuntos(i.ofertasValidas)}>
          {i.ofertasAnuladas === 0
            ? "No hay ofertas anuladas."
            : `Aparte, ${cantidad(i.ofertasAnuladas, "oferta anulada, que no se cuenta", "ofertas anuladas, que no se cuentan")}.`}
        </Indicador>

        <Indicador etiqueta="Oferentes registrados" valor={numeroConPuntos(i.oferentesRegistrados)}>
          <span className="block">
            {i.oferentesConOfertas === 1
              ? "1 ofertó al menos una vez."
              : `${numeroConPuntos(i.oferentesConOfertas)} ofertaron al menos una vez.`}
          </span>
          <span className="mt-1 block">
            {i.ingresosSinRegistro === 0
              ? "No hay ingresos sin completar el registro."
              : `${cantidad(
                  i.ingresosSinRegistro,
                  "ingreso sin completar el registro",
                  "ingresos sin completar el registro",
                )} (empezaron a ingresar con su correo, pero todavía no cargaron sus datos).`}
          </span>
        </Indicador>

        <Indicador
          etiqueta="Obras con ofertas"
          valor={
            <>
              {numeroConPuntos(i.obrasConOfertas)}{" "}
              <span className="text-2xl font-semibold text-texto">de {numeroConPuntos(i.obrasPublicadas)}</span>
            </>
          }
        >
          {i.obrasPublicadas === 0 ? (
            "Todavía no hay obras publicadas."
          ) : (
            <>
              <span aria-hidden className="mb-2 block h-3 overflow-hidden rounded-full bg-azul/15">
                <span className="block h-full rounded-full bg-azul" style={{ width: `${proporcion}%` }} />
              </span>
              {i.obrasPublicadas === 1
                ? "Obra publicada con al menos una oferta vigente."
                : `Obras publicadas con al menos una oferta vigente (${proporcion} %).`}
            </>
          )}
        </Indicador>
      </dl>
    </section>
  );
}

function Indicador({
  etiqueta,
  valor,
  destacado = false,
  className = "",
  children,
}: {
  etiqueta: string;
  valor: ReactNode;
  destacado?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  // El grupo dt/dd va directo dentro del <div> hijo del <dl> (HTML válido). En el destacado,
  // la explicación pasa a una segunda columna en pantallas medianas.
  return (
    <div
      className={`rounded-lg border border-linea bg-white p-5 ${
        destacado ? "md:grid md:grid-cols-[auto_1fr] md:gap-x-10" : "flex flex-col"
      } ${className}`}
    >
      <dt className="flex items-center gap-2 font-semibold text-tinta">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${destacado ? "bg-dorado-suave" : "bg-azul"}`} />
        {etiqueta}
      </dt>
      <dd className={`mt-1 font-display leading-tight font-semibold tracking-[-0.02em] text-tinta tabular-nums ${destacado ? "text-4xl sm:text-5xl" : "text-4xl"}`}>
        {valor}
      </dd>
      {children && (
        <dd
          className={`mt-3 text-base text-texto ${
            destacado ? "md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:self-center" : ""
          }`}
        >
          {children}
        </dd>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Últimas ofertas
// ---------------------------------------------------------------------------

async function UltimasOfertas() {
  const admin = await requerirAdmin();
  const [ofertas, estado] = await Promise.all([ultimasOfertas(admin, 10), estadoSubasta()]);

  return (
    <section aria-labelledby="titulo-ultimas" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="titulo-ultimas" className="text-xl">
          Últimas ofertas
        </h2>
        <Link href="/admin/ofertas" className="enlace">
          Ver todas las ofertas
        </Link>
      </div>
      {ofertas.length === 0 ? (
        <p className="rounded-lg border border-linea bg-white p-5">Todavía no hay ofertas.</p>
      ) : (
        <TablaContenedor etiqueta="Últimas ofertas">
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
                <td className="whitespace-nowrap">
                  <time dateTime={o.creadaAt.toISOString()}>{fechaHoraCorta(o.creadaAt)}</time>
                  <span className="block text-sm text-gris">{haceCuanto(o.creadaAt, estado.ahora)}</span>
                </td>
                <td>
                  <span className="font-semibold text-tinta">N° {o.numero}</span> · {tituloObra(o.titulo)}
                  <span className="block text-sm text-gris">{o.artistaNombre}</span>
                </td>
                <td className="whitespace-nowrap">Oferente {o.alias}</td>
                <td className="text-right font-semibold whitespace-nowrap text-tinta tabular-nums">{pesos(o.monto)}</td>
                <td>
                  <EstadoDeOferta estado={o.estado} esLaMasAlta={o.esLaMasAlta} />
                </td>
                <td>
                  <Link href={`/admin/obras/${o.obraId}/ofertas`} className="enlace whitespace-nowrap">
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
    <Tarjeta titulo={`Obras publicadas sin ofertas (${sinOfertas.length})`}>
      {publicadas === 0 ? (
        <p>
          Todavía no hay obras publicadas.{" "}
          <Link href="/admin/obras" className="enlace">
            Ir a Obras
          </Link>
        </p>
      ) : sinOfertas.length === 0 ? (
        <p>Todas las obras publicadas tienen al menos una oferta vigente.</p>
      ) : (
        <ul className="divide-y divide-linea">
          {sinOfertas.map((o) => (
            <li key={o.id} className="py-2.5 first:pt-0 last:pb-0">
              <Link href={`/admin/obras/${o.id}`} className="enlace">
                N° {o.numero} · {tituloObra(o.titulo)}
              </Link>
              <span className="block text-base text-texto">
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
    <Tarjeta titulo="Avisos por correo">
      <p className="text-texto">
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
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ConteoAviso etiqueta="Pendientes" valor={a.pendientes} fondo={a.pendientes > 0 ? "bg-ambar-suave" : "bg-fondo"} />
        <ConteoAviso etiqueta="Enviados" valor={a.enviados} fondo={a.enviados > 0 ? "bg-verde-suave" : "bg-fondo"} />
        <ConteoAviso etiqueta="Con error" valor={a.conError} fondo={a.conError > 0 ? "bg-rojo-suave" : "bg-fondo"} />
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

function ConteoAviso({ etiqueta, valor, fondo }: { etiqueta: string; valor: number; fondo: string }) {
  return (
    <div className={`rounded-md px-4 py-3 text-tinta ${fondo}`}>
      <dt className="font-semibold">{etiqueta}</dt>
      <dd className="text-3xl font-semibold">{numeroConPuntos(valor)}</dd>
    </div>
  );
}
