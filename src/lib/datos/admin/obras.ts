import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, consultar } from "@/lib/db";
import type { Foto } from "@/lib/datos/tipos";

// Obras y fotos para el panel. Todas las consultas corren con la sesión del integrante
// del equipo (las políticas RLS exigen es_admin()).
// La oferta actual y la cantidad de ofertas válidas salen de v_listado_final: es la vista
// del panel con la mejor oferta de cada obra (publicada o no). Solo se leen esas columnas.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Evita mandar a la base un id mal formado (Postgres respondería con un error). */
export function esUuid(texto: unknown): texto is string {
  return typeof texto === "string" && UUID.test(texto);
}

const numeroONulo = (v: unknown) => (v == null ? null : Number(v));

export type ObraEnListado = {
  id: string;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  publicada: boolean;
  esEjemplo: boolean;
  ofertaActual: number | null;
  cantidadOfertas: number;
  cantidadFotos: number;
  portada: Foto | null;
};

export async function listarObrasAdmin(admin: Admin): Promise<ObraEnListado[]> {
  const filas = await consultar(
    comoAdmin(admin),
    `select ob.id, ob.numero, ob.titulo, ob.publicada, ob.es_ejemplo,
            ar.nombre as artista_nombre,
            lf.precio_base as oferta_actual,
            coalesce(lf.cantidad_ofertas, 0)::int as cantidad_ofertas,
            (select count(*)::int from public.obra_fotos f where f.obra_id = ob.id) as cantidad_fotos,
            foto.ruta as portada_ruta, foto.texto_alternativo as portada_alt,
            foto.ancho as portada_ancho, foto.alto as portada_alto
     from public.obras ob
     join public.artistas ar on ar.id = ob.artista_id
     left join public.v_listado_final lf on lf.obra_id = ob.id
     left join lateral (
       select f.ruta, f.texto_alternativo, f.ancho, f.alto
       from public.obra_fotos f
       where f.obra_id = ob.id
       order by f.orden, f.creado_at
       limit 1
     ) foto on true
     order by ob.numero`,
  );
  return filas.map((f) => ({
    id: String(f.id),
    numero: Number(f.numero),
    titulo: (f.titulo as string | null) ?? null,
    artistaNombre: String(f.artista_nombre),
    publicada: Boolean(f.publicada),
    esEjemplo: Boolean(f.es_ejemplo),
    ofertaActual: numeroONulo(f.oferta_actual),
    cantidadOfertas: Number(f.cantidad_ofertas),
    cantidadFotos: Number(f.cantidad_fotos),
    portada: f.portada_ruta
      ? {
          ruta: String(f.portada_ruta),
          alt: String(f.portada_alt ?? ""),
          ancho: numeroONulo(f.portada_ancho),
          alto: numeroONulo(f.portada_alto),
        }
      : null,
  }));
}

export type ObraEnEdicion = {
  id: string;
  numero: number;
  titulo: string | null;
  artistaId: string;
  artistaNombre: string;
  resena: string;
  tecnica: string | null;
  /** Precio de salida propio de la obra; null = se usa el general. */
  precioSalida: number | null;
  publicada: boolean;
  esEjemplo: boolean;
  ofertaActual: number | null;
  cantidadOfertasValidas: number;
  /** Todas las ofertas registradas, incluidas las anuladas: cualquiera impide borrar la obra. */
  cantidadOfertasRegistradas: number;
};

export async function obtenerObraAdmin(admin: Admin, id: string): Promise<ObraEnEdicion | null> {
  if (!esUuid(id)) return null;
  const [f] = await consultar(
    comoAdmin(admin),
    `select ob.id, ob.numero, ob.titulo, ob.artista_id, ar.nombre as artista_nombre,
            ob.resena, ob.tecnica, ob.precio_salida, ob.publicada, ob.es_ejemplo,
            lf.precio_base as oferta_actual,
            coalesce(lf.cantidad_ofertas, 0)::int as cantidad_ofertas,
            (select count(*)::int from public.ofertas o where o.obra_id = ob.id) as ofertas_registradas
     from public.obras ob
     join public.artistas ar on ar.id = ob.artista_id
     left join public.v_listado_final lf on lf.obra_id = ob.id
     where ob.id = $1`,
    [id],
  );
  if (!f) return null;
  return {
    id: String(f.id),
    numero: Number(f.numero),
    titulo: (f.titulo as string | null) ?? null,
    artistaId: String(f.artista_id),
    artistaNombre: String(f.artista_nombre),
    resena: String(f.resena ?? ""),
    tecnica: (f.tecnica as string | null) ?? null,
    precioSalida: numeroONulo(f.precio_salida),
    publicada: Boolean(f.publicada),
    esEjemplo: Boolean(f.es_ejemplo),
    ofertaActual: numeroONulo(f.oferta_actual),
    cantidadOfertasValidas: Number(f.cantidad_ofertas),
    cantidadOfertasRegistradas: Number(f.ofertas_registradas),
  };
}

