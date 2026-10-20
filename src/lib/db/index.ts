import "server-only";
import { connection } from "next/server";
import type { Options, Sql } from "postgres";
import { modoLocal } from "@/lib/entorno";

/**
 * Contexto con el que corre cada consulta. Replica lo que hace la API de Supabase:
 * fija el rol y los claims dentro de la transacción, así las políticas RLS y auth.uid()
 * se aplican igual que en Supabase.
 *  - anon: visitante sin sesión.
 *  - authenticated: oferente o integrante del equipo con sesión iniciada.
 *  - servicio: tareas internas del servidor (envío de avisos). Sin RLS.
 *
 * Parámetros jsonb: escribir `$1::text::jsonb` y pasar `JSON.stringify(valor)`. Con `$1::jsonb`
 * la base informa el tipo jsonb y postgres.js vuelve a aplicar JSON.stringify al texto: llega un
 * string jsonb en vez del objeto (PGlite no lo hace, así que en local no se nota).
 * tests/db/driver.test.ts lo controla.
 */
export type Contexto = { rol: "anon" } | { rol: "authenticated"; uid: string } | { rol: "servicio" };

export type Consulta = <T = Record<string, unknown>>(texto: string, params?: unknown[]) => Promise<T[]>;

export type Motor = <R>(ctx: Contexto, fn: (q: Consulta) => Promise<R>) => Promise<R>;

let motor: Promise<Motor> | undefined;

function claims(ctx: Contexto) {
  return JSON.stringify(ctx.rol === "authenticated" ? { sub: ctx.uid, role: ctx.rol } : { role: ctx.rol });
}

const FIJAR_ROL = "select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)";

async function crearMotorLocal(): Promise<Motor> {
  const { baseLocal } = await import("./local/instancia");
  const db = await baseLocal();
  return (ctx, fn) =>
    db.transaction(async (tx) => {
      if (ctx.rol !== "servicio") await tx.query(FIJAR_ROL, [claims(ctx), ctx.rol]);
      return fn(async (texto, params) => (await tx.query(texto, params ?? [])).rows as never);
    });
}

/**
 * Cifrado de la conexión con Supabase: siempre TLS, aunque DATABASE_URL no traiga sslmode
 * (postgres.js conecta sin cifrar por defecto). Con SUPABASE_CA_CERT (el certificado raíz que
 * se descarga del panel de Supabase, en formato PEM) además verifica el certificado y el nombre
 * del servidor; sin esa variable cifra, pero no verifica.
 */
export function opcionesTls(certificado = process.env.SUPABASE_CA_CERT): Options<never>["ssl"] {
  // Admite el PEM con saltos de línea reales o escritos como \n en una sola línea.
  const ca = certificado?.replace(/\\n/g, "\n").trim();
  return ca ? { ca, rejectUnauthorized: true } : "require";
}

async function crearMotorSupabase(): Promise<Motor> {
  const { default: postgres } = await import("postgres");
  // Conexión por el pooler de Supabase en modo transacción (puerto 6543): sin prepared statements.
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, idle_timeout: 20, ssl: opcionesTls() });
  return motorPostgres(sql);
}

/** Motor sobre postgres.js (producción). Separado para probarlo contra PGlite en tests/db/driver.test.ts. */
export function motorPostgres(sql: Sql): Motor {
  return (ctx, fn) =>
    sql.begin(async (tx) => {
      if (ctx.rol !== "servicio") await tx.unsafe(FIJAR_ROL, [claims(ctx), ctx.rol]);
      return fn(async (texto, params) => (await tx.unsafe(texto, (params ?? []) as never[])) as never);
    }) as never;
}

/** Ejecuta `fn` dentro de una transacción con el rol indicado. */
export async function conBase<R>(ctx: Contexto, fn: (q: Consulta) => Promise<R>): Promise<R> {
  // Los datos de la subasta se leen siempre en el momento del pedido, nunca al prerenderizar.
  await connection();
  motor ??= modoLocal ? crearMotorLocal() : crearMotorSupabase();
  return (await motor)(ctx, fn);
}

/** Atajo para una sola consulta. */
export function consultar<T = Record<string, unknown>>(ctx: Contexto, texto: string, params?: unknown[]) {
  return conBase(ctx, (q) => q<T>(texto, params));
}
