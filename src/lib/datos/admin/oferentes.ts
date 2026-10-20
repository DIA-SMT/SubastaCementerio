import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, consultar } from "@/lib/db";
import { aOfertaAdmin, COLUMNAS_OFERTA_ADMIN, esUuid, type OfertaAdmin } from "./ofertas";

// Oferentes para el panel. Los datos personales (DNI, teléfono, correo) solo se muestran
// dentro del panel (Ley 25.326). El equipo solo puede cambiar el bloqueo: la base otorga
// UPDATE únicamente sobre las columnas bloqueado y bloqueo_motivo.

export type OferenteFila = {
  id: string;
  alias: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  creadoAt: Date;
  bloqueado: boolean;
  bloqueoMotivo: string | null;
  esEjemplo: boolean;
  ofertasValidas: number;
  /** Obras en las que tiene la oferta más alta vigente. */
  obrasMasAlta: number;
};

export type OferenteDetalle = OferenteFila & {
  basesVersion: number;
  basesAceptadasAt: Date;
  privacidadAceptadaAt: Date;
  avisosPorCorreo: boolean;
  actualizadoAt: Date;
  ofertasAnuladas: number;
  /** Versión vigente de las bases y condiciones, para comparar con la aceptada. */
  basesVersionVigente: number | null;
};

export type ResultadoBusqueda = { oferentes: OferenteFila[]; total: number; limite: number };

export const LIMITE_BUSQUEDA = 300;

type Fila = Record<string, unknown>;

const COLUMNAS = `o.id, o.alias_numero, o.nombre, o.apellido, o.dni, o.telefono, o.email, o.creado_at,
  o.bloqueado, o.bloqueo_motivo, o.es_ejemplo,
  coalesce(c.validas, 0)::int as ofertas_validas,
  coalesce(c.anuladas, 0)::int as ofertas_anuladas,
  coalesce(c.mas_altas, 0)::int as obras_mas_alta`;

// Conteos por oferente. v_ofertas_admin ya marca cuál es la oferta más alta vigente de cada obra.
const CONTEOS = `left join (
    select oferente_id,
           count(*) filter (where estado = 'valida') as validas,
           count(*) filter (where estado = 'anulada') as anuladas,
           count(*) filter (where es_la_mas_alta) as mas_altas
    from public.v_ofertas_admin
    group by oferente_id
  ) c on c.oferente_id = o.id`;

// Compara sin mayúsculas ni tildes ("PÉREZ" encuentra "perez"). Las mayúsculas acentuadas
// también se traducen, por si lower() de la base no las convierte (depende de la configuración regional).
const SIN_TILDES = (expr: string) =>
  `translate(lower(${expr}), 'áéíóúüàèìòùñÁÉÍÓÚÜÀÈÌÒÙÑ', 'aeiouuaeiounaeiouuaeioun')`;

function aFila(f: Fila): OferenteFila {
  return {
    id: String(f.id),
    alias: Number(f.alias_numero),
    nombre: String(f.nombre),
    apellido: String(f.apellido),
    dni: String(f.dni),
    telefono: String(f.telefono),
    email: String(f.email),
    creadoAt: new Date(f.creado_at as string),
    bloqueado: Boolean(f.bloqueado),
    bloqueoMotivo: f.bloqueo_motivo == null ? null : String(f.bloqueo_motivo),
    esEjemplo: Boolean(f.es_ejemplo),
    ofertasValidas: Number(f.ofertas_validas),
    obrasMasAlta: Number(f.obras_mas_alta),
  };
}

/** Escapa los comodines de LIKE para buscar el texto tal cual. */
function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Busca por nombre, apellido, DNI, correo o alias ("Oferente 12"). Sin texto, lista a todas
 * las personas registradas. El texto viaja siempre como parámetro, nunca concatenado.
 */
