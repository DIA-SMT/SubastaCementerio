import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { consultar } from "@/lib/db";
import { faltasDeConfiguracion, type FaltaDeConfiguracion } from "@/lib/entorno";

// Datos del tablero del panel. Todas las consultas corren como el integrante del equipo:
// las políticas RLS y las vistas del panel exigen public.es_admin().

export type Indicadores = {
  ofertasValidas: number;
  ofertasAnuladas: number;
  oferentesRegistrados: number;
  oferentesConOfertas: number;
  /**
   * Usuarios de auth.users sin registro de oferente (ni del equipo). En Supabase la cuenta se
   * crea al pedir el código, así que incluye a quienes no llegaron a verificar el correo.
   */
  ingresosSinRegistro: number;
  /** Suma de la oferta más alta vigente de cada obra publicada. */
  montoAcumulado: number;
  obrasPublicadas: number;
  obrasConOfertas: number;
};

export type OfertaReciente = {
  id: number;
  obraId: string;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  alias: number;
  monto: number;
  creadaAt: Date;
  estado: "valida" | "anulada";
  esLaMasAlta: boolean;
};

export type ObraSinOfertas = {
  id: string;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  precioSalida: number;
};

export type ResumenAvisos = {
  pendientes: number;
  enviados: number;
  conError: number;
  /**
   * Sin más reintentos automáticos: ya se intentaron 5 veces y no hay un envío en curso
   * (cada intento se cuenta al reservar el aviso para enviarlo).
   */
  sinReintentos: number;
  descartados: number;
  /** Configuración del servidor que falta para enviar o reintentar avisos (vacío en modo local). */
  faltas: FaltaDeConfiguracion[];
};

export async function indicadoresTablero(admin: Admin): Promise<Indicadores> {
  const [f] = await consultar<{ r: Record<string, unknown> }>(comoAdmin(admin), "select public.indicadores() as r");
  const r = f.r;
  return {
    ofertasValidas: Number(r.ofertas_validas ?? 0),
    ofertasAnuladas: Number(r.ofertas_anuladas ?? 0),
    oferentesRegistrados: Number(r.oferentes_registrados ?? 0),
    oferentesConOfertas: Number(r.oferentes_con_ofertas ?? 0),
    ingresosSinRegistro: Number(r.ingresos_sin_registro ?? 0),
    montoAcumulado: Number(r.monto_acumulado ?? 0),
    obrasPublicadas: Number(r.obras_publicadas ?? 0),
    obrasConOfertas: Number(r.obras_con_ofertas ?? 0),
  };
}

/** Últimas ofertas recibidas (válidas y anuladas). No trae datos personales. */
export async function ultimasOfertas(admin: Admin, limite = 10): Promise<OfertaReciente[]> {
  const filas = await consultar(
    comoAdmin(admin),
    `select id, obra_id, numero, titulo, artista_nombre, alias_numero, monto, creada_at, estado, es_la_mas_alta
     from public.v_ofertas_admin
     order by creada_at desc, id desc
     limit $1`,
    [limite],
  );
  return filas.map((f) => ({
    id: Number(f.id),
    obraId: String(f.obra_id),
    numero: Number(f.numero),
    titulo: (f.titulo as string | null) ?? null,
    artistaNombre: String(f.artista_nombre),
    alias: Number(f.alias_numero),
    monto: Number(f.monto),
    creadaAt: new Date(f.creada_at as string),
    estado: f.estado as OfertaReciente["estado"],
    esLaMasAlta: Boolean(f.es_la_mas_alta),
  }));
}

/**
 * Obras publicadas que todavía no tienen ninguna oferta vigente, junto con la cantidad de
 * obras publicadas (para distinguir "todas tienen ofertas" de "no hay obras publicadas").
 */
export async function obrasPublicadasSinOfertas(
  admin: Admin,
): Promise<{ publicadas: number; sinOfertas: ObraSinOfertas[] }> {
  const filas = await consultar(
    comoAdmin(admin),
    `select obra_id, numero, titulo, artista_nombre, precio_salida, precio_base is null as sin_ofertas
     from public.v_listado_final
     where publicada
     order by numero`,
  );
  return {
    publicadas: filas.length,
    sinOfertas: filas
      .filter((f) => Boolean(f.sin_ofertas))
      .map((f) => ({
        id: String(f.obra_id),
        numero: Number(f.numero),
        titulo: (f.titulo as string | null) ?? null,
        artistaNombre: String(f.artista_nombre),
        precioSalida: Number(f.precio_salida),
      })),
  };
}

/** Cantidad de avisos "te superaron" por estado. */
export async function resumenAvisos(admin: Admin): Promise<ResumenAvisos> {
  const [f] = await consultar(
    comoAdmin(admin),
    `select
       count(*) filter (where estado = 'pendiente')::int as pendientes,
       count(*) filter (where estado = 'enviado')::int as enviados,
       count(*) filter (where estado = 'error')::int as con_error,
       count(*) filter (
         where estado in ('pendiente', 'error') and intentos >= 5
           and (reservado_hasta is null or reservado_hasta < now())
       )::int as sin_reintentos,
       count(*) filter (where estado = 'descartado')::int as descartados
     from public.avisos_correo`,
  );
  return {
    pendientes: Number(f.pendientes),
    enviados: Number(f.enviados),
    conError: Number(f.con_error),
    sinReintentos: Number(f.sin_reintentos),
    descartados: Number(f.descartados),
    faltas: faltasDeConfiguracion(),
  };
}
