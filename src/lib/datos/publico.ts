import "server-only";
import { cache } from "react";
import { conBase, consultar, type Contexto } from "@/lib/db";
import type {
  EstadoSubasta,
  Foto,
  ObraDetalle,
  ObraResumen,
  OfertaPublica,
  Pagina,
  SlugPagina,
} from "./tipos";

const ctx = (uid?: string | null): Contexto => (uid ? { rol: "authenticated", uid } : { rol: "anon" });
const fecha = (v: unknown) => (v == null ? null : new Date(v as string));

type FilaObra = Record<string, unknown>;

function aResumen(f: FilaObra): ObraResumen {
  return {
    id: String(f.id),
    numero: Number(f.numero),
    titulo: (f.titulo as string | null) ?? null,
    artistaNombre: String(f.artista_nombre),
    precioSalida: Number(f.precio_salida),
    ofertaActual: f.oferta_actual == null ? null : Number(f.oferta_actual),
    ofertaActualAt: fecha(f.oferta_actual_at),
    ofertaActualAlias: f.oferta_actual_alias == null ? null : Number(f.oferta_actual_alias),
    ofertaActualEsMia: Boolean(f.oferta_actual_es_mia),
    cantidadOfertas: Number(f.cantidad_ofertas),
    minimoSiguiente: Number(f.minimo_siguiente),
    portada: f.portada_ruta
      ? {
          ruta: String(f.portada_ruta),
          alt: String(f.portada_alt ?? ""),
          ancho: f.portada_ancho == null ? null : Number(f.portada_ancho),
          alto: f.portada_alto == null ? null : Number(f.portada_alto),
        }
      : null,
    esEjemplo: Boolean(f.es_ejemplo),
  };
}

export const estadoSubasta = cache(async (): Promise<EstadoSubasta> => {
  const [f] = await consultar(
    { rol: "anon" },
    `select inicio_virtual, cierre_virtual, fechas_confirmadas,
            to_char(fecha_presencial, 'YYYY-MM-DD') as fecha_presencial, detalle_presencial,
            incremento_minimo, precio_salida, modo_ejemplo, fase, ahora
     from public.v_estado_subasta`,
  );
  return {
    inicio: new Date(f.inicio_virtual as string),
    cierre: new Date(f.cierre_virtual as string),
    fechasConfirmadas: Boolean(f.fechas_confirmadas),
    fechaPresencial: (f.fecha_presencial as string | null) ?? null,
    detallePresencial: (f.detalle_presencial as string | null) ?? null,
    incrementoMinimo: Number(f.incremento_minimo),
    precioSalida: Number(f.precio_salida),
    modoEjemplo: Boolean(f.modo_ejemplo),
    fase: f.fase as EstadoSubasta["fase"],
    ahora: new Date(f.ahora as string),
  };
});

export async function listarObras(uid?: string | null): Promise<ObraResumen[]> {
  const filas = await consultar(ctx(uid), "select * from public.v_obras_publicas order by numero");
  return filas.map(aResumen);
}

export async function obtenerObra(numero: number, uid?: string | null): Promise<ObraDetalle | null> {
  return conBase(ctx(uid), async (q) => {
    const [f] = await q("select * from public.v_obras_publicas where numero = $1", [numero]);
    if (!f) return null;
    const fotos = await q<{ ruta: string; texto_alternativo: string; ancho: number | null; alto: number | null }>(
      "select ruta, texto_alternativo, ancho, alto from public.v_fotos_publicas where obra_id = $1 order by orden",
      [f.id],
    );
    return {
      ...aResumen(f),
      resena: String(f.resena ?? ""),
      tecnica: (f.tecnica as string | null) ?? null,
      artistaResena: String(f.artista_resena ?? ""),
      artistaEnlace: (f.artista_enlace as string | null) ?? null,
      artistaFotoRuta: (f.artista_foto_ruta as string | null) ?? null,
      fotos: fotos.map(
        (x): Foto => ({ ruta: x.ruta, alt: x.texto_alternativo, ancho: x.ancho, alto: x.alto }),
      ),
    };
  });
}

export async function historialDeObra(obraId: string, uid?: string | null): Promise<OfertaPublica[]> {
  const filas = await consultar(
    ctx(uid),
    `select id, alias_numero, monto, creada_at, es_propia
     from public.v_historial_publico where obra_id = $1
     order by monto desc, creada_at`,
    [obraId],
  );
  return filas.map((f) => ({
    id: Number(f.id),
    alias: Number(f.alias_numero),
    monto: Number(f.monto),
    creadaAt: new Date(f.creada_at as string),
    esPropia: Boolean(f.es_propia),
  }));
}

export const obtenerPagina = cache(async (slug: SlugPagina): Promise<Pagina | null> => {
  const [f] = await consultar(
    { rol: "anon" },
    "select slug, titulo, contenido, provisorio, version from public.paginas where slug = $1",
    [slug],
  );
  if (!f) return null;
  return {
    slug: f.slug as SlugPagina,
    titulo: String(f.titulo),
    contenido: String(f.contenido),
    provisorio: Boolean(f.provisorio),
    version: Number(f.version),
  };
});
