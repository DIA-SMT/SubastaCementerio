import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, consultar } from "@/lib/db";
import { esUuid } from "./obras";

// Artistas para el panel. Todas las consultas corren con la sesión del integrante del equipo.

// Orden alfabético en castellano, sin distinguir mayúsculas ni tildes ("Álvarez" va con la A)
// y con los números en orden natural. La base local (PGlite) ordena por código de carácter.
const alfabetico = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const porNombre = (a: { nombre: string }, b: { nombre: string }) => alfabetico.compare(a.nombre, b.nombre);

export type ArtistaEnListado = {
  id: string;
  nombre: string;
  esEjemplo: boolean;
  cantidadObras: number;
  tieneFoto: boolean;
};

export async function listarArtistasAdmin(admin: Admin): Promise<ArtistaEnListado[]> {
  const filas = await consultar(
    comoAdmin(admin),
    `select a.id, a.nombre, a.es_ejemplo, a.foto_ruta is not null as tiene_foto,
            (select count(*)::int from public.obras ob where ob.artista_id = a.id) as cantidad_obras
     from public.artistas a
     order by a.nombre, a.id`,
  );
  return filas
    .map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      esEjemplo: Boolean(f.es_ejemplo),
      cantidadObras: Number(f.cantidad_obras),
      tieneFoto: Boolean(f.tiene_foto),
    }))
    .sort(porNombre);
}

export type OpcionArtista = { id: string; nombre: string };

/** Para el selector de artista del formulario de obras, ordenado por nombre. */
export async function opcionesDeArtistas(admin: Admin): Promise<OpcionArtista[]> {
  const filas = await consultar<{ id: string; nombre: string }>(
    comoAdmin(admin),
    "select id, nombre from public.artistas order by nombre, id",
  );
  return filas.map((f) => ({ id: String(f.id), nombre: String(f.nombre) })).sort(porNombre);
}

export type ArtistaEnEdicion = {
  id: string;
  nombre: string;
  resena: string;
  enlace: string | null;
  fotoRuta: string | null;
  esEjemplo: boolean;
  obras: { id: string; numero: number; titulo: string | null; publicada: boolean }[];
};

export async function obtenerArtistaAdmin(admin: Admin, id: string): Promise<ArtistaEnEdicion | null> {
  if (!esUuid(id)) return null;
  return conBase(comoAdmin(admin), async (q) => {
    const [f] = await q(
      "select id, nombre, resena, enlace, foto_ruta, es_ejemplo from public.artistas where id = $1",
      [id],
    );
    if (!f) return null;
    const obras = await q<{ id: string; numero: number; titulo: string | null; publicada: boolean }>(
      "select id, numero, titulo, publicada from public.obras where artista_id = $1 order by numero",
      [id],
    );
    return {
      id: String(f.id),
      nombre: String(f.nombre),
      resena: String(f.resena ?? ""),
      enlace: (f.enlace as string | null) ?? null,
      fotoRuta: (f.foto_ruta as string | null) ?? null,
      esEjemplo: Boolean(f.es_ejemplo),
      obras: obras.map((o) => ({
        id: String(o.id),
        numero: Number(o.numero),
        titulo: o.titulo ?? null,
        publicada: Boolean(o.publicada),
      })),
    };
  });
}

export type DatosArtista = { nombre: string; resena: string; enlace: string | null };

export async function crearArtista(admin: Admin, datos: DatosArtista): Promise<string> {
  const [f] = await consultar<{ id: string }>(
    comoAdmin(admin),
    "insert into public.artistas (nombre, resena, enlace) values ($1, $2, $3) returning id",
    [datos.nombre, datos.resena, datos.enlace],
  );
  return String(f.id);
}

/** Devuelve false si el artista no existe. */
export async function actualizarArtista(admin: Admin, id: string, datos: DatosArtista): Promise<boolean> {
  if (!esUuid(id)) return false;
  const filas = await consultar(
    comoAdmin(admin),
    "update public.artistas set nombre = $1, resena = $2, enlace = $3 where id = $4 returning id",
    [datos.nombre, datos.resena, datos.enlace, id],
  );
  return filas.length > 0;
}

/**
 * Cambia (o quita, con null) la foto del artista. Devuelve la ruta anterior para borrar
 * el archivo después de confirmar la transacción.
 */
export async function cambiarFotoArtista(
  admin: Admin,
  id: string,
  ruta: string | null,
): Promise<{ encontrado: boolean; anterior: string | null }> {
  if (!esUuid(id)) return { encontrado: false, anterior: null };
  return conBase(comoAdmin(admin), async (q) => {
    const [actual] = await q<{ foto_ruta: string | null }>(
      "select foto_ruta from public.artistas where id = $1 for update",
      [id],
    );
    if (!actual) return { encontrado: false, anterior: null };
    await q("update public.artistas set foto_ruta = $1 where id = $2", [ruta, id]);
    return { encontrado: true, anterior: actual.foto_ruta ?? null };
  });
}

export type ResultadoBorrarArtista =
  | { ok: true; nombre: string; fotoRuta: string | null }
  | { ok: false; motivo: "no_encontrado" }
  | { ok: false; motivo: "con_obras"; cantidad: number };

/** Solo se borra si no tiene obras asignadas (la base también lo impide). */
export async function borrarArtista(admin: Admin, id: string): Promise<ResultadoBorrarArtista> {
  if (!esUuid(id)) return { ok: false, motivo: "no_encontrado" };
  return conBase(comoAdmin(admin), async (q) => {
    const [artista] = await q<{ nombre: string; foto_ruta: string | null }>(
      "select nombre, foto_ruta from public.artistas where id = $1 for update",
      [id],
    );
    if (!artista) return { ok: false, motivo: "no_encontrado" };
    const [obras] = await q<{ n: number }>(
      "select count(*)::int as n from public.obras where artista_id = $1",
      [id],
    );
    if (Number(obras.n) > 0) return { ok: false, motivo: "con_obras", cantidad: Number(obras.n) };
    await q("delete from public.artistas where id = $1", [id]);
    return { ok: true, nombre: String(artista.nombre), fotoRuta: artista.foto_ruta ?? null };
  });
}
