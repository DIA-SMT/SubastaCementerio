import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, consultar } from "@/lib/db";

// Ofertas para el panel, con los datos de contacto de cada oferente.
// Todas las consultas corren como el integrante del equipo: v_ofertas_admin y
// v_listado_final solo devuelven filas si public.es_admin() es verdadero.

export type EstadoOferta = "valida" | "anulada";

export type OfertaAdmin = {
  id: number;
  obraId: string;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  oferenteId: string;
  alias: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  monto: number;
  creadaAt: Date;
  estado: EstadoOferta;
  anuladaAt: Date | null;
  motivoAnulacion: string | null;
  anuladaPorNombre: string | null;
  /** Es la oferta más alta vigente de su obra. */
  esLaMasAlta: boolean;
  /** Quien ofertó está bloqueado: no puede ofertar más, pero esta oferta sigue valiendo si es válida. */
  bloqueado: boolean;
};

/** Oferta más alta vigente de una obra, con quién la hizo. */
export type MejorOferta = {
  monto: number;
  creadaAt: Date;
  alias: number;
  nombre: string;
  apellido: string;
  /** Quien hizo la oferta está bloqueado (bloquear no anula sus ofertas). */
  bloqueado: boolean;
};

export type ObraConOfertas = {
  id: string;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  publicada: boolean;
  precioSalida: number;
  mejor: MejorOferta | null;
  /** Ofertas válidas (las que cuentan para la subasta). */
  cantidadValidas: number;
  cantidadAnuladas: number;
};

export type ObraOpcion = { id: string; numero: number; titulo: string | null; artistaNombre: string };

export type FiltroEstado = "validas" | "anuladas" | "todas";

