import type { PGlite, Transaction } from "@electric-sql/pglite";
import { crearBaseLocal } from "@/lib/db/local/preparar";

export async function baseDePrueba(conEjemplos = true) {
  return crearBaseLocal({ conEjemplos });
}

type Rol = { rol: "anon" } | { rol: "authenticated"; uid: string };

/** Ejecuta como lo haría la API de Supabase: rol + claims dentro de una transacción. */
export async function como<T>(db: PGlite, rol: Rol, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    const claims = rol.rol === "authenticated" ? { sub: rol.uid, role: rol.rol } : { role: "anon" };
    await tx.query("select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)", [
      JSON.stringify(claims),
      rol.rol,
    ]);
    return fn(tx);
  });
}

/**
 * Persona que ingresó con Cidituc, todavía sin registro de oferente (como lo hace el callback).
 * Con `cidituc = false`, una persona de antes de Cidituc: no puede registrarse.
 */
export async function crearUsuario(db: PGlite, email: string, cidituc = true) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.personas (cidituc_id, cuil, dni, nombre, apellido, email)
     values (case when $2 then gen_random_uuid()::text end, case when $2 then '20100000003' end,
             '10000000', 'Ana', 'Prueba', $1)
     returning id`,
    [email, cidituc],
  );
  return rows[0].id;
}

/** Cuenta del equipo (panel): esas siguen en auth.users. */
export async function crearCuentaEquipo(db: PGlite, email: string) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id",
    [email],
  );
  return rows[0].id;
}

/** Registro de oferente. El DNI es el que trajo Cidituc: se fija en la persona antes de registrar. */
export async function registrar(db: PGlite, uid: string, dni: string) {
  await db.query("update public.personas set dni = regexp_replace($2, '[^0-9]', '', 'g') where id = $1", [uid, dni]);
  const { rows } = await como(db, { rol: "authenticated", uid }, (tx) =>
    tx.query<{ r: { ok: boolean; codigo?: string; alias_numero?: number } }>(
      "select public.registrar_oferente('381 555-1234', (select email from public.personas where id = $1), true, true) as r",
      [uid],
    ),
  );
  return rows[0].r;
}

export async function ofertar(db: PGlite, uid: string, obraId: string, monto: number) {
  const { rows } = await como(db, { rol: "authenticated", uid }, (tx) =>
    tx.query<{ r: Record<string, unknown> & { ok: boolean; codigo?: string } }>(
      "select public.ofertar($1, $2) as r",
      [obraId, monto],
    ),
  );
  return rows[0].r;
}

export const OBRA = (n: number) => `00000000-0000-4000-b000-${String(n).padStart(12, "0")}`;
export const ADMIN = "00000000-0000-4000-d000-000000000001";
