import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, consultar } from "@/lib/db";
import type { SlugPagina } from "@/lib/datos/tipos";
import { normalizarContenido, normalizarTitulo } from "@/app/admin/(panel)/textos/[slug]/reglas";

// Textos editables del sitio (tabla paginas). Todo corre como el integrante del equipo:
// la política paginas_admin_edicion exige public.es_admin(). El disparador versionar_pagina
// sube la versión cuando cambia el título o el contenido, y "auditar" registra cada cambio.

export type PaginaEditable = {
  slug: SlugPagina;
  /** Nombre de la página en el panel. */
  nombre: string;
  /** Ruta en el sitio público. */
  ruta: string;
  /** Quién aprueba el contenido (se recuerda en el editor), si corresponde. */
  aprobacion: string | null;
};

export const PAGINAS_EDITABLES: readonly PaginaEditable[] = [
  { slug: "portada", nombre: "Portada", ruta: "/", aprobacion: null },
  { slug: "como-participar", nombre: "Cómo participar", ruta: "/como-participar", aprobacion: null },
  {
    slug: "bases-y-condiciones",
    nombre: "Bases y condiciones",
    ruta: "/bases-y-condiciones",
    aprobacion:
      "Las bases y condiciones las aprueban la Dirección de Cementerios y el área legal de la Municipalidad. Publicá solo el texto aprobado.",
  },
  {
    slug: "destino",
    nombre: "Destino de lo recaudado",
    ruta: "/destino",
    aprobacion:
      "El destino de lo recaudado lo aprueban la Dirección de Cementerios y el área legal de la Municipalidad. Publicá solo el texto aprobado.",
  },
  {
    slug: "privacidad",
    nombre: "Política de privacidad",
    ruta: "/privacidad",
    aprobacion:
      "El texto final de la política de privacidad (Ley 25.326) lo revisa el área legal de la Municipalidad.",
  },
];

export function paginaEditable(slug: string): PaginaEditable | null {
  return PAGINAS_EDITABLES.find((p) => p.slug === slug) ?? null;
}

export type PaginaResumenAdmin = {
  slug: SlugPagina;
  titulo: string;
  version: number;
  provisorio: boolean;
  actualizadaAt: Date;
  actualizadaPor: string | null;
};

export type PaginaAdmin = PaginaResumenAdmin & { contenido: string };

export type AceptacionesBases = { version: number; cantidad: number }[];

/** Versión y hora del último guardado: identifican qué texto se estaba editando. */
export type MarcaTexto = { version: number; actualizadaAt: Date };

export type ResultadoTexto =
  | ({ ok: true; sinCambios: boolean; subioVersion: boolean } & MarcaTexto)
  | { ok: false; codigo: "no_encontrada" }
  | ({ ok: false; codigo: "conflicto" } & MarcaTexto);

function aResumen(f: Record<string, unknown>): PaginaResumenAdmin {
  return {
    slug: f.slug as SlugPagina,
    titulo: String(f.titulo),
    version: Number(f.version),
    provisorio: Boolean(f.provisorio),
    actualizadaAt: new Date(f.actualizada_at as string),
    actualizadaPor: (f.actualizada_por_nombre as string | null) ?? null,
  };
}

const COLUMNAS = `p.slug, p.titulo, p.version, p.provisorio, p.actualizada_at, ad.nombre as actualizada_por_nombre`;

export async function listarPaginas(admin: Admin): Promise<PaginaResumenAdmin[]> {
  const filas = await consultar(
    comoAdmin(admin),
    `select ${COLUMNAS}
     from public.paginas p
     left join public.admins ad on ad.user_id = p.actualizada_por`,
  );
  return filas.map(aResumen);
}

export async function obtenerPaginaAdmin(admin: Admin, slug: SlugPagina): Promise<PaginaAdmin | null> {
  const [f] = await consultar(
    comoAdmin(admin),
    `select ${COLUMNAS}, p.contenido
     from public.paginas p
     left join public.admins ad on ad.user_id = p.actualizada_por
     where p.slug = $1`,
    [slug],
  );
  return f ? { ...aResumen(f), contenido: String(f.contenido) } : null;
}

/** Cuántos oferentes aceptaron cada versión de las bases y condiciones. */
export async function aceptacionesDeBases(admin: Admin): Promise<AceptacionesBases> {
  const filas = await consultar<{ version: number; cantidad: number }>(
    comoAdmin(admin),
    `select bases_version as version, count(*)::int as cantidad
     from public.oferentes
     group by 1
     order by 1 desc`,
  );
  return filas.map((f) => ({ version: Number(f.version), cantidad: Number(f.cantidad) }));
}

/**
 * Guarda título, contenido y marca de provisorio. `leida` es la versión y la hora del último
 * guardado sobre el que se editó: si otra persona guardó algo mientras tanto (también un cambio
 * de solo la casilla de provisorio, que no sube la versión), no se pisa.
 */
export async function guardarPagina(
  admin: Admin,
  datos: { slug: SlugPagina; titulo: string; contenido: string; provisorio: boolean; leida: MarcaTexto },
): Promise<ResultadoTexto> {
  return conBase(comoAdmin(admin), async (q) => {
    const [actual] = await q(
      "select titulo, contenido, provisorio, version, actualizada_at from public.paginas where slug = $1 for update",
      [datos.slug],
    );
    if (!actual) return { ok: false, codigo: "no_encontrada" };
    const marca: MarcaTexto = {
      version: Number(actual.version),
      actualizadaAt: new Date(actual.actualizada_at as string),
    };
    if (
      marca.version !== datos.leida.version ||
      marca.actualizadaAt.getTime() !== datos.leida.actualizadaAt.getTime()
    ) {
      return { ok: false, codigo: "conflicto", ...marca };
    }

    // Misma normalización que el formulario: diferencias invisibles (espacios al final, saltos
    // de línea de Windows) no cuentan como cambio de texto y no suben la versión de las bases.
    const mismoTexto =
      normalizarTitulo(String(actual.titulo)) === datos.titulo &&
      normalizarContenido(String(actual.contenido)) === datos.contenido;
    if (mismoTexto && Boolean(actual.provisorio) === datos.provisorio) {
      return { ok: true, sinCambios: true, subioVersion: false, ...marca };
    }

    const [f] = mismoTexto
      ? await q(
          `update public.paginas
           set provisorio = $2
           where slug = $1
           returning version, actualizada_at`,
          [datos.slug, datos.provisorio],
        )
      : await q(
          `update public.paginas
           set titulo = $2, contenido = $3, provisorio = $4
           where slug = $1
           returning version, actualizada_at`,
          [datos.slug, datos.titulo, datos.contenido, datos.provisorio],
        );
    if (!f) return { ok: false, codigo: "no_encontrada" };
    const version = Number(f.version);
    return {
      ok: true,
      sinCambios: false,
      subioVersion: version !== marca.version,
      version,
      actualizadaAt: new Date(f.actualizada_at as string),
    };
  });
}