export type PaginaOfertas = {
  ofertas: OfertaAdmin[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
};

export type ResultadoAnulacion =
  | { ok: true; obraId: string; mejor: MejorOferta | null; precioSalida: number }
  | { ok: false; codigo: string };

export const OFERTAS_POR_PAGINA = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Evita mandar a la base un identificador mal formado (Postgres lo rechazaría con un error). */
export function esUuid(texto: unknown): texto is string {
  return typeof texto === "string" && UUID.test(texto);
}

type Fila = Record<string, unknown>;

const fecha = (v: unknown) => (v == null ? null : new Date(v as string));
const texto = (v: unknown) => (v == null ? null : String(v));

export const COLUMNAS_OFERTA_ADMIN = `id, obra_id, numero, titulo, artista_nombre, oferente_id, alias_numero,
  nombre, apellido, dni, telefono, email, monto, creada_at, estado, anulada_at,
  motivo_anulacion, anulada_por_nombre, es_la_mas_alta, bloqueado`;

export function aOfertaAdmin(f: Fila): OfertaAdmin {
  return {
    id: Number(f.id),
    obraId: String(f.obra_id),
    numero: Number(f.numero),
    titulo: texto(f.titulo),
    artistaNombre: String(f.artista_nombre),
    oferenteId: String(f.oferente_id),
    alias: Number(f.alias_numero),
    nombre: String(f.nombre),
    apellido: String(f.apellido),
    dni: String(f.dni),
    telefono: String(f.telefono),
    email: String(f.email),
    monto: Number(f.monto),
    creadaAt: new Date(f.creada_at as string),
    estado: f.estado as EstadoOferta,
    anuladaAt: fecha(f.anulada_at),
    motivoAnulacion: texto(f.motivo_anulacion),
    anuladaPorNombre: texto(f.anulada_por_nombre),
    esLaMasAlta: Boolean(f.es_la_mas_alta),
    bloqueado: Boolean(f.bloqueado),
  };
}

function aMejor(f: Fila): MejorOferta | null {
  if (f.precio_base == null) return null;
  return {
    monto: Number(f.precio_base),
    creadaAt: new Date(f.oferta_at as string),
    alias: Number(f.alias_numero),
    nombre: String(f.nombre),
    apellido: String(f.apellido),
    bloqueado: Boolean(f.bloqueado),
  };
}

const SQL_OBRA = `select obra_id, numero, titulo, artista_nombre, publicada, precio_salida, precio_base,
         oferta_at, alias_numero, nombre, apellido, cantidad_ofertas, bloqueado
  from public.v_listado_final where obra_id = $1`;

/**
 * Una obra con todas sus ofertas (válidas y anuladas), de mayor a menor monto.
 * Devuelve null si la obra no existe.
 */
export async function ofertasDeObra(
  admin: Admin,
  obraId: string,
): Promise<{ obra: ObraConOfertas; ofertas: OfertaAdmin[] } | null> {
  if (!esUuid(obraId)) return null;
  return conBase(comoAdmin(admin), async (q) => {
    const [f] = await q(SQL_OBRA, [obraId]);
    if (!f) return null;
    const filas = await q(
      `select ${COLUMNAS_OFERTA_ADMIN} from public.v_ofertas_admin
       where obra_id = $1
       order by monto desc, creada_at asc, id asc`,
      [obraId],
    );
    const ofertas = filas.map(aOfertaAdmin);
    return {
      obra: {
        id: String(f.obra_id),
        numero: Number(f.numero),
        titulo: texto(f.titulo),
        artistaNombre: String(f.artista_nombre),
        publicada: Boolean(f.publicada),
        precioSalida: Number(f.precio_salida),
        mejor: aMejor(f),
        cantidadValidas: Number(f.cantidad_ofertas),
        cantidadAnuladas: ofertas.filter((o) => o.estado === "anulada").length,
      },
      ofertas,
    };
  });
}

/** Una oferta puntual (para el aviso que se muestra después de anularla). */
export async function obtenerOferta(admin: Admin, ofertaId: number): Promise<OfertaAdmin | null> {
  if (!Number.isSafeInteger(ofertaId) || ofertaId <= 0) return null;
  const [f] = await consultar(
    comoAdmin(admin),
    `select ${COLUMNAS_OFERTA_ADMIN} from public.v_ofertas_admin where id = $1::bigint`,
    [String(ofertaId)],
  );
  return f ? aOfertaAdmin(f) : null;
}

/** Obras para el filtro del listado de ofertas (publicadas o no). */
export async function obrasParaFiltro(admin: Admin): Promise<ObraOpcion[]> {
  const filas = await consultar(
    comoAdmin(admin),
    `select ob.id, ob.numero, ob.titulo, ar.nombre as artista_nombre
     from public.obras ob
     join public.artistas ar on ar.id = ob.artista_id
     order by ob.numero`,
  );
  return filas.map((f) => ({
    id: String(f.id),
    numero: Number(f.numero),
    titulo: texto(f.titulo),
    artistaNombre: String(f.artista_nombre),
  }));
}

/** Últimas ofertas de todas las obras, de la más reciente a la más antigua, con filtros. */
export async function listarOfertas(
  admin: Admin,
  filtros: { numeroObra: number | null; estado: FiltroEstado; pagina: number },
): Promise<PaginaOfertas> {
  const estado = filtros.estado === "validas" ? "valida" : filtros.estado === "anuladas" ? "anulada" : null;
  const pagina = Math.max(1, Math.floor(filtros.pagina));
  const condicion = `($1::smallint is null or numero = $1::smallint)
    and ($2::text is null or estado = $2::public.estado_oferta)`;
  return conBase(comoAdmin(admin), async (q) => {
    const [c] = await q<{ total: number }>(
      `select count(*)::int as total from public.v_ofertas_admin where ${condicion}`,
      [filtros.numeroObra, estado],
    );
    const filas = await q(
      `select ${COLUMNAS_OFERTA_ADMIN} from public.v_ofertas_admin
       where ${condicion}
       order by creada_at desc, id desc
       limit $3 offset $4`,
      [filtros.numeroObra, estado, OFERTAS_POR_PAGINA, (pagina - 1) * OFERTAS_POR_PAGINA],
    );
    const total = Number(c?.total ?? 0);
    return {
      ofertas: filas.map(aOfertaAdmin),
      total,
      pagina,
      porPagina: OFERTAS_POR_PAGINA,
      paginas: Math.max(1, Math.ceil(total / OFERTAS_POR_PAGINA)),
    };
  });
}

/**
 * Anula una oferta con public.anular_oferta (no la borra: queda registrada como anulada).
 * Si sale bien, devuelve la nueva oferta más alta de la obra, leída en la misma transacción.
 */
export async function anularOferta(admin: Admin, ofertaId: number, motivo: string): Promise<ResultadoAnulacion> {
  return conBase(comoAdmin(admin), async (q) => {
    const [f] = await q<{ r: { ok: boolean; codigo?: string; obra_id?: string } }>(
      "select public.anular_oferta($1::bigint, $2::text) as r",
      [String(ofertaId), motivo],
    );
    const r = f.r;
    if (!r.ok || !r.obra_id) return { ok: false, codigo: r.codigo ?? "desconocido" };
    const [obra] = await q(SQL_OBRA, [r.obra_id]);
    return {
      ok: true,
      obraId: r.obra_id,
      mejor: obra ? aMejor(obra) : null,
      precioSalida: Number(obra?.precio_salida ?? 0),
    };
  });
}
