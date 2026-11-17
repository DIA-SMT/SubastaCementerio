import { createHmac } from "node:crypto";

/**
 * El tope de consultas AL MODELO, por persona y por hora, y uno global (núcleo de Migue,
 * CementerIA src/lib/migue/tope.ts). No es antiabuso sofisticado sino un techo de gasto, para
 * que un mal día no se lleve el presupuesto del mes.
 *
 * - **Persona**: la IP, nunca en claro: un HMAC con SESSION_SECRET. La tabla no permite saber
 *   quién preguntó ni cruzarla con el registro.
 * - **Global**: entre todos. Es el techo de verdad: si mil personas preguntan veinte veces, el
 *   tope individual no protege nada.
 * - **Atómico**: incrementa primero y pregunta después, en una sola sentencia
 *   (INSERT … ON CONFLICT DO UPDATE … RETURNING).
 * - **Pasarse no rompe a Migue**: sigue contestando con el buscador, que no cuesta nada.
 * - Si la base no responde, deja pasar (y lo anota): es una protección de costos, no de
 *   seguridad, y no vale que una caída apague a Migue.
 *
 * Solo cuenta lo que va al modelo: un saludo o un atajo no gastan nada.
 */

export type PersonaTope = { tipo: "ip"; ip: string | null };

export interface Topes {
  persona: number;
  global: number;
}

export interface EstadoTope {
  permitido: boolean;
  /** Por qué no, para el registro. */
  motivo?: "persona" | "global";
}

/** El HMAC de la persona, en base64url y recortado a 32 caracteres (el CHECK de consumo_migue). */
export function claveDeConsumo(secreto: string, persona: PersonaTope): string {
  return createHmac("sha256", secreto).update(`migue:ip:${persona.ip ?? "sin-ip"}`).digest("base64url").slice(0, 32);
}

/** El comienzo de la hora en curso (en UTC: las horas de Tucumán empiezan al mismo tiempo). */
export function ventanaDe(ahora: Date): Date {
  const d = new Date(ahora);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/** La decisión, dado lo que ya se contó (incluida esta consulta). Pura. */
export function decidirTope(cuenta: { persona: number; global: number }, topes: Topes): EstadoTope {
  if (cuenta.persona > topes.persona) return { permitido: false, motivo: "persona" };
  if (cuenta.global > topes.global) return { permitido: false, motivo: "global" };
  return { permitido: true };
}

/** Una consulta a la base con el rol de servicio (src/lib/db: conBase con { rol: "servicio" }). */
export type ConsultaServicio = <R>(fn: (q: <T = Record<string, unknown>>(texto: string, params?: unknown[]) => Promise<T[]>) => Promise<R>) => Promise<R>;

export interface DependenciasTope {
  escribir: ConsultaServicio;
  secreto: string;
  topes: Topes;
  ahora?: () => Date;
}

/** Cuenta una consulta al modelo y dice si estaba permitida. Con la base caída, permitida. */
export async function contarConsulta(deps: DependenciasTope, persona: PersonaTope): Promise<EstadoTope> {
  const ventana = ventanaDe(deps.ahora?.() ?? new Date()).toISOString();
  const clave = claveDeConsumo(deps.secreto, persona);
  try {
    const cuenta = await deps.escribir(async (q) => {
      const [fila] = await q<{ consultas: number }>(
        `insert into public.consumo_migue (clave, ventana, consultas) values ($1, $2::timestamptz, 1)
         on conflict (clave, ventana) do update set consultas = consumo_migue.consultas + 1
         returning consultas`,
        [clave, ventana],
      );
      const personaCuenta = Number(fila?.consultas ?? 1);
      // El global se mira solo si la persona no se pasó: es una consulta más.
      if (personaCuenta > deps.topes.persona) return { persona: personaCuenta, global: 0 };
      const [total] = await q<{ total: number }>(
        "select coalesce(sum(consultas), 0)::int as total from public.consumo_migue where ventana = $1::timestamptz",
        [ventana],
      );
      return { persona: personaCuenta, global: Number(total?.total ?? 0) };
    });
    return decidirTope(cuenta, deps.topes);
  } catch (error) {
    console.warn("migue.tope_sin_base", error instanceof Error ? error.message : typeof error);
    return { permitido: true };
  }
}