export async function buscarOferentes(admin: Admin, busqueda: string): Promise<ResultadoBusqueda> {
  const q = busqueda.trim().slice(0, 100);
  const patron = q ? `%${escaparLike(normalizar(q))}%` : null;
  // DNI escrito con puntos o espacios ("30.000.001").
  const digitos = q.replace(/[\s.]/g, "");
  const patronDni = /^\d{2,8}$/.test(digitos) ? `%${digitos}%` : null;
  const alias = q.match(/^(?:oferente\s*)?(\d{1,6})$/i);
  const params = [patron, patronDni, alias ? Number(alias[1]) : null];
  const condicion = `$1::text is null
    or ${SIN_TILDES("o.nombre || ' ' || o.apellido")} like $1
    or ${SIN_TILDES("o.apellido || ' ' || o.nombre")} like $1
    or lower(o.email) like $1
    or o.dni like $2::text
    or o.alias_numero = $3::int`;

  return conBase(comoAdmin(admin), async (consulta) => {
    const [c] = await consulta<{ total: number }>(
      `select count(*)::int as total from public.oferentes o where ${condicion}`,
      params,
    );
    const filas = await consulta(
      `select ${COLUMNAS}
       from public.oferentes o
       ${CONTEOS}
       where ${condicion}
       order by o.alias_numero
       limit ${LIMITE_BUSQUEDA}`,
      params,
    );
    return { oferentes: filas.map(aFila), total: Number(c?.total ?? 0), limite: LIMITE_BUSQUEDA };
  });
}

export async function obtenerOferente(admin: Admin, id: string): Promise<OferenteDetalle | null> {
  if (!esUuid(id)) return null;
  const [f] = await consultar(
    comoAdmin(admin),
    `select ${COLUMNAS},
            o.bases_version, o.bases_aceptadas_at, o.privacidad_aceptada_at,
            o.avisos_por_correo, o.actualizado_at,
            (select p.version from public.paginas p where p.slug = 'bases-y-condiciones') as bases_version_vigente
     from public.oferentes o
     ${CONTEOS}
     where o.id = $1`,
    [id],
  );
  if (!f) return null;
  return {
    ...aFila(f),
    basesVersion: Number(f.bases_version),
    basesAceptadasAt: new Date(f.bases_aceptadas_at as string),
    privacidadAceptadaAt: new Date(f.privacidad_aceptada_at as string),
    avisosPorCorreo: Boolean(f.avisos_por_correo),
    actualizadoAt: new Date(f.actualizado_at as string),
    ofertasAnuladas: Number(f.ofertas_anuladas),
    basesVersionVigente: f.bases_version_vigente == null ? null : Number(f.bases_version_vigente),
  };
}

/** Todas las ofertas de una persona (válidas y anuladas), de la más reciente a la más antigua. */
export async function ofertasDeOferente(admin: Admin, id: string): Promise<OfertaAdmin[]> {
  if (!esUuid(id)) return [];
  const filas = await consultar(
    comoAdmin(admin),
    `select ${COLUMNAS_OFERTA_ADMIN} from public.v_ofertas_admin
     where oferente_id = $1
     order by creada_at desc, id desc`,
    [id],
  );
  return filas.map(aOfertaAdmin);
}

/**
 * Bloquea (con motivo) o desbloquea a una persona. Bloquear impide nuevas ofertas, pero no
 * anula las existentes. Devuelve false si no se encontró a la persona.
 */
export async function cambiarBloqueo(
  admin: Admin,
  id: string,
  cambio: { bloquear: true; motivo: string } | { bloquear: false },
): Promise<boolean> {
  if (!esUuid(id)) return false;
  const filas = cambio.bloquear
    ? await consultar(
        comoAdmin(admin),
        "update public.oferentes set bloqueado = true, bloqueo_motivo = $2 where id = $1 returning id",
        [id, cambio.motivo],
      )
    : await consultar(
        comoAdmin(admin),
        "update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1 returning id",
        [id],
      );
  return filas.length > 0;
}
