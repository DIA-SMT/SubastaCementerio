import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, consultar, type Consulta } from "@/lib/db";

// Registro de auditoría (solo lectura). Las consultas corren como el integrante del equipo:
// la política auditoria_admin_lectura exige public.es_admin().

export const POR_PAGINA = 50;

export type FiltrosAuditoria = {
  /** Desde 1. */
  pagina: number;
  tabla: string | null;
  accion: string | null;
  /** Inicio del día "desde" en hora de Tucumán (inclusive). */
  desde: Date | null;
  /** Inicio del día siguiente a "hasta" en hora de Tucumán (exclusivo). */
  hasta: Date | null;
};

export type TipoActor = "admin" | "oferente" | "sistema";

export type FilaJson = Record<string, unknown>;

export type EntradaAuditoria = {
  id: number;
  ocurridoAt: Date;
  actorId: string | null;
  actorTipo: TipoActor;
  accion: string;
  tabla: string | null;
  registroId: string | null;
  antes: FilaJson | null;
  despues: FilaJson | null;
  detalle: unknown;
};

/** Nombres legibles de los registros que aparecen en la página (por id). */
export type Referencias = {
  artistas: Record<string, string>;
  obras: Record<string, { numero: number; titulo: string | null }>;
  oferentes: Record<string, number>;
  admins: Record<string, string>;
};

export type PaginaAuditoria = {
  entradas: EntradaAuditoria[];
  referencias: Referencias;
  total: number;
  pagina: number;
  paginas: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Columnas que guardan el id de otro registro y conviene mostrar con su nombre.
const CLAVES_REFERENCIA = ["artista_id", "obra_id", "oferente_id", "anulada_por", "actualizada_por", "user_id"];

function json(valor: unknown): FilaJson | null {
  if (valor == null) return null;
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor) as FilaJson;
    } catch {
      return null;
    }
  }
  return valor as FilaJson;
}

function detalleJson(valor: unknown): unknown {
  if (typeof valor !== "string") return valor ?? null;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

/** Condiciones de los filtros, siempre con parámetros posicionales $1 a $4. */
const DONDE = `
  ($1::text is null or a.tabla = $1::text)
  and ($2::text is null or a.accion = $2::text)
  and ($3::timestamptz is null or a.ocurrido_at >= $3::timestamptz)
  and ($4::timestamptz is null or a.ocurrido_at < $4::timestamptz)`;

function parametros(f: FiltrosAuditoria) {
  return [f.tabla, f.accion, f.desde?.toISOString() ?? null, f.hasta?.toISOString() ?? null];
}

export async function listarAuditoria(admin: Admin, filtros: FiltrosAuditoria): Promise<PaginaAuditoria> {
  return conBase(comoAdmin(admin), async (q) => {
    const [{ n: total }] = await q<{ n: number }>(
      `select count(*)::int as n from public.auditoria a where ${DONDE}`,
      parametros(filtros),
    );
    const filas = await q(
      `select a.id, a.ocurrido_at, a.actor_id, a.actor_tipo, a.accion, a.tabla, a.registro_id,
              a.antes, a.despues, a.detalle
       from public.auditoria a
       where ${DONDE}
       order by a.ocurrido_at desc, a.id desc
       limit $5::int offset $6::int`,
      [...parametros(filtros), POR_PAGINA, (filtros.pagina - 1) * POR_PAGINA],
    );
    const entradas = filas.map(
      (f): EntradaAuditoria => ({
        id: Number(f.id),
        ocurridoAt: new Date(f.ocurrido_at as string),
        actorId: (f.actor_id as string | null) ?? null,
        actorTipo: f.actor_tipo as TipoActor,
        accion: String(f.accion),
        tabla: (f.tabla as string | null) ?? null,
        registroId: (f.registro_id as string | null) ?? null,
        antes: json(f.antes),
        despues: json(f.despues),
        detalle: detalleJson(f.detalle),
      }),
    );
    return {
      entradas,
      referencias: await buscarReferencias(q, entradas),
      total: Number(total),
      pagina: filtros.pagina,
      paginas: Math.max(1, Math.ceil(Number(total) / POR_PAGINA)),
    };
  });
}

/** Busca los nombres de artistas, obras, oferentes y equipo citados en las entradas. */
async function buscarReferencias(q: Consulta, entradas: EntradaAuditoria[]): Promise<Referencias> {
  const ids = new Set<string>();
  const agregar = (v: unknown) => {
    if (typeof v === "string" && UUID.test(v)) ids.add(v.toLowerCase());
  };
  for (const e of entradas) {
    agregar(e.actorId);
    agregar(e.registroId);
    for (const fila of [e.antes, e.despues]) {
      if (!fila) continue;
      for (const clave of CLAVES_REFERENCIA) agregar(fila[clave]);
    }
  }

  const referencias: Referencias = { artistas: {}, obras: {}, oferentes: {}, admins: {} };
  if (ids.size === 0) return referencias;

  // $1::text::jsonb y no $1::jsonb: postgres.js serializaría otra vez el JSON (ver src/lib/db).
  const filas = await q<{ tipo: string; id: string; texto: string | null; numero: number | null }>(
    `with ids as (
       select distinct value::uuid as id from jsonb_array_elements_text($1::text::jsonb)
     )
     select 'artista'::text as tipo, ar.id::text as id, ar.nombre as texto, null::int as numero
     from public.artistas ar join ids on ids.id = ar.id
     union all
     select 'obra', ob.id::text, ob.titulo, ob.numero::int
     from public.obras ob join ids on ids.id = ob.id
     union all
     select 'oferente', ofe.id::text, null, ofe.alias_numero
     from public.oferentes ofe join ids on ids.id = ofe.id
     union all
     select 'admin', adm.user_id::text, adm.nombre, null
     from public.admins adm join ids on ids.id = adm.user_id`,
    [JSON.stringify([...ids])],
  );
  for (const f of filas) {
    const id = String(f.id).toLowerCase();
    if (f.tipo === "artista") referencias.artistas[id] = String(f.texto ?? "");
    else if (f.tipo === "obra") referencias.obras[id] = { numero: Number(f.numero), titulo: f.texto ?? null };
    else if (f.tipo === "oferente") referencias.oferentes[id] = Number(f.numero);
    else if (f.tipo === "admin") referencias.admins[id] = String(f.texto ?? "");
  }
  return referencias;
}

/** Tablas y acciones que ya aparecen en el registro, para armar los filtros. */
export async function valoresDeFiltro(admin: Admin): Promise<{ tablas: string[]; acciones: string[] }> {
  const [f] = await consultar<{ tablas: unknown; acciones: unknown }>(
    comoAdmin(admin),
    `select
       coalesce((select jsonb_agg(t.tabla order by t.tabla)
                 from (select distinct tabla from public.auditoria where tabla is not null) t), '[]'::jsonb) as tablas,
       coalesce((select jsonb_agg(t.accion order by t.accion)
                 from (select distinct accion from public.auditoria) t), '[]'::jsonb) as acciones`,
  );
  const lista = (v: unknown) => {
    const valor = typeof v === "string" ? (detalleJson(v) as unknown) : v;
    return Array.isArray(valor) ? valor.map(String) : [];
  };
  return { tablas: lista(f?.tablas), acciones: lista(f?.acciones) };
}
