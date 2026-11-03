import "server-only";
import { consultar } from "@/lib/db";
import type { MiOferta, Perfil, PersonaCidituc } from "./tipos";

// Todas las funciones reciben el uid de la sesión ya verificada por el llamador.

const como = (uid: string) => ({ rol: "authenticated", uid }) as const;
const servicio = { rol: "servicio" } as const;

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

export type DatosCidituc = {
  ciditucId: string;
  cuil: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string | null;
};

/**
 * Guarda (o actualiza) a la persona que Cidituc acaba de validar y devuelve su id, que es el
 * uid de la sesión y de las políticas RLS. Corre como el servidor: el token ya se validó en el
 * callback y todavía no hay sesión. Tira si la base no responde.
 */
export async function registrarIngresoCidituc(datos: DatosCidituc): Promise<string> {
  const [f] = await consultar<{ id: string }>(
    servicio,
    `insert into public.personas (cidituc_id, cuil, dni, nombre, apellido, email)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (cidituc_id) do update set
       cuil = excluded.cuil, dni = excluded.dni, nombre = excluded.nombre,
       apellido = excluded.apellido, email = excluded.email, ultimo_ingreso_at = now()
     returning id`,
    [datos.ciditucId, datos.cuil, datos.dni, datos.nombre, datos.apellido, datos.email],
  );
  return f.id;
}

/** ¿La persona ya completó el registro de oferente? */
export async function esOferente(uid: string) {
  const filas = await consultar(como(uid), "select 1 from public.oferentes where id = $1", [uid]);
  return filas.length > 0;
}

/** Los datos que trajo Cidituc, para el formulario de registro. */
export async function miPersona(uid: string): Promise<PersonaCidituc | null> {
  const [f] = await consultar(
    como(uid),
    "select nombre, apellido, dni, email from public.personas where id = $1",
    [uid],
  );
  if (!f) return null;
  return {
    nombre: String(f.nombre),
    apellido: String(f.apellido),
    dni: String(f.dni),
    email: (f.email as string | null) ?? null,
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
  datos: { telefono: string; email: string; aceptaBases: boolean; aceptaPrivacidad: boolean },
) {
  const [f] = await consultar<{ r: ResultadoRpc }>(
    como(uid),
    "select public.registrar_oferente($1, $2, $3, $4) as r",
    [datos.telefono, datos.email, datos.aceptaBases, datos.aceptaPrivacidad],
  );
  return f.r;
}

export async function actualizarMisDatos(uid: string, telefono: string, email: string, avisosPorCorreo: boolean) {
  const [f] = await consultar<{ r: ResultadoRpc }>(
    como(uid),
    "select public.actualizar_mis_datos($1, $2, $3) as r",
    [telefono, email, avisosPorCorreo],
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
