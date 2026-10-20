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

export async function crearUsuario(db: PGlite, email: string, verificado = true) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at) values ($1, case when $2 then now() end) returning id",
    [email, verificado],
  );
  return rows[0].id;
}

export async function registrar(db: PGlite, uid: string, dni: string) {
  const { rows } = await como(db, { rol: "authenticated", uid }, (tx) =>
    tx.query<{ r: { ok: boolean; codigo?: string; alias_numero?: number } }>(
      "select public.registrar_oferente('Ana', 'Prueba', $1, '381 555-1234', true, true) as r",
      [dni],
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
