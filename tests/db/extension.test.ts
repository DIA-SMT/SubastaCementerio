import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN, OBRA, baseDePrueba, como, crearUsuario, ofertar, registrar } from "./ayuda";

// Extensión del cierre: una oferta en los últimos N minutos corre el cierre de esa obra.
// Las horas se arman relativas a now() para no esperar minutos reales.

type FilaObra = { numero: number; fase: string; cierre: string };
type Estado = { fase: string; en_extension: boolean; cierre_virtual: string; cierre_final: string };

const obras = (db: PGlite, numeros: number[]) =>
  como(db, { rol: "anon" }, (tx) =>
    tx.query<FilaObra>("select numero, fase, cierre from public.v_obras_publicas where numero = any($1) order by numero", [
      numeros,
    ]),
  ).then((r) => r.rows);

const estado = (db: PGlite) =>
  como(db, { rol: "anon" }, (tx) =>
    tx.query<Estado>("select fase, en_extension, cierre_virtual, cierre_final from public.v_estado_subasta"),
  ).then((r) => r.rows[0]);

const ms = (v: unknown) => new Date(v as string).getTime();

describe("extensión del cierre por obra", () => {
  let db: PGlite;
  let ana: string;
  let beto: string;

  beforeEach(async () => {
    db = await baseDePrueba();
    ana = await crearUsuario(db, "ana@prueba.test");
    beto = await crearUsuario(db, "beto@prueba.test");
    await registrar(db, ana, "20111222");
    await registrar(db, beto, "20333444");
  });

  it("viene apagada y sin extensión cada obra cierra a la hora general", async () => {
    const { rows } = await db.query<{ extension_activa: boolean; extension_minutos: number }>(
      "select extension_activa, extension_minutos from public.configuracion",
    );
    expect(rows[0]).toEqual({ extension_activa: false, extension_minutos: 3 });

    await db.query("update public.configuracion set cierre_virtual = now() + interval '1 minute'");
    const r = await ofertar(db, ana, OBRA(6), 100000);
    expect(r).toMatchObject({ ok: true, extendio: false });

    const e = await estado(db);
    expect(ms(e.cierre_final)).toBe(ms(e.cierre_virtual));
    const [o] = await obras(db, [6]);
    expect(ms(o.cierre)).toBe(ms(e.cierre_virtual));
  });

  it("una oferta en los últimos minutos extiende solo esa obra", async () => {
    await db.query(
      "update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 minute'",
    );
    const r = await ofertar(db, ana, OBRA(6), 100000);
    expect(r).toMatchObject({ ok: true, extendio: true });

    const { rows: hora } = await db.query<{ creada_at: string }>("select creada_at from public.ofertas where id = $1", [
      r.oferta_id,
    ]);
    // Cierra 3 minutos después de la oferta.
    expect(ms(r.cierre)).toBe(ms(hora[0].creada_at) + 3 * 60_000);

    const [seis, siete] = await obras(db, [6, 7]);
    expect(ms(seis.cierre)).toBe(ms(r.cierre));
    expect(ms(siete.cierre)).toBeLessThan(ms(seis.cierre));
  });

  it("una oferta antes de la ventana no cambia el cierre", async () => {
    await db.query(
      "update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 hour'",
    );
    const r = await ofertar(db, ana, OBRA(6), 100000);
    expect(r).toMatchObject({ ok: true, extendio: false });
    const e = await estado(db);
    expect(ms(r.cierre)).toBe(ms(e.cierre_virtual));
    expect(e.en_extension).toBe(false);
  });

  it("pasada la hora general, la obra extendida sigue abierta y las demás cierran", async () => {
    await db.query(
      "update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 minute'",
    );
    expect(await ofertar(db, ana, OBRA(6), 100000)).toMatchObject({ ok: true, extendio: true });

    // Simula que pasó la hora de cierre general (la oferta de recién sigue dentro de los 3 minutos).
    await db.query("update public.configuracion set cierre_virtual = now() - interval '1 second'");

    const [seis, siete] = await obras(db, [6, 7]);
    expect(seis.fase).toBe("abierta");
    expect(siete.fase).toBe("cerrada");
    expect(await estado(db)).toMatchObject({ fase: "abierta", en_extension: true });

    expect(await ofertar(db, beto, OBRA(7), 100000)).toMatchObject({ ok: false, codigo: "cerrada" });
    const otra = await ofertar(db, beto, OBRA(6), 200000);
    expect(otra).toMatchObject({ ok: true, extendio: true });

    const mias = await como(db, { rol: "authenticated", uid: beto }, (tx) =>
      tx.query<{ numero: number; fase: string }>("select numero, fase from public.v_mis_ofertas"),
    );
    expect(mias.rows).toEqual([{ numero: 6, fase: "abierta" }]);
  });

  it("cuando cierra la última obra extendida, cierra toda la etapa", async () => {
    await db.query(
      "update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 minute'",
    );
    const r = await ofertar(db, ana, OBRA(6), 100000);
    // Corre la oferta 4 minutos hacia atrás (solo el dueño puede: las ofertas son inmutables).
    await db.query("alter table public.ofertas disable trigger user");
    await db.query("update public.ofertas set creada_at = now() - interval '4 minutes' where id = $1", [r.oferta_id]);
    await db.query("alter table public.ofertas enable trigger user");
    await db.query("update public.configuracion set cierre_virtual = now() - interval '1 second'");

    expect(await estado(db)).toMatchObject({ fase: "cerrada", en_extension: false });
    expect((await obras(db, [6]))[0].fase).toBe("cerrada");
    expect(await ofertar(db, beto, OBRA(6), 200000)).toMatchObject({ ok: false, codigo: "cerrada" });
  });

  it("una oferta anulada después mantiene la extensión que ya produjo", async () => {
    await db.query(
      "update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 minute'",
    );
    const r = await ofertar(db, ana, OBRA(6), 100000);
    await como(db, { rol: "authenticated", uid: ADMIN }, (tx) =>
      tx.query("select public.anular_oferta($1, 'Prueba de anulación')", [r.oferta_id]),
    );
    const [seis] = await obras(db, [6]);
    expect(ms(seis.cierre)).toBe(ms(r.cierre));
  });

  it("no se puede cambiar la extensión pasada la hora de cierre general", async () => {
    await db.query("update public.configuracion set cierre_virtual = now() - interval '1 second'");
    await expect(db.query("update public.configuracion set extension_activa = true")).rejects.toThrow(
      /no se puede cambiar después de la hora de cierre/,
    );
    // Apagada, los minutos no cambian ningún cierre.
    await db.query("update public.configuracion set extension_minutos = 5");

    await db.query("update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 day'");
    await db.query("update public.configuracion set cierre_virtual = now() - interval '1 second'");
    await expect(db.query("update public.configuracion set extension_minutos = 3")).rejects.toThrow(
      /no se puede cambiar después de la hora de cierre/,
    );
    await expect(db.query("update public.configuracion set extension_activa = false")).rejects.toThrow(
      /no se puede cambiar después de la hora de cierre/,
    );
    // Si el mismo cambio reabre la etapa, sí.
    await db.query(
      "update public.configuracion set extension_activa = false, cierre_virtual = now() + interval '1 day'",
    );
    // Con las fechas sin confirmar, también.
    await db.query("update public.configuracion set cierre_virtual = now() - interval '1 second', fechas_confirmadas = false");
    await db.query("update public.configuracion set extension_activa = true");
  });

  it("los minutos van de 1 a 30", async () => {
    await expect(db.query("update public.configuracion set extension_minutos = 0")).rejects.toThrow(
      /extension_minutos_rango/,
    );
    await expect(db.query("update public.configuracion set extension_minutos = 31")).rejects.toThrow(
      /extension_minutos_rango/,
    );
  });

  it("los avisos llevan la hora de cierre y la fase de la obra", async () => {
    await db.query(
      "update public.configuracion set extension_activa = true, cierre_virtual = now() + interval '1 minute'",
    );
    await ofertar(db, ana, OBRA(6), 100000);
    const r = await ofertar(db, beto, OBRA(6), 200000);
    const { rows } = await db.query<{ cierre_virtual: string; fase: string }>(
      "select cierre_virtual, fase from public.avisos_para_enviar(20) where obra_numero = 6",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].fase).toBe("abierta");
    expect(ms(rows[0].cierre_virtual)).toBe(ms(r.cierre));
  });
});
