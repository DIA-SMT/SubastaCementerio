import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { IconoCheck } from "@/components/Iconos";
import { OrnamentoArco } from "@/components/Ornamentos";
import type { EstadoAccion } from "@/lib/admin/acciones";

// Piezas comunes de las pantallas del panel. Componentes de servidor (sin hooks): también se
// pueden usar desde componentes de cliente.

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Encabezado de cada pantalla del panel: una banda en azul municipal con migas (en las fichas),
 * título, bajada y acciones; el arco del cementerio, casi transparente, como marca de agua.
 * Sin migas, el rótulo «Panel de la subasta» ubica la pantalla. En el celular la banda va de borde a
 * borde, pegada a la barra superior.
 */
export function TituloPanel({
  titulo,
  bajada,
  acciones,
  migas,
}: {
  titulo: ReactNode;
  bajada?: ReactNode;
  acciones?: ReactNode;
  /** Camino hasta esta pantalla, sin incluirla (por ejemplo, Obras para la ficha de una obra). */
  migas?: { href: string; texto: string }[];
}) {
  return (
    <div className="banda-panel relative isolate overflow-hidden px-4 py-6 shadow-tarjeta max-sm:-mx-4 max-sm:-mt-6 sm:rounded-lg sm:px-7 md:py-7 lg:px-9 lg:py-8">
      <OrnamentoArco aria-hidden className="pointer-events-none absolute -right-4 -bottom-14 -z-10 h-[150%] text-white/[0.08]" />
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0">
          {migas ? (
            <nav aria-label="Estás en">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.88rem]">
                <li>
                  <Link href="/admin" className="font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
                    Panel
                  </Link>
                </li>
                {migas.map((m) => (
                  <li key={m.href} className="flex items-center gap-2">
                    <span aria-hidden className="text-white/45">
                      /
                    </span>
                    <Link href={m.href} className="font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
                      {m.texto}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <p className="flex items-center gap-2.5 text-[0.74rem] font-semibold tracking-[0.14em] text-marino-tenue uppercase">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amarillo ring-2 ring-amarillo/30" />
              Panel de la subasta
            </p>
          )}
          <h1 className="mt-2 text-[clamp(1.6rem,1.3rem+1vw,2.2rem)] leading-[1.1] tracking-[-0.025em] text-white">{titulo}</h1>
          {bajada && <p className="mt-2 max-w-3xl text-white/85">{bajada}</p>}
        </div>
        {acciones && (
          <div data-recorrido="acciones" className="flex shrink-0 flex-wrap gap-3">
            {acciones}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bloque con borde para agrupar contenido dentro de una pantalla. */
export function Tarjeta({
  titulo,
  children,
  className = "",
  acciones,
  icono: IconoTitulo,
}: {
  titulo?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Enlace o botón chico a la derecha del título. */
  acciones?: ReactNode;
  icono?: Icono;
}) {
  return (
    // El título también identifica la tarjeta en el recorrido guiado (data-recorrido).
    <section
      data-recorrido={typeof titulo === "string" ? titulo : undefined}
      className={`tarjeta-panel p-5 md:p-6 ${className}`}
    >
      {titulo && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="flex items-center gap-2.5 text-[1.15rem] leading-tight text-tinta">
            {IconoTitulo && <IconoTitulo className="shrink-0 text-[1.2rem] text-smt" />}
            {titulo}
          </h2>
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

/** Campo de formulario con etiqueta, ayuda y error. Pasar el control (input, select, textarea) como hijo. */
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
      </label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1.5 text-[0.94rem] text-gris">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-2 font-semibold text-tinta">
          <span aria-hidden className="mt-[0.45em] h-2.5 w-2.5 shrink-0 rounded-full bg-rojo" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Aviso de resultado de un Server Action (éxito o error general). */
export function MensajeAccion({ estado }: { estado: EstadoAccion }) {
  if (estado.error) {
    return (
      <p
        role="alert"
        className="aviso-panel flex items-start gap-3 rounded-md bg-rojo-suave px-4 py-3 font-semibold text-tinta ring-1 ring-rojo/25 ring-inset"
      >
        <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rojo text-[0.8rem] font-bold text-white">
          !
        </span>
        {estado.error}
      </p>
    );
  }
  if (estado.ok && estado.mensaje) {
    return (
      <p
        role="status"
        className="aviso-panel flex items-start gap-3 rounded-md bg-verde-suave px-4 py-3 font-semibold text-tinta ring-1 ring-verde/25 ring-inset"
      >
        <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verde text-white">
          <IconoCheck className="text-[0.85rem]" strokeWidth={2.5} />
        </span>
        {estado.mensaje}
      </p>
    );
  }
  return null;
}

/**
 * Contenedor de tabla. Con `apilable`, en el celular y la tablet cada fila se lee como una tarjeta (cada
 * celda necesita su data-etiqueta); sin él, la tabla se desplaza de costado en pantallas chicas.
 */
export function TablaContenedor({
  children,
  etiqueta,
  apilable = false,
}: {
  children: ReactNode;
  etiqueta: string;
  apilable?: boolean;
}) {
  return (
    <div className="tarjeta-panel relative overflow-x-auto" role="region" aria-label={etiqueta} tabIndex={0}>
      <table className={`tabla-panel ${apilable ? "tabla-apilable lg:min-w-[40rem]" : "min-w-[40rem]"}`}>{children}</table>
    </div>
  );
}

const TONOS = {
  verde: { fondo: "bg-verde-suave ring-verde/20", punto: "bg-verde" },
  ambar: { fondo: "bg-ambar-suave ring-ambar/25", punto: "bg-ambar" },
  rojo: { fondo: "bg-rojo-suave ring-rojo/20", punto: "bg-rojo" },
  gris: { fondo: "bg-superficie ring-linea", punto: "bg-gris-suave" },
  azul: { fondo: "bg-smt-suave ring-smt/15", punto: "bg-smt" },
} as const;

/** Etiqueta de estado: fondo suave, punto de color y texto en tinta (contraste AA). */
export function Etiqueta({ tono, children }: { tono: keyof typeof TONOS; children: ReactNode }) {
  const t = TONOS[tono];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap text-tinta ring-1 ring-inset ${t.fondo}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.punto}`} />
      {children}
    </span>
  );
}

/**
 * Dato destacado (indicador): ícono, rótulo, número y detalle. Va dentro de un <dl>: el rótulo es
 * el <dt> y el número y el detalle, los <dd>.
 */
export function Dato({
  etiqueta,
  valor,
  icono: IconoDato,
  tono = "azul",
  compacto = false,
  children,
  className = "",
}: {
  etiqueta: ReactNode;
  valor: ReactNode;
  icono?: Icono;
  /** Color del ícono: azul municipal, amarillo (acento) o ámbar (algo para revisar). */
  tono?: "azul" | "amarillo" | "ambar";
  /** En el celular, sin ícono y con el número más chico (para tres datos en una fila). */
  compacto?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const fondoIcono = {
    azul: "bg-smt-suave text-smt",
    amarillo: "bg-amarillo/25 text-marino",
    ambar: "bg-ambar-suave text-tinta",
  }[tono];
  return (
    <div className={`tarjeta-panel flex gap-4 ${compacto ? "p-3.5 sm:p-5" : "p-5"} ${className}`}>
      {IconoDato && (
        <span
          aria-hidden
          className={`h-11 w-11 shrink-0 items-center justify-center rounded-md text-[1.35rem] ${compacto ? "hidden sm:flex" : "flex"} ${fondoIcono}`}
        >
          <IconoDato />
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <dt className={`font-medium text-gris ${compacto ? "text-[0.8rem] leading-snug sm:text-[0.94rem]" : "text-[0.94rem]"}`}>{etiqueta}</dt>
        <dd
          className={`order-first leading-tight font-semibold tracking-[-0.02em] text-tinta ${compacto ? "text-[1.6rem] sm:text-[2rem]" : "text-[2rem]"}`}
        >
          {valor}
        </dd>
        {children && <dd className="mt-1.5 text-[0.9rem] text-gris">{children}</dd>}
      </div>
    </div>
  );
}

/** Pestañas hechas con enlaces (cada una es una dirección: se pueden compartir y volver atrás). */
export function Pestanas({
  etiqueta,
  pestanas,
}: {
  etiqueta: string;
  pestanas: { href: string; texto: ReactNode; activa: boolean }[];
}) {
  return (
    <nav aria-label={etiqueta} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b border-linea">
        {pestanas.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={p.activa ? "page" : undefined}
              className={`relative -mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-[0.95rem] font-semibold transition-colors duration-200 ${
                p.activa ? "border-smt text-smt-intenso" : "border-transparent text-gris hover:border-linea hover:text-tinta"
              }`}
            >
              {p.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Pantalla o tabla sin contenido: qué pasa y, si hay, qué hacer. */
export function EstadoVacio({
  titulo,
  children,
  accion,
  icono: IconoVacio,
}: {
  titulo: ReactNode;
  children?: ReactNode;
  accion?: ReactNode;
  icono?: Icono;
}) {
  return (
    <div className="tarjeta-panel flex flex-col items-center px-6 py-10 text-center">
      {IconoVacio && (
        <span aria-hidden className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-smt-suave text-[1.6rem] text-smt">
          <IconoVacio />
        </span>
      )}
      <p className="text-lg font-semibold text-tinta">{titulo}</p>
      {children && <div className="mt-1.5 max-w-md text-gris">{children}</div>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function Esqueleto({ alto = "h-64" }: { alto?: string }) {
  return <div className={`${alto} esqueleto rounded-lg`} aria-busy="true" aria-label="Cargando" />;
}

/** Carga de una tabla: encabezado y filas grises. */
export function EsqueletoTabla({ filas = 6 }: { filas?: number }) {
  return (
    <div className="tarjeta-panel overflow-hidden" aria-busy="true" aria-label="Cargando">
      <div className="h-11 bg-superficie" />
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-linea px-4 py-4">
          <div className="esqueleto h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="esqueleto h-3.5 w-2/5" />
            <div className="esqueleto h-3 w-1/4" />
          </div>
          <div className="esqueleto hidden h-3.5 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Carga de una fila de indicadores. */
export function EsqueletoDatos({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="tarjeta-panel flex gap-4 p-5">
          <div className="esqueleto h-11 w-11 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="esqueleto h-7 w-16" />
            <div className="esqueleto h-3.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
