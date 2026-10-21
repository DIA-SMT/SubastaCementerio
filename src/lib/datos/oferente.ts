import "server-only";
import { consultar } from "@/lib/db";
import type { MiOferta, Perfil } from "./tipos";

// Todas las funciones reciben el uid de la sesión ya verificada por el llamador.

const como = (uid: string) => ({ rol: "authenticated", uid }) as const;

export type ResultadoRpc = { ok: boolean; codigo?: string; [clave: string]: unknown };

export async function miPerfil(uid: string): Promise<Perfil | null> {
  const [f] = await consultar(
    como(uid),
    `select alias_numero, nombre, apellido, dni, telefono, email, avisos_por_correo, bloqueado
     from public.oferentes where id = $1`,
    [uid],
  );
  if (!f) return null;
  return {
    aliasNumero: Number(f.alias_numero),
    nombre: String(f.nombre),
    apellido: String(f.apellido),
    dni: String(f.dni),
    telefono: String(f.telefono),
    email: String(f.email),
    avisosPorCorreo: Boolean(f.avisos_por_correo),
    bloqueado: Boolean(f.bloqueado),
  };
}

export async function misOfertas(uid: string): Promise<MiOferta[]> {
  const filas = await consultar(
    como(uid),
    "select * from public.v_mis_ofertas order by creada_at desc",
  );
  return filas.map((f) => ({
    id: Number(f.id),
    numero: Number(f.numero),
    titulo: (f.titulo as string | null) ?? null,
    artistaNombre: String(f.artista_nombre),
    monto: Number(f.monto),
    creadaAt: new Date(f.creada_at as string),
    estado: f.estado as MiOferta["estado"],
    esLaMasAlta: Boolean(f.es_la_mas_alta),
    ofertaActual: f.oferta_actual == null ? null : Number(f.oferta_actual),
    // Sin la migración 20261019140300 la columna no llega: se toma como publicada (comportamiento anterior).
    publicada: f.publicada !== false,
    fase: f.fase as MiOferta["fase"],
  }));
}

export async function registrarOferente(
  uid: string,
  datos: { nombre: string; apellido: string; dni: string; telefono: string; aceptaBases: boolean; aceptaPrivacidad: boolean },
) {
  const [f] = await consultar<{ r: ResultadoRpc }>(
    como(uid),
    "select public.registrar_oferente($1, $2, $3, $4, $5, $6) as r",
    [datos.nombre, datos.apellido, datos.dni, datos.telefono, datos.aceptaBases, datos.aceptaPrivacidad],
  );
  return f.r;
}

export async function actualizarMisDatos(uid: string, telefono: string, avisosPorCorreo: boolean) {
  const [f] = await consultar<{ r: ResultadoRpc }>(
    como(uid),
    "select public.actualizar_mis_datos($1, $2) as r",
    [telefono, avisosPorCorreo],
  );
  return f.r;
}

export async function ofertar(uid: string, obraId: string, monto: number) {
  const [f] = await consultar<{ r: ResultadoRpc }>(como(uid), "select public.ofertar($1, $2) as r", [
    obraId,
    monto,
  ]);
  return f.r;
}
