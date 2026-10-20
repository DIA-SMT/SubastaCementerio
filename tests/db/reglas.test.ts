import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, OBRA, baseDePrueba, como, crearUsuario, ofertar, registrar } from "./ayuda";

describe("migraciones y datos de ejemplo", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseDePrueba();
  });

  it("publica las 25 obras de ejemplo", async () => {
    const { rows } = await como(db, { rol: "anon" }, (tx) =>
      tx.query<{ n: number }>("select count(*)::int as n from public.v_obras_publicas"),
    );
    expect(rows[0].n).toBe(25);
  });

  it("calcula oferta actual y mínimo siguiente", async () => {
    const { rows } = await como(db, { rol: "anon" }, (tx) =>
      tx.query<{ numero: number; oferta_actual: number | null; minimo_siguiente: number }>(
        "select numero, oferta_actual, minimo_siguiente from public.v_obras_publicas where numero in (1, 6) order by numero",
      ),
    );
    expect(rows[0]).toMatchObject({ numero: 1, oferta_actual: 10000, minimo_siguiente: 15000 });
    expect(rows[1]).toMatchObject({ numero: 6, oferta_actual: null, minimo_siguiente: 10000 });
  });

  it("el público no puede leer tablas con datos personales", async () => {
    for (const tabla of ["oferentes", "ofertas", "auditoria", "avisos_correo", "v_ofertas_admin"]) {
      await expect(
        como(db, { rol: "anon" }, (tx) => tx.query(`select * from public.${tabla}`)),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("el historial público no expone datos personales", async () => {
    const { fields } = await como(db, { rol: "anon" }, (tx) =>
      tx.query("select * from public.v_historial_publico limit 1"),
    );
    const columnas = fields.map((f) => f.name);
    expect(columnas).toEqual(["id", "obra_id", "alias_numero", "monto", "creada_at", "es_propia"]);
  });

  it("un oferente sin permisos de admin no ve obras por fuera de las vistas", async () => {
    const uid = await crearUsuario(db, "curioso@prueba.test");
    const { rows } = await como(db, { rol: "authenticated", uid }, (tx) =>
      tx.query("select * from public.obras"),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("ofertar", () => {
  let db: PGlite;
  let ana: string;
  let beto: string;
  beforeAll(async () => {
    db = await baseDePrueba();
    ana = await crearUsuario(db, "ana@prueba.test");
    beto = await crearUsuario(db, "beto@prueba.test");
    expect((await registrar(db, ana, "20111222")).ok).toBe(true);
    expect((await registrar(db, beto, "20333444")).ok).toBe(true);
  });

  it("exige sesión", async () => {
    const { rows } = await como(db, { rol: "anon" }, (tx) =>
      tx.query("select public.ofertar($1, 50000) as r", [OBRA(6)]),
    ).catch((e) => ({ rows: [{ r: { error: String(e) } }] }));
    expect(JSON.stringify(rows[0])).toMatch(/permission denied/);
  });

  it("rechaza montos por debajo del mínimo e informa el mínimo", async () => {
    const r = await ofertar(db, ana, OBRA(1), 12000);
    expect(r).toMatchObject({ ok: false, codigo: "monto_insuficiente", minimo: 15000, oferta_actual: 10000 });
  });

  it("acepta la primera oferta desde el precio de salida", async () => {
    const r = await ofertar(db, ana, OBRA(6), 10000);
    expect(r).toMatchObject({ ok: true, monto: 10000, minimo_siguiente: 15000 });
  });

  it("no deja superar la propia oferta", async () => {
    const r = await ofertar(db, ana, OBRA(6), 20000);
    expect(r).toMatchObject({ ok: false, codigo: "ya_es_la_mas_alta" });
  });

  it("al ser superado encola un aviso por correo", async () => {
    const r = await ofertar(db, beto, OBRA(6), 15000);
    expect(r.ok).toBe(true);
    expect(r.aviso_id).toBeTruthy();
    const { rows } = await db.query<{ oferente_id: string; estado: string }>(
      "select oferente_id, estado from public.avisos_correo where id = $1",
      [r.aviso_id],
    );
    expect(rows[0]).toEqual({ oferente_id: ana, estado: "pendiente" });
  });

  it("no acepta ofertas de oferentes bloqueados", async () => {
    await db.query("update public.oferentes set bloqueado = true, bloqueo_motivo = 'Prueba de bloqueo' where id = $1", [ana]);
    const r = await ofertar(db, ana, OBRA(6), 50000);
    expect(r).toMatchObject({ ok: false, codigo: "bloqueado" });
    await db.query("update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1", [ana]);
  });

  it("no acepta ofertas sin registro completo", async () => {
    const sinDatos = await crearUsuario(db, "sindatos@prueba.test");
    const r = await ofertar(db, sinDatos, OBRA(6), 50000);
    expect(r).toMatchObject({ ok: false, codigo: "sin_registro" });
  });

  it("no cuenta ofertas de correos sin verificar", async () => {
    const sinVerificar = await crearUsuario(db, "sinverificar@prueba.test", false);
    await db.query(
      `insert into public.oferentes (id, nombre, apellido, dni, telefono, email, bases_version, bases_aceptadas_at, privacidad_aceptada_at)
       values ($1, 'X', 'Y', '20999888', '3815550000', 'sinverificar@prueba.test', 1, now(), now())`,
      [sinVerificar],
    );
    const r = await ofertar(db, sinVerificar, OBRA(6), 90000);
    expect(r).toMatchObject({ ok: false, codigo: "correo_sin_verificar" });

    // Aunque la oferta exista en la tabla, no cuenta para la oferta actual.
    await db.query("insert into public.ofertas (obra_id, oferente_id, monto) values ($1, $2, 999000)", [
      OBRA(6),
      sinVerificar,
    ]);
    const { rows } = await como(db, { rol: "anon" }, (tx) =>
      tx.query<{ oferta_actual: number }>("select oferta_actual from public.v_obras_publicas where numero = 6"),
    );
    expect(rows[0].oferta_actual).toBe(15000);
  });

  it("no acepta ofertas pasada la hora de cierre", async () => {
    await db.query("update public.configuracion set cierre_virtual = now() - interval '1 second'");
    const r = await ofertar(db, ana, OBRA(6), 100000);
    expect(r).toMatchObject({ ok: false, codigo: "cerrada" });
    const { rows } = await como(db, { rol: "anon" }, (tx) =>
      tx.query<{ fase: string }>("select fase from public.v_estado_subasta"),
    );
    expect(rows[0].fase).toBe("cerrada");
    await db.query("update public.configuracion set cierre_virtual = now() + interval '10 days'");
  });

  it("no acepta ofertas antes del inicio ni con fechas sin confirmar", async () => {
    await db.query("update public.configuracion set inicio_virtual = now() + interval '1 day'");
    expect(await ofertar(db, ana, OBRA(6), 100000)).toMatchObject({ codigo: "no_empezo" });
    await db.query(
      "update public.configuracion set inicio_virtual = now() - interval '1 day', fechas_confirmadas = false",
    );
    expect(await ofertar(db, ana, OBRA(6), 100000)).toMatchObject({ codigo: "no_empezo" });
    await db.query("update public.configuracion set fechas_confirmadas = true");
  });
});

describe("inmutabilidad, anulación y auditoría", () => {
  let db: PGlite;
  let ana: string;
  beforeAll(async () => {
    db = await baseDePrueba();
    ana = await crearUsuario(db, "ana@prueba.test");
    await registrar(db, ana, "20111222");
  });

  it("las ofertas no se pueden editar ni borrar, ni siquiera con el rol dueño", async () => {
    await expect(db.query("update public.ofertas set monto = 1 where id = 1")).rejects.toThrow(
      /no se pueden modificar/,
    );
    await expect(db.query("delete from public.ofertas where id = 1")).rejects.toThrow(/no se pueden borrar/);
    await expect(db.query("truncate public.ofertas cascade")).rejects.toThrow(/no se puede vaciar/);
  });

  it("la auditoría no se puede modificar", async () => {
    await expect(db.query("delete from public.auditoria")).rejects.toThrow(/no se puede modificar/);
  });

  it("solo el equipo puede anular, y con motivo", async () => {
    const r1 = await ofertar(db, ana, OBRA(1), 15000);
    expect(r1.ok).toBe(true);

    const anular = (uid: string, motivo: string) =>
      como(db, { rol: "authenticated", uid }, (tx) =>
        tx.query<{ r: { ok: boolean; codigo?: string } }>("select public.anular_oferta($1, $2) as r", [
          r1.oferta_id,
          motivo,
        ]),
      ).then((x) => x.rows[0].r);

    expect(await anular(ana, "Me arrepentí")).toMatchObject({ ok: false, codigo: "sin_permiso" });
    expect(await anular(ADMIN, "  ")).toMatchObject({ ok: false, codigo: "motivo_requerido" });
    expect(await anular(ADMIN, "Oferta cargada por error")).toMatchObject({ ok: true });
    expect(await anular(ADMIN, "Oferta cargada por error")).toMatchObject({ ok: false, codigo: "ya_anulada" });

    // La oferta sigue existiendo, anulada, y la actual vuelve a la anterior.
    const { rows } = await db.query<{ estado: string; motivo_anulacion: string }>(
      "select estado, motivo_anulacion from public.ofertas where id = $1",
      [r1.oferta_id],
    );
    expect(rows[0]).toEqual({ estado: "anulada", motivo_anulacion: "Oferta cargada por error" });
    const actual = await como(db, { rol: "anon" }, (tx) =>
      tx.query<{ oferta_actual: number }>("select oferta_actual from public.v_obras_publicas where numero = 1"),
    );
    expect(actual.rows[0].oferta_actual).toBe(10000);

    const audit = await db.query<{ actor_tipo: string; actor_id: string }>(
      "select actor_tipo, actor_id from public.auditoria where tabla = 'ofertas' and accion = 'anular' and registro_id = $1",
      [String(r1.oferta_id)],
    );
    expect(audit.rows).toEqual([{ actor_tipo: "admin", actor_id: ADMIN }]);
  });

  it("las vistas del panel solo devuelven filas al equipo", async () => {
    const deAna = await como(db, { rol: "authenticated", uid: ana }, (tx) =>
      tx.query("select * from public.v_listado_final"),
    );
    expect(deAna.rows).toHaveLength(0);
    const delEquipo = await como(db, { rol: "authenticated", uid: ADMIN }, (tx) =>
      tx.query<{ numero: number; dni: string | null }>("select numero, dni from public.v_listado_final order by numero"),
    );
    expect(delEquipo.rows).toHaveLength(25);
    expect(delEquipo.rows[0].dni).toMatch(/^\d{8}$/);
  });

  it("cada cambio en una obra queda auditado con el actor", async () => {
    await como(db, { rol: "authenticated", uid: ADMIN }, (tx) =>
      tx.query("update public.obras set titulo = 'Nuevo título' where numero = 2"),
    );
    const { rows } = await db.query<{ actor_tipo: string; antes: { titulo: string }; despues: { titulo: string } }>(
      "select actor_tipo, antes, despues from public.auditoria where tabla = 'obras' and accion = 'update' order by id desc limit 1",
    );
    expect(rows[0].actor_tipo).toBe("admin");
    expect(rows[0].antes.titulo).toBe("Título de ejemplo 2");
    expect(rows[0].despues.titulo).toBe("Nuevo título");
  });
});

describe("registro de oferentes", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseDePrueba(false);
  });

  it("valida DNI, teléfono, aceptación y duplicados", async () => {
    const uno = await crearUsuario(db, "uno@prueba.test");
    const dos = await crearUsuario(db, "dos@prueba.test");
    const sinVerificar = await crearUsuario(db, "tres@prueba.test", false);

    const reg = (uid: string, dni: string, tel = "3815551234", bases = true) =>
      como(db, { rol: "authenticated", uid }, (tx) =>
        tx.query<{ r: { ok: boolean; codigo?: string; alias_numero?: number } }>(
          "select public.registrar_oferente('Ana', 'Prueba', $1, $2, $3, true) as r",
          [dni, tel, bases],
        ),
      ).then((x) => x.rows[0].r);

    expect(await reg(uno, "123")).toMatchObject({ codigo: "dni_invalido" });
    expect(await reg(uno, "20.111.222", "12")).toMatchObject({ codigo: "telefono_invalido" });
    expect(await reg(uno, "20.111.222", "3815551234", false)).toMatchObject({ codigo: "falta_aceptacion" });
    expect(await reg(sinVerificar, "20111222")).toMatchObject({ codigo: "correo_sin_verificar" });
    expect(await reg(uno, "20.111.222")).toMatchObject({ ok: true, alias_numero: 1 });
    expect(await reg(uno, "20111223")).toMatchObject({ codigo: "ya_registrado" });
    expect(await reg(dos, "20111222")).toMatchObject({ codigo: "dni_registrado" });

    const { rows } = await db.query<{ dni: string; bases_version: number }>(
      "select dni, bases_version from public.oferentes where id = $1",
      [uno],
    );
    expect(rows[0]).toEqual({ dni: "20111222", bases_version: 1 });
  });
});