/** Primer número de obra libre (para sugerirlo al cargar una obra nueva), o null si no hay. */
export async function siguienteNumeroLibre(admin: Admin): Promise<number | null> {
  const [f] = await consultar<{ n: number | null }>(
    comoAdmin(admin),
    `select min(n)::int as n
     from generate_series(1, 999) n
     where not exists (select 1 from public.obras ob where ob.numero = n)`,
  );
  return f?.n == null ? null : Number(f.n);
}

/** Precio de salida general de la configuración (se usa cuando la obra no tiene uno propio). */
export async function precioSalidaGeneral(admin: Admin): Promise<number> {
  const [f] = await consultar<{ precio_salida: number }>(
    comoAdmin(admin),
    "select precio_salida from public.configuracion where id = 1",
  );
  return Number(f?.precio_salida ?? 0);
}

export type DatosObra = {
  numero: number;
  titulo: string | null;
  artistaId: string;
  resena: string;
  tecnica: string | null;
  precioSalida: number | null;
  publicada: boolean;
};

const valoresObra = (d: DatosObra) => [
  d.numero,
  d.titulo,
  d.artistaId,
  d.resena,
  d.tecnica,
  d.precioSalida,
  d.publicada,
];

/** Crea la obra y devuelve su id. Lanza el error de Postgres si el número está repetido. */
export async function crearObra(admin: Admin, datos: DatosObra): Promise<string> {
  const [f] = await consultar<{ id: string }>(
    comoAdmin(admin),
    `insert into public.obras (numero, titulo, artista_id, resena, tecnica, precio_salida, publicada)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    valoresObra(datos),
  );
  return String(f.id);
}

export type ResultadoActualizarObra =
  | { ok: true }
  | { ok: false; motivo: "no_encontrada" }
  | {
      ok: false;
      motivo: "confirmar_despublicar";
      ofertasValidas: number;
      mayorOferta: number;
      /** Identifica lo que se le mostró a la persona: si cambia, se vuelve a pedir la confirmación. */
      clave: string;
    };

/**
 * Guarda los datos de la obra. Despublicar una obra con ofertas válidas la saca del sitio y
 * del listado final: si `confirmacion` no es la clave del aviso que se mostró (cantidad de
 * ofertas y mayor oferta), no guarda y devuelve esos datos para pedir la confirmación.
 * La obra queda bloqueada mientras tanto, igual que en ofertar(): no entra una oferta entre
 * el conteo y el cambio.
 */
export async function actualizarObra(
  admin: Admin,
  id: string,
  datos: DatosObra,
  confirmacion: string | null = null,
): Promise<ResultadoActualizarObra> {
  if (!esUuid(id)) return { ok: false, motivo: "no_encontrada" };
  return conBase(comoAdmin(admin), async (q) => {
    const [actual] = await q<{ publicada: boolean }>(
      "select publicada from public.obras where id = $1 for update",
      [id],
    );
    if (!actual) return { ok: false, motivo: "no_encontrada" };

    if (actual.publicada && !datos.publicada) {
      const [lf] = await q<{ cantidad: number; mayor: number | null }>(
        `select coalesce(cantidad_ofertas, 0)::int as cantidad, precio_base as mayor
         from public.v_listado_final
         where obra_id = $1`,
        [id],
      );
      const ofertasValidas = Number(lf?.cantidad ?? 0);
      if (ofertasValidas > 0) {
        const mayorOferta = Number(lf?.mayor ?? 0);
        const clave = `${ofertasValidas}:${mayorOferta}`;
        if (confirmacion !== clave) {
          return { ok: false, motivo: "confirmar_despublicar", ofertasValidas, mayorOferta, clave };
        }
      }
    }

    const filas = await q(
      `update public.obras
       set numero = $1, titulo = $2, artista_id = $3, resena = $4, tecnica = $5,
           precio_salida = $6, publicada = $7
       where id = $8
       returning id`,
      [...valoresObra(datos), id],
    );
    return filas.length > 0 ? { ok: true } : { ok: false, motivo: "no_encontrada" };
  });
}

export type ResultadoBorrarObra =
  | { ok: true; numero: number; rutasFotos: string[] }
  | { ok: false; motivo: "no_encontrada" }
  | { ok: false; motivo: "con_ofertas"; cantidad: number };

/**
 * Borra la obra y sus filas de fotos (en cascada). Devuelve las rutas de las fotos para
 * borrar los archivos después de confirmar la transacción. Si la obra tiene ofertas
 * (aunque estén anuladas) no se borra: la base también lo impide.
 */
export async function borrarObra(admin: Admin, id: string): Promise<ResultadoBorrarObra> {
  if (!esUuid(id)) return { ok: false, motivo: "no_encontrada" };
  return conBase(comoAdmin(admin), async (q) => {
    const [obra] = await q<{ numero: number }>(
      "select numero from public.obras where id = $1 for update",
      [id],
    );
    if (!obra) return { ok: false, motivo: "no_encontrada" };
    const [ofertas] = await q<{ n: number }>(
      "select count(*)::int as n from public.ofertas where obra_id = $1",
      [id],
    );
    if (Number(ofertas.n) > 0) return { ok: false, motivo: "con_ofertas", cantidad: Number(ofertas.n) };
    const fotos = await q<{ ruta: string }>("select ruta from public.obra_fotos where obra_id = $1", [id]);
    await q("delete from public.obras where id = $1", [id]);
    return { ok: true, numero: Number(obra.numero), rutasFotos: fotos.map((f) => f.ruta) };
  });
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export type FotoEnPanel = {
  id: string;
  ruta: string;
  textoAlternativo: string;
  orden: number;
  ancho: number | null;
  alto: number | null;
};

/** Fotos de la obra en el orden en que se muestran (la primera es la portada). */
export async function listarFotosObra(admin: Admin, obraId: string): Promise<FotoEnPanel[]> {
  if (!esUuid(obraId)) return [];
  const filas = await consultar(
    comoAdmin(admin),
    `select id, ruta, texto_alternativo, orden, ancho, alto
     from public.obra_fotos
     where obra_id = $1
     order by orden, creado_at, id`,
    [obraId],
  );
  return filas.map((f) => ({
    id: String(f.id),
    ruta: String(f.ruta),
    textoAlternativo: String(f.texto_alternativo ?? ""),
    orden: Number(f.orden),
    ancho: numeroONulo(f.ancho),
    alto: numeroONulo(f.alto),
  }));
}

/** Agrega la foto al final. Devuelve false si la obra no existe. */
export async function agregarFotoObra(
  admin: Admin,
  obraId: string,
  foto: { ruta: string; textoAlternativo: string; ancho: number; alto: number },
): Promise<boolean> {
  if (!esUuid(obraId)) return false;
  return conBase(comoAdmin(admin), async (q) => {
    // Bloquea la obra para que dos subidas simultáneas no tomen el mismo orden.
    const [obra] = await q("select id from public.obras where id = $1 for update", [obraId]);
    if (!obra) return false;
    await q(
      `insert into public.obra_fotos (obra_id, ruta, texto_alternativo, orden, ancho, alto)
       select $1::uuid, $2, $3, coalesce(max(f.orden), -1) + 1, $4, $5
       from public.obra_fotos f
       where f.obra_id = $1::uuid`,
      [obraId, foto.ruta, foto.textoAlternativo, foto.ancho, foto.alto],
    );
    return true;
  });
}

/** Devuelve false si la foto no existe. */
export async function cambiarTextoAlternativo(admin: Admin, fotoId: string, texto: string): Promise<boolean> {
  if (!esUuid(fotoId)) return false;
  const filas = await consultar(
    comoAdmin(admin),
    "update public.obra_fotos set texto_alternativo = $1 where id = $2 returning id",
    [texto, fotoId],
  );
  return filas.length > 0;
}

/** Mueve la foto un lugar hacia arriba o hacia abajo y deja el orden numerado 0, 1, 2… */
export async function moverFotoObra(admin: Admin, fotoId: string, direccion: "subir" | "bajar"): Promise<void> {
  if (!esUuid(fotoId)) return;
  await conBase(comoAdmin(admin), async (q) => {
    const [foto] = await q<{ obra_id: string }>("select obra_id from public.obra_fotos where id = $1", [fotoId]);
    if (!foto) return;
    await q("select id from public.obras where id = $1 for update", [foto.obra_id]);
    const fotos = await q<{ id: string; orden: number }>(
      "select id, orden from public.obra_fotos where obra_id = $1 order by orden, creado_at, id",
      [foto.obra_id],
    );
    const ids = fotos.map((f) => String(f.id));
    const desde = ids.indexOf(fotoId);
    const hasta = direccion === "subir" ? desde - 1 : desde + 1;
    if (desde < 0 || hasta < 0 || hasta >= ids.length) return;
    [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];
    for (const [orden, id] of ids.entries()) {
      const anterior = fotos.find((f) => String(f.id) === id)?.orden;
      if (Number(anterior) !== orden) {
        await q("update public.obra_fotos set orden = $1 where id = $2", [orden, id]);
      }
    }
  });
}

/** Borra la fila de la foto y devuelve su ruta (para borrar el archivo), o null si no existía. */
export async function quitarFotoObra(admin: Admin, fotoId: string): Promise<string | null> {
  if (!esUuid(fotoId)) return null;
  const [f] = await consultar<{ ruta: string }>(
    comoAdmin(admin),
    "delete from public.obra_fotos where id = $1 returning ruta",
    [fotoId],
  );
  return f ? String(f.ruta) : null;
}
