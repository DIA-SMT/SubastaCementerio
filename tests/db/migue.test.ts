import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { baseDePrueba, como } from "./ayuda";

// 20261117120000_migue.sql: el registro y el tope de Migue, solo para el servidor.

describe("Migue en la base", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseDePrueba();
  });

  it("el servidor anota consultas; anon y authenticated no ven nada", async () => {
    await db.query(
      "insert into public.consultas_migue (canal, resultado, duracion_ms, pregunta, respuesta) values ('publico', 'respondida', 120, '¿cuánto va la 7?', 'Va $ 150.000.')",
    );
    for (const ctx of [{ rol: "anon" as const }, { rol: "authenticated" as const, uid: "00000000-0000-4000-d000-000000000001" }]) {
      await expect(como(db, ctx, (tx) => tx.query("select * from public.consultas_migue"))).rejects.toThrow(/permission denied/);
      await expect(como(db, ctx, (tx) => tx.query("select * from public.consumo_migue"))).rejects.toThrow(/permission denied/);
    }
  });

  it("el registro es de solo inserción y una consulta reciente no se borra", async () => {
    await expect(db.query("update public.consultas_migue set respuesta = 'otra'")).rejects.toThrow(/solo inserción/);
    await expect(db.query("delete from public.consultas_migue")).rejects.toThrow(/90 días/);
  });

  it("el tope suma de a uno y no baja", async () => {
    const sumar = () =>
      db.query<{ consultas: number }>(
        `insert into public.consumo_migue (clave, ventana, consultas) values ('${"a".repeat(32)}', date_trunc('hour', now()), 1)
         on conflict (clave, ventana) do update set consultas = consumo_migue.consultas + 1 returning consultas`,
      );
    await sumar();
    const { rows } = await sumar();
    expect(rows[0].consultas).toBe(2);
    await expect(db.query("update public.consumo_migue set consultas = 0")).rejects.toThrow(/solo sube/);
    await expect(db.query("insert into public.consumo_migue (clave, ventana) values ('1.2.3.4', now())")).rejects.toThrow(/check/i);
  });

  it("la purga borra lo vencido y nada más", async () => {
    // Una consulta y una hora viejas (con el disparador apagado: así las deja el paso del tiempo).
    await db.exec(`
      alter table public.consultas_migue disable trigger consultas_migue_proteger;
      insert into public.consultas_migue (en, canal, resultado, duracion_ms, pregunta, respuesta)
        overriding system value values (now() - interval '91 days', 'publico', 'respondida', 1, 'vieja', 'vieja');
      alter table public.consultas_migue enable trigger consultas_migue_proteger;
      insert into public.consumo_migue (clave, ventana, consultas) values ('${"b".repeat(32)}', now() - interval '2 days', 5);
    `);
    const { rows } = await db.query<{ consultas: number; ventanas: number }>("select * from public.f_purgar_migue()");
    expect(rows[0]).toEqual({ consultas: 1, ventanas: 1 });
    const quedan = await db.query<{ n: number }>("select count(*)::int as n from public.consultas_migue");
    expect(quedan.rows[0].n).toBe(1);
  });
});
