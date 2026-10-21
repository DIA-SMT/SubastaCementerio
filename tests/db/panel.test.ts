// Reglas de la base que usa el panel del equipo: quién puede leer y escribir qué,
// qué queda auditado y que los cálculos del panel (indicadores, listado final) sean correctos.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, OBRA, baseDePrueba, como, crearUsuario, ofertar, registrar } from "./ayuda";

type Quien = Parameters<typeof como>[1];

const ANON: Quien = { rol: "anon" };
const EQUIPO: Quien = { rol: "authenticated", uid: ADMIN };
const ARTISTA = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const OFERENTE = (n: number) => `00000000-0000-4000-c000-${String(n).padStart(12, "0")}`;

/** Filas de una consulta hecha con el rol indicado. */
async function filas<T = Record<string, unknown>>(db: PGlite, quien: Quien, texto: string, params: unknown[] = []) {
  const { rows } = await como(db, quien, (tx) => tx.query<T>(texto, params));
  return rows;
}

/** Cantidad de filas que cambió una escritura hecha con el rol indicado. */
async function afectadas(db: PGlite, quien: Quien, texto: string, params: unknown[] = []) {
  const r = await como(db, quien, (tx) => tx.query(texto, params));
  return r.affectedRows ?? 0;
}

/** Ejecuta con el rol indicado y devuelve el mensaje de error (o null si no hubo error). */
async function error(db: PGlite, quien: Quien, texto: string, params: unknown[] = []) {
  try {
    await como(db, quien, (tx) => tx.query(texto, params));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Igual que `error`, pero devuelve también el código SQLSTATE y la restricción. */
async function falla(db: PGlite, quien: Quien, texto: string, params: unknown[] = []) {
  try {
    await como(db, quien, (tx) => tx.query(texto, params));
    return null;
  } catch (e) {
    const { code, constraint, message } = e as { code?: string; constraint?: string; message?: string };
    return { code, constraint, message };
  }
}

/** Consulta como dueño de la base (sin RLS), para comprobar lo que quedó guardado. */
async function directo<T = Record<string, unknown>>(db: PGlite, texto: string, params: unknown[] = []) {
  return (await db.query<T>(texto, params)).rows;
}

async function cantidad(db: PGlite, texto: string, params: unknown[] = []) {
  const [fila] = await directo<{ n: number }>(db, texto, params);
  return fila.n;
}

async function anular(db: PGlite, quien: Quien, ofertaId: number, motivo: string) {
  const [fila] = await filas<{ r: { ok: boolean; codigo?: string } }>(
    db,
    quien,
    "select public.anular_oferta($1, $2) as r",
    [ofertaId, motivo],
  );
  return fila.r;
}

type Indicadores = {
  ofertas_validas: number;
  ofertas_anuladas: number;
  oferentes_registrados: number;
  oferentes_con_ofertas: number;
  ingresos_sin_registro: number;
  monto_acumulado: number;
  obras_publicadas: number;
  obras_con_ofertas: number;
};

async function indicadores(db: PGlite) {
  const [fila] = await filas<{ r: Indicadores }>(db, EQUIPO, "select public.indicadores() as r");
  return fila.r;
}

/** Ofertas válidas de oferentes con el correo verificado, de mayor a menor (como superusuario). */
async function ofertasVigentes(db: PGlite, obraId: string) {
  return directo<{ id: number; oferente_id: string; monto: number }>(
    db,
    `select o.id::int as id, o.oferente_id, o.monto
     from public.ofertas o
     where o.obra_id = $1 and o.estado = 'valida'
       and exists (
         select 1 from auth.users u where u.id = o.oferente_id and u.email_confirmed_at is not null
       )
     order by o.monto desc, o.creada_at asc`,
    [obraId],
  );
}

/** Oferente registrado con el correo verificado pero sin rol de admin. */
async function nuevoOferente(db: PGlite, email: string, dni: string) {
  const uid = await crearUsuario(db, email);
  expect((await registrar(db, uid, dni)).ok).toBe(true);
  return uid;
}

/** Oferente con el correo SIN verificar y una oferta cargada directo en la tabla. */
async function ofertaSinVerificar(db: PGlite, obraId: string, monto: number) {
  const uid = await crearUsuario(db, "sinverificar@prueba.test", false);
  await db.query(
    `insert into public.oferentes (id, nombre, apellido, dni, telefono, email, bases_version, bases_aceptadas_at, privacidad_aceptada_at)
     values ($1, 'Sin', 'Verificar', '20999888', '3815550000', 'sinverificar@prueba.test', 1, now(), now())`,
    [uid],
  );
  await db.query("insert into public.ofertas (obra_id, oferente_id, monto) values ($1, $2, $3)", [
    obraId,
    uid,
    monto,
  ]);
  return uid;
}

// ---------------------------------------------------------------------------

describe("un oferente sin rol de admin", () => {
  let db: PGlite;
  let ana: Quien;
  let anaId: string;

  beforeAll(async () => {
    db = await baseDePrueba();
    anaId = await nuevoOferente(db, "ana@prueba.test", "20111222");
    ana = { rol: "authenticated", uid: anaId };
    // Supera la oferta de ejemplo de la obra 1: queda un aviso por correo en la cola.
    const r = await ofertar(db, anaId, OBRA(1), 15000);
    expect(r).toMatchObject({ ok: true });
    expect(r.aviso_id).toBeTruthy();
  });

  it("no puede leer ni cambiar la configuración", async () => {
    expect(await filas(db, ana, "select * from public.configuracion")).toHaveLength(0);
    expect(
      await afectadas(
        db,
        ana,
        "update public.configuracion set incremento_minimo = 1, precio_salida = 1, modo_ejemplo = false",
      ),
    ).toBe(0);
    const [cfg] = await directo(db, "select incremento_minimo, precio_salida, modo_ejemplo from public.configuracion");
    expect(cfg).toEqual({ incremento_minimo: 5000, precio_salida: 10000, modo_ejemplo: true });
  });

  it("no puede crear, editar ni borrar obras", async () => {
    expect(await afectadas(db, ana, "update public.obras set titulo = 'Cambiado', publicada = false")).toBe(0);
    expect(await afectadas(db, ana, "delete from public.obras where id = $1", [OBRA(6)])).toBe(0);
    expect(
      await error(db, ana, "insert into public.obras (numero, artista_id) values (90, $1)", [ARTISTA(1)]),
    ).toMatch(/row-level security/);

    const [obra] = await directo(db, "select titulo, publicada from public.obras where id = $1", [OBRA(2)]);
    expect(obra).toEqual({ titulo: "Título de ejemplo 2", publicada: true });
    expect(await cantidad(db, "select count(*)::int as n from public.obras")).toBe(25);
  });

  it("no puede crear, editar ni borrar artistas", async () => {
    expect(await afectadas(db, ana, "update public.artistas set nombre = 'Cambiado'")).toBe(0);
    expect(await afectadas(db, ana, "delete from public.artistas")).toBe(0);
    expect(await error(db, ana, "insert into public.artistas (nombre) values ('Intruso')")).toMatch(
      /row-level security/,
    );

    const [artista] = await directo(db, "select nombre from public.artistas where id = $1", [ARTISTA(1)]);
    expect(artista).toEqual({ nombre: "Artista de ejemplo 1" });
    expect(await cantidad(db, "select count(*)::int as n from public.artistas")).toBe(25);
  });

  it("no puede agregar, editar ni borrar fotos", async () => {
    const antes = await cantidad(db, "select count(*)::int as n from public.obra_fotos");
    expect(await afectadas(db, ana, "update public.obra_fotos set texto_alternativo = 'Cambiado'")).toBe(0);
    expect(await afectadas(db, ana, "delete from public.obra_fotos")).toBe(0);
    expect(
      await error(db, ana, "insert into public.obra_fotos (obra_id, ruta) values ($1, '/x.jpg')", [OBRA(1)]),
    ).toMatch(/row-level security/);

    expect(await cantidad(db, "select count(*)::int as n from public.obra_fotos")).toBe(antes);
    expect(
      await cantidad(db, "select count(*)::int as n from public.obra_fotos where texto_alternativo = 'Cambiado'"),
    ).toBe(0);
  });

  it("no puede editar ni agregar textos", async () => {
    const [antes] = await directo(db, "select contenido, version, provisorio from public.paginas where slug = 'destino'");
    expect(
      await afectadas(db, ana, "update public.paginas set contenido = 'Cambiado', provisorio = false"),
    ).toBe(0);
    expect(
      await error(db, ana, "insert into public.paginas (slug, titulo) values ('portada', 'Otra')"),
    ).toMatch(/permission denied/);

    const [despues] = await directo(db, "select contenido, version, provisorio from public.paginas where slug = 'destino'");
    expect(despues).toEqual(antes);
  });

  it("no puede desbloquearse ni cambiar sus datos por fuera de las funciones", async () => {
    await db.query("update public.oferentes set bloqueado = true, bloqueo_motivo = 'Prueba de bloqueo' where id = $1", [
      anaId,
    ]);
    expect(
      await afectadas(db, ana, "update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1", [
        anaId,
      ]),
    ).toBe(0);
    expect(
      await error(db, ana, "update public.oferentes set telefono = '3815559999' where id = $1", [anaId]),
    ).toMatch(/permission denied/);
    expect(await error(db, ana, "delete from public.oferentes where id = $1", [anaId])).toMatch(/permission denied/);

    const [fila] = await directo(db, "select bloqueado, telefono from public.oferentes where id = $1", [anaId]);
    expect(fila).toEqual({ bloqueado: true, telefono: "3815551234" });
    await db.query("update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1", [anaId]);
  });

  it("no puede darse el rol de admin", async () => {
    expect(await error(db, ana, "insert into public.admins (user_id, nombre) values ($1, 'Yo')", [anaId])).toMatch(
      /permission denied/,
    );
    expect(await error(db, ana, "update public.admins set activo = true")).toMatch(/permission denied/);
    expect(await filas(db, ana, "select * from public.admins")).toHaveLength(0);
    const [r] = await filas<{ es: boolean }>(db, ana, "select public.es_admin() as es");
    expect(r.es).toBe(false);
  });

  it("no ve ofertas, avisos por correo ni auditoría (aunque haya filas)", async () => {
    for (const tabla of ["ofertas", "avisos_correo", "auditoria"]) {
      expect(await cantidad(db, `select count(*)::int as n from public.${tabla}`)).toBeGreaterThan(0);
      expect(await filas(db, ana, `select * from public.${tabla}`)).toHaveLength(0);
    }
  });

  it("no puede anular ofertas", async () => {
    const [mia] = await directo<{ id: number }>(
      db,
      "select id::int as id from public.ofertas where oferente_id = $1 and obra_id = $2",
      [anaId, OBRA(1)],
    );
    expect(await anular(db, ana, mia.id, "Me arrepentí de ofertar")).toMatchObject({ ok: false, codigo: "sin_permiso" });
    const [oferta] = await directo(db, "select estado from public.ofertas where id = $1", [mia.id]);
    expect(oferta).toEqual({ estado: "valida" });
  });

  it("no puede registrar eventos de auditoría ni ver los indicadores", async () => {
    const antes = await cantidad(db, "select count(*)::int as n from public.auditoria");
    for (const texto of ["select public.registrar_evento('exportar_listado', '{}'::jsonb)", "select public.indicadores()"]) {
      expect(await falla(db, ana, texto), texto).toMatchObject({ code: "42501", message: "Sin permiso." });
    }
    expect(await cantidad(db, "select count(*)::int as n from public.auditoria")).toBe(antes);
  });

  it("no ve las vistas del panel", async () => {
    expect(await filas(db, ana, "select * from public.v_ofertas_admin")).toHaveLength(0);
    expect(await filas(db, ana, "select * from public.v_listado_final")).toHaveLength(0);
  });

  it("un integrante del equipo dado de baja (activo = false) pierde los permisos", async () => {
    const exId = await crearUsuario(db, "ex@prueba.test");
    await db.query("insert into public.admins (user_id, nombre, activo) values ($1, 'Ex integrante', false)", [exId]);
    const ex: Quien = { rol: "authenticated", uid: exId };

    expect(await afectadas(db, ex, "update public.obras set titulo = 'Cambiado'")).toBe(0);
    expect(await afectadas(db, ex, "update public.configuracion set incremento_minimo = 1")).toBe(0);
    expect(await filas(db, ex, "select * from public.ofertas")).toHaveLength(0);
    expect(await filas(db, ex, "select * from public.v_listado_final")).toHaveLength(0);
    expect(await error(db, ex, "select public.indicadores()")).toMatch(/Sin permiso/);
  });
});

// ---------------------------------------------------------------------------

describe("funciones y permisos reservados", () => {
  let db: PGlite;
  let ana: Quien;

  beforeAll(async () => {
    db = await baseDePrueba();
    ana = { rol: "authenticated", uid: await nuevoOferente(db, "ana@prueba.test", "20111222") };
  });

  const DEL_PANEL = [
    "select public.indicadores()",
    "select public.anular_oferta(1, 'Motivo de prueba')",
    "select public.registrar_evento('prueba')",
  ];
  const DEL_SERVIDOR = ["select * from public.avisos_para_enviar()", "select public.marcar_aviso(1, true)"];

  it("el público (anon) no puede ejecutar las funciones del panel ni las de avisos", async () => {
    for (const texto of [...DEL_PANEL, ...DEL_SERVIDOR]) {
      expect(await error(db, ANON, texto), texto).toMatch(/permission denied for function/);
    }
  });

  it("con sesión (oferente o equipo) no se pueden ejecutar las funciones de avisos", async () => {
    for (const quien of [ana, EQUIPO]) {
      for (const texto of DEL_SERVIDOR) {
        expect(await error(db, quien, texto), texto).toMatch(/permission denied for function/);
      }
    }
  });

  it("solo se otorgan las funciones previstas", async () => {
    const otorgadas = async (rol: string) =>
      (
        await directo<{ nombre: string }>(
          db,
          `select p.proname as nombre
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and has_function_privilege($1, p.oid, 'execute')
           order by 1`,
          [rol],
        )
      ).map((f) => f.nombre);

    expect(await otorgadas("anon")).toEqual(["cierre_con_extension", "es_admin", "tipo_actor"]);
    expect(await otorgadas("authenticated")).toEqual([
      "actualizar_mis_datos",
      "anular_oferta",
      "cierre_con_extension",
      "es_admin",
      "indicadores",
      "ofertar",
      "registrar_evento",
      "registrar_oferente",
      "tipo_actor",
    ]);
  });

  it("solo se otorgan las escrituras previstas sobre tablas y columnas", async () => {
    const conPermiso = async (rol: string, permiso: string) =>
      (
        await directo<{ nombre: string }>(
          db,
          `select c.relname as nombre
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'v') and has_table_privilege($1, c.oid, $2)
           order by 1`,
          [rol, permiso],
        )
      ).map((f) => f.nombre);

    for (const permiso of ["insert", "update", "delete", "truncate"]) {
      expect(await conPermiso("anon", permiso), permiso).toEqual([]);
    }
    expect(await conPermiso("authenticated", "insert")).toEqual(["artistas", "obra_fotos", "obras"]);
    expect(await conPermiso("authenticated", "update")).toEqual([
      "artistas",
      "configuracion",
      "obra_fotos",
      "obras",
      "paginas",
    ]);
    expect(await conPermiso("authenticated", "delete")).toEqual(["artistas", "obra_fotos", "obras"]);
    expect(await conPermiso("authenticated", "truncate")).toEqual([]);

    const columnas = await directo<{ nombre: string }>(
      db,
      `select a.attname as nombre
       from pg_attribute a
       where a.attrelid = 'public.oferentes'::regclass and a.attnum > 0 and not a.attisdropped
         and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')
       order by 1`,
    );
    expect(columnas.map((c) => c.nombre)).toEqual(["bloqueado", "bloqueo_motivo"]);
  });

  it("el público solo lee las vistas públicas y los textos", async () => {
    const legibles = await directo<{ nombre: string }>(
      db,
      `select c.relname as nombre
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v') and has_table_privilege('anon', c.oid, 'select')
       order by 1`,
    );
    expect(legibles.map((f) => f.nombre)).toEqual([
      "paginas",
      "v_estado_subasta",
      "v_fotos_publicas",
      "v_historial_publico",
      "v_obras_publicas",
    ]);
  });
});

// ---------------------------------------------------------------------------

describe("el equipo (admin)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await baseDePrueba();
  });

  it("lee la configuración, las ofertas y la auditoría", async () => {
    expect(await filas(db, EQUIPO, "select * from public.configuracion")).toHaveLength(1);
    for (const tabla of ["ofertas", "auditoria", "oferentes"]) {
      const total = await cantidad(db, `select count(*)::int as n from public.${tabla}`);
      expect(total).toBeGreaterThan(0);
      const [r] = await filas<{ n: number }>(db, EQUIPO, `select count(*)::int as n from public.${tabla}`);
      expect(r.n, tabla).toBe(total);
    }
  });

  it("actualiza la configuración y el cambio queda en la auditoría", async () => {
    expect(
      await afectadas(db, EQUIPO, "update public.configuracion set incremento_minimo = 7000, precio_salida = 12000"),
    ).toBe(1);
    const [cfg] = await directo(db, "select incremento_minimo, precio_salida from public.configuracion");
    expect(cfg).toEqual({ incremento_minimo: 7000, precio_salida: 12000 });

    const [audit] = await directo<{
      actor_tipo: string;
      actor_id: string;
      registro_id: string;
      antes: { incremento_minimo: number };
      despues: { incremento_minimo: number };
    }>(
      db,
      `select actor_tipo, actor_id, registro_id, antes, despues from public.auditoria
       where tabla = 'configuracion' and accion = 'update' order by id desc limit 1`,
    );
    expect(audit).toMatchObject({ actor_tipo: "admin", actor_id: ADMIN, registro_id: "1" });
    expect(audit.antes.incremento_minimo).toBe(5000);
    expect(audit.despues.incremento_minimo).toBe(7000);
  });

  it("no acepta un cierre anterior (ni igual) al inicio", async () => {
    const [antes] = await directo(db, "select inicio_virtual, cierre_virtual from public.configuracion");
    for (const texto of [
      "update public.configuracion set cierre_virtual = inicio_virtual - interval '1 hour'",
      "update public.configuracion set cierre_virtual = inicio_virtual",
      "update public.configuracion set inicio_virtual = cierre_virtual + interval '1 day'",
    ]) {
      // mensajeDeErrorDb usa el código 23514 y el nombre de la restricción.
      expect(await falla(db, EQUIPO, texto), texto).toMatchObject({
        code: "23514",
        constraint: "cierre_posterior_al_inicio",
      });
    }
    const [despues] = await directo(db, "select inicio_virtual, cierre_virtual from public.configuracion");
    expect(despues).toEqual(antes);
  });

  it("crea, edita y borra artistas", async () => {
    const [nuevo] = await filas<{ id: string }>(
      db,
      EQUIPO,
      "insert into public.artistas (nombre, resena) values ('Artista nueva', 'Reseña') returning id",
    );
    expect(
      await afectadas(db, EQUIPO, "update public.artistas set nombre = 'Artista renombrada' where id = $1", [nuevo.id]),
    ).toBe(1);
    const [fila] = await directo(db, "select nombre from public.artistas where id = $1", [nuevo.id]);
    expect(fila).toEqual({ nombre: "Artista renombrada" });

    expect(await afectadas(db, EQUIPO, "delete from public.artistas where id = $1", [nuevo.id])).toBe(1);
    expect(await cantidad(db, "select count(*)::int as n from public.artistas where id = $1", [nuevo.id])).toBe(0);

    const audit = await directo<{ accion: string; actor_tipo: string; actor_id: string }>(
      db,
      "select accion, actor_tipo, actor_id from public.auditoria where tabla = 'artistas' and registro_id = $1 order by id",
      [nuevo.id],
    );
    expect(audit).toEqual(
      ["insert", "update", "delete"].map((accion) => ({ accion, actor_tipo: "admin", actor_id: ADMIN })),
    );
  });

  it("crea, edita y borra obras, y agrega y borra fotos", async () => {
    const [obra] = await filas<{ id: string }>(
      db,
      EQUIPO,
      "insert into public.obras (numero, artista_id) values (26, $1) returning id",
      [ARTISTA(1)],
    );
    expect(
      await afectadas(db, EQUIPO, "update public.obras set titulo = 'Obra nueva', publicada = true where id = $1", [
        obra.id,
      ]),
    ).toBe(1);

    const fotos = await filas<{ id: string }>(
      db,
      EQUIPO,
      `insert into public.obra_fotos (obra_id, ruta, texto_alternativo, orden, ancho, alto)
       values ($1, 'obras/26/a.jpg', 'Frente', 0, 2000, 1500), ($1, 'obras/26/b.jpg', 'Perfil', 1, 1500, 2000)
       returning id`,
      [obra.id],
    );
    expect(fotos).toHaveLength(2);
    const [publica] = await filas(db, ANON, "select titulo, portada_ruta from public.v_obras_publicas where numero = 26");
    expect(publica).toEqual({ titulo: "Obra nueva", portada_ruta: "obras/26/a.jpg" });

    expect(await afectadas(db, EQUIPO, "delete from public.obra_fotos where id = $1", [fotos[0].id])).toBe(1);
    expect(await cantidad(db, "select count(*)::int as n from public.obra_fotos where obra_id = $1", [obra.id])).toBe(1);

    // Al borrar la obra se borran sus fotos.
    expect(await afectadas(db, EQUIPO, "delete from public.obras where id = $1", [obra.id])).toBe(1);
    expect(await cantidad(db, "select count(*)::int as n from public.obras where id = $1", [obra.id])).toBe(0);
    expect(await cantidad(db, "select count(*)::int as n from public.obra_fotos where obra_id = $1", [obra.id])).toBe(0);

    const audit = await directo<{ tabla: string; accion: string; actor_tipo: string }>(
      db,
      `select tabla, accion, actor_tipo from public.auditoria
       where (tabla = 'obras' and registro_id = $1) or (tabla = 'obra_fotos' and despues ->> 'obra_id' = $1)
          or (tabla = 'obra_fotos' and antes ->> 'obra_id' = $1)
       order by id`,
      [obra.id],
    );
    expect(audit.every((a) => a.actor_tipo === "admin")).toBe(true);
    expect(audit.filter((a) => a.tabla === "obras").map((a) => a.accion)).toEqual(["insert", "update", "delete"]);
    expect(audit.filter((a) => a.tabla === "obra_fotos").map((a) => a.accion)).toEqual([
      "insert",
      "insert",
      "delete",
      "delete",
    ]);
  });

  it("no puede repetir el número de una obra", async () => {
    // mensajeDeErrorDb reconoce la restricción por el texto "numero".
    expect(
      await falla(db, EQUIPO, "insert into public.obras (numero, artista_id) values (1, $1)", [ARTISTA(1)]),
    ).toMatchObject({ code: "23505", constraint: "obras_numero_key" });
    expect(
      await falla(db, EQUIPO, "update public.obras set numero = 2 where id = $1", [OBRA(3)]),
    ).toMatchObject({ code: "23505", constraint: "obras_numero_key" });
  });

  it("no puede borrar una obra con ofertas", async () => {
    expect(await cantidad(db, "select count(*)::int as n from public.ofertas where obra_id = $1", [OBRA(1)])).toBeGreaterThan(0);
    // Postgres 18 (PGlite) informa 23001 (restrict_violation) para ON DELETE RESTRICT;
    // versiones anteriores informan 23503 (foreign_key_violation). El panel tiene que manejar ambos.
    const f = await falla(db, EQUIPO, "delete from public.obras where id = $1", [OBRA(1)]);
    expect(f?.constraint).toBe("ofertas_obra_id_fkey");
    expect(["23001", "23503"]).toContain(f?.code);
    expect(await cantidad(db, "select count(*)::int as n from public.obras where id = $1", [OBRA(1)])).toBe(1);
    expect(await cantidad(db, "select count(*)::int as n from public.obra_fotos where obra_id = $1", [OBRA(1)])).toBeGreaterThan(0);
  });

  it("no puede borrar un artista con obras", async () => {
    const f = await falla(db, EQUIPO, "delete from public.artistas where id = $1", [ARTISTA(6)]);
    expect(f?.constraint).toBe("obras_artista_id_fkey");
    expect(["23001", "23503"]).toContain(f?.code);
    expect(await cantidad(db, "select count(*)::int as n from public.artistas where id = $1", [ARTISTA(6)])).toBe(1);
  });

  it("edita textos: la versión sube solo si cambia el título o el contenido", async () => {
    const version = async () => {
      const [p] = await directo<{ version: number; provisorio: boolean; actualizada_por: string | null }>(
        db,
        "select version, provisorio, actualizada_por from public.paginas where slug = 'bases-y-condiciones'",
      );
      return p;
    };
    // Las migraciones de textos ya pudieron subir la versión inicial: se cuenta desde ahí.
    const inicial = await version();
    expect(inicial).toMatchObject({ provisorio: true, actualizada_por: null });
    const v = inicial.version;

    expect(
      await afectadas(db, EQUIPO, "update public.paginas set contenido = 'Bases aprobadas.' where slug = 'bases-y-condiciones'"),
    ).toBe(1);
    expect(await version()).toEqual({ version: v + 1, provisorio: true, actualizada_por: ADMIN });

    // Cambiar solo la marca de provisorio (o guardar el mismo texto) no sube la versión.
    await afectadas(db, EQUIPO, "update public.paginas set provisorio = false where slug = 'bases-y-condiciones'");
    expect(await version()).toEqual({ version: v + 1, provisorio: false, actualizada_por: ADMIN });
    await afectadas(
      db,
      EQUIPO,
      "update public.paginas set contenido = 'Bases aprobadas.' where slug = 'bases-y-condiciones'",
    );
    expect((await version()).version).toBe(v + 1);

    await afectadas(db, EQUIPO, "update public.paginas set titulo = 'Bases' where slug = 'bases-y-condiciones'");
    expect((await version()).version).toBe(v + 2);

    // Quien se registra a partir de ahora acepta la versión vigente.
    const uid = await nuevoOferente(db, "nueva@prueba.test", "20555666");
    const [ofe] = await directo(db, "select bases_version from public.oferentes where id = $1", [uid]);
    expect(ofe).toEqual({ bases_version: v + 2 });

    const [audit] = await directo(
      db,
      "select actor_tipo, actor_id from public.auditoria where tabla = 'paginas' and registro_id = 'bases-y-condiciones' order by id desc limit 1",
    );
    expect(audit).toEqual({ actor_tipo: "admin", actor_id: ADMIN });
  });

  // Si se pudiera fijar a mano, dos textos distintos de las bases podrían quedar con el mismo
  // número de versión aceptada (migración 20261019130000_ajustes_panel.sql).
  it("la versión de un texto no se puede cambiar a mano", async () => {
    const leer = async () =>
      (await directo<{ version: number }>(db, "select version from public.paginas where slug = 'destino'"))[0].version;
    const antes = await leer();
    await afectadas(db, EQUIPO, "update public.paginas set version = 100 where slug = 'destino'");
    expect(await leer()).toBe(antes);
  });

  it("bloquea y desbloquea a un oferente con motivo", async () => {
    const id = OFERENTE(1);
    expect(
      await afectadas(
        db,
        EQUIPO,
        "update public.oferentes set bloqueado = true, bloqueo_motivo = 'Datos de contacto falsos' where id = $1",
        [id],
      ),
    ).toBe(1);
    const [fila] = await directo(db, "select bloqueado, bloqueo_motivo from public.oferentes where id = $1", [id]);
    expect(fila).toEqual({ bloqueado: true, bloqueo_motivo: "Datos de contacto falsos" });
    expect(await ofertar(db, id, OBRA(6), 50000)).toMatchObject({ ok: false, codigo: "bloqueado" });

    const [audit] = await directo<{ actor_tipo: string; antes: { bloqueado: boolean }; despues: { bloqueado: boolean } }>(
      db,
      "select actor_tipo, antes, despues from public.auditoria where tabla = 'oferentes' and registro_id = $1 order by id desc limit 1",
      [id],
    );
    expect(audit.actor_tipo).toBe("admin");
    expect([audit.antes.bloqueado, audit.despues.bloqueado]).toEqual([false, true]);

    expect(
      await afectadas(db, EQUIPO, "update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1", [
        id,
      ]),
    ).toBe(1);
    expect(await ofertar(db, id, OBRA(6), 50000)).toMatchObject({ ok: true });
  });

  it("no puede bloquear sin un motivo de al menos 5 letras", async () => {
    const id = OFERENTE(2);
    for (const motivo of [null, "", "   ", "abc"]) {
      expect(
        await falla(db, EQUIPO, "update public.oferentes set bloqueado = true, bloqueo_motivo = $2 where id = $1", [
          id,
          motivo,
        ]),
        String(motivo),
      ).toMatchObject({ code: "23514", constraint: "bloqueo_con_motivo" });
    }
    const [fila] = await directo(db, "select bloqueado from public.oferentes where id = $1", [id]);
    expect(fila).toEqual({ bloqueado: false });
  });

  it("no puede cambiar los datos personales de un oferente", async () => {
    const id = OFERENTE(3);
    const [antes] = await directo(db, "select nombre, apellido, dni, telefono, email from public.oferentes where id = $1", [id]);
    for (const [columna, valor] of [
      ["dni", "40111222"],
      ["nombre", "Otro"],
      ["apellido", "Otro"],
      ["email", "otro@prueba.test"],
      ["telefono", "3815550001"],
      ["bases_version", 9],
      ["alias_numero", 999],
    ] as const) {
      const f = await falla(db, EQUIPO, `update public.oferentes set ${columna} = $2 where id = $1`, [id, valor]);
      expect(f, columna).toMatchObject({ code: "42501" });
      expect(f?.message, columna).toMatch(/permission denied for table oferentes/);
    }
    expect(await error(db, EQUIPO, "delete from public.oferentes where id = $1", [id])).toMatch(/permission denied/);
    const [despues] = await directo(db, "select nombre, apellido, dni, telefono, email from public.oferentes where id = $1", [id]);
    expect(despues).toEqual(antes);
  });

  it("no puede borrar ni editar ofertas o auditoría por fuera de anular_oferta", async () => {
    const intentos = [
      "delete from public.ofertas where id = 1",
      "update public.ofertas set estado = 'anulada', anulada_at = now(), anulada_por = auth.uid(), motivo_anulacion = 'Sin la función' where id = 1",
      `insert into public.ofertas (obra_id, oferente_id, monto) values ('${OBRA(6)}', '${OFERENTE(1)}', 99000)`,
      "delete from public.auditoria",
      "update public.auditoria set accion = 'otra'",
      "insert into public.auditoria (actor_tipo, accion) values ('admin', 'falsa')",
      "update public.avisos_correo set estado = 'descartado'",
      "insert into public.admins (user_id, nombre) values (gen_random_uuid(), 'Otro')",
      "delete from public.configuracion",
      "delete from public.paginas where slug = 'destino'",
      "truncate public.obra_fotos",
    ];
    for (const texto of intentos) {
      expect(await error(db, EQUIPO, texto), texto).toMatch(/permission denied/);
    }
    const [oferta] = await directo(db, "select estado from public.ofertas where id = 1");
    expect(oferta).toEqual({ estado: "valida" });
  });

  it("registrar_evento deja la acción y el detalle en la auditoría", async () => {
    await filas(db, EQUIPO, "select public.registrar_evento($1, $2::jsonb)", [
      "exportar_listado",
      JSON.stringify({ formato: "xlsx", filas: 25 }),
    ]);
    await filas(db, EQUIPO, "select public.registrar_evento('descargar_qr')");

    const eventos = await directo(
      db,
      `select actor_id, actor_tipo, accion, tabla, registro_id, antes, despues, detalle
       from public.auditoria where accion in ('exportar_listado', 'descargar_qr') order by id`,
    );
    expect(eventos).toEqual([
      {
        actor_id: ADMIN,
        actor_tipo: "admin",
        accion: "exportar_listado",
        tabla: null,
        registro_id: null,
        antes: null,
        despues: null,
        detalle: { formato: "xlsx", filas: 25 },
      },
      {
        actor_id: ADMIN,
        actor_tipo: "admin",
        accion: "descargar_qr",
        tabla: null,
        registro_id: null,
        antes: null,
        despues: null,
        detalle: null,
      },
    ]);

    // El equipo lo ve desde el panel.
    const vistos = await filas(db, EQUIPO, "select accion from public.auditoria where accion = 'exportar_listado'");
    expect(vistos).toEqual([{ accion: "exportar_listado" }]);
  });
});

// ---------------------------------------------------------------------------

describe("indicadores del panel", () => {
  let db: PGlite;

  /** Lo mismo que calcula indicadores(), escrito por separado (como superusuario). */
  async function esperado(): Promise<Indicadores> {
    const [r] = await directo<Indicadores>(
      db,
      `with vigentes as (
         select o.*
         from public.ofertas o
         where o.estado = 'valida'
           and exists (
             select 1 from auth.users u where u.id = o.oferente_id and u.email_confirmed_at is not null
           )
       ),
       maximos as (
         select v.obra_id, max(v.monto) as monto
         from vigentes v
         where v.obra_id in (select id from public.obras where publicada)
         group by v.obra_id
       )
       select
         (select count(*)::int from vigentes) as ofertas_validas,
         (select count(*)::int from public.ofertas where estado = 'anulada') as ofertas_anuladas,
         (select count(*)::int from public.oferentes) as oferentes_registrados,
         (select count(distinct oferente_id)::int from vigentes) as oferentes_con_ofertas,
         (
           select count(*)::int
           from auth.users u
           left join public.oferentes o on o.id = u.id
           left join public.admins a on a.user_id = u.id
           where o.id is null and a.user_id is null
         ) as ingresos_sin_registro,
         (select coalesce(sum(monto), 0)::int from maximos) as monto_acumulado,
         (select count(*)::int from public.obras where publicada) as obras_publicadas,
         (select count(*)::int from maximos) as obras_con_ofertas`,
    );
    return r;
  }

  beforeAll(async () => {
    db = await baseDePrueba();
  });

  it("con los datos de ejemplo coinciden con un cálculo independiente", async () => {
    const r = await indicadores(db);
    expect(r).toEqual(await esperado());
    expect(r).toMatchObject({
      ofertas_anuladas: 0,
      oferentes_registrados: 14,
      ingresos_sin_registro: 0,
      obras_publicadas: 25,
    });
    expect(r.monto_acumulado).toBeGreaterThan(0);
    expect(r.obras_con_ofertas).toBeLessThan(25);

    // El monto acumulado es la suma de los precios base del listado final.
    const [listado] = await filas<{ suma: number }>(
      db,
      EQUIPO,
      "select coalesce(sum(precio_base), 0)::int as suma from public.v_listado_final where publicada",
    );
    expect(r.monto_acumulado).toBe(listado.suma);
  });

  it("cuentan ingresos sin registro y nuevas ofertas", async () => {
    const antes = await indicadores(db);
    await crearUsuario(db, "solo-ingreso@prueba.test");
    const ana = await nuevoOferente(db, "ana@prueba.test", "20111222");
    expect((await ofertar(db, ana, OBRA(6), 10000)).ok).toBe(true); // obra sin ofertas
    expect((await ofertar(db, ana, OBRA(1), 15000)).ok).toBe(true); // supera 10.000

    const r = await indicadores(db);
    expect(r).toEqual(await esperado());
    expect(r).toMatchObject({
      ingresos_sin_registro: antes.ingresos_sin_registro + 1,
      oferentes_registrados: antes.oferentes_registrados + 1,
      oferentes_con_ofertas: antes.oferentes_con_ofertas + 1,
      ofertas_validas: antes.ofertas_validas + 2,
      obras_con_ofertas: antes.obras_con_ofertas + 1,
      monto_acumulado: antes.monto_acumulado + 10000 + 5000,
    });
  });

  it("no cuentan ofertas de correos sin verificar", async () => {
    const antes = await indicadores(db);
    await ofertaSinVerificar(db, OBRA(2), 999000);
    const r = await indicadores(db);
    expect(r).toEqual(await esperado());
    expect(r).toEqual({ ...antes, oferentes_registrados: antes.oferentes_registrados + 1 });
  });

  it("al anular la oferta más alta, el monto acumulado baja a la siguiente", async () => {
    const antes = await indicadores(db);
    const [primera, segunda] = await ofertasVigentes(db, OBRA(5));
    expect(segunda).toBeDefined();
    expect(await anular(db, EQUIPO, primera.id, "Oferta duplicada por error")).toMatchObject({ ok: true });

    const r = await indicadores(db);
    expect(r).toEqual(await esperado());
    expect(r).toMatchObject({
      ofertas_anuladas: antes.ofertas_anuladas + 1,
      ofertas_validas: antes.ofertas_validas - 1,
      monto_acumulado: antes.monto_acumulado - primera.monto + segunda.monto,
      obras_con_ofertas: antes.obras_con_ofertas,
    });
  });

  it("una obra despublicada no suma al monto acumulado", async () => {
    const antes = await indicadores(db);
    const [mejor] = await ofertasVigentes(db, OBRA(4));
    expect(mejor).toBeDefined();
    expect(await afectadas(db, EQUIPO, "update public.obras set publicada = false where id = $1", [OBRA(4)])).toBe(1);

    const r = await indicadores(db);
    expect(r).toEqual(await esperado());
    expect(r).toMatchObject({
      obras_publicadas: antes.obras_publicadas - 1,
      obras_con_ofertas: antes.obras_con_ofertas - 1,
      monto_acumulado: antes.monto_acumulado - mejor.monto,
    });
  });
});

// ---------------------------------------------------------------------------

describe("listado final y ofertas del panel", () => {
  let db: PGlite;

  type FilaListado = {
    obra_id: string;
    numero: number;
    publicada: boolean;
    precio_salida: number;
    precio_base: number | null;
    alias_numero: number | null;
    dni: string | null;
    email: string | null;
    cantidad_ofertas: number;
  };

  async function listado() {
    return filas<FilaListado>(
      db,
      EQUIPO,
      `select obra_id, numero, publicada, precio_salida, precio_base, alias_numero, dni, email, cantidad_ofertas
       from public.v_listado_final order by numero`,
    );
  }

  async function filaDe(numero: number) {
    const fila = (await listado()).find((f) => f.numero === numero);
    if (!fila) throw new Error(`La obra ${numero} no está en el listado`);
    return fila;
  }

  async function datosDe(oferenteId: string) {
    const [ofe] = await directo<{ alias_numero: number; dni: string; email: string }>(
      db,
      "select alias_numero, dni, email from public.oferentes where id = $1",
      [oferenteId],
    );
    return ofe;
  }

  beforeAll(async () => {
    db = await baseDePrueba();
  });

  it("el precio base de cada obra es su mayor oferta válida, con los datos de quien la hizo", async () => {
    const filasListado = await listado();
    expect(filasListado).toHaveLength(25);
    for (const fila of filasListado) {
      const vigentes = await ofertasVigentes(db, fila.obra_id);
      expect(fila.cantidad_ofertas, `obra ${fila.numero}`).toBe(vigentes.length);
      if (vigentes.length === 0) {
        expect(fila).toMatchObject({ precio_base: null, alias_numero: null, dni: null, email: null });
        continue;
      }
      expect(fila.precio_base, `obra ${fila.numero}`).toBe(Math.max(...vigentes.map((v) => v.monto)));
      expect(fila).toMatchObject(await datosDe(vigentes[0].oferente_id));
    }
    expect(filasListado.some((f) => f.precio_base === null)).toBe(true);
  });

  it("una oferta de un correo sin verificar no es precio base", async () => {
    const antes = await filaDe(2);
    await ofertaSinVerificar(db, OBRA(2), 999000);
    expect(await filaDe(2)).toEqual(antes);
  });

  it("al anular la oferta más alta, el precio base pasa a la siguiente", async () => {
    const [primera, segunda] = await ofertasVigentes(db, OBRA(5));
    expect(segunda).toBeDefined();
    const antes = await filaDe(5);
    expect(antes.precio_base).toBe(primera.monto);

    expect(await anular(db, EQUIPO, primera.id, "Oferente pidió la baja por escrito")).toMatchObject({ ok: true });
    const despues = await filaDe(5);
    expect(despues).toMatchObject({
      precio_base: segunda.monto,
      cantidad_ofertas: antes.cantidad_ofertas - 1,
      ...(await datosDe(segunda.oferente_id)),
    });

    // En las ofertas del panel la anulada sigue visible, con el motivo y quién la anuló.
    const ofertas = await filas<{ id: number; estado: string; motivo_anulacion: string | null; anulada_por_nombre: string | null; es_la_mas_alta: boolean }>(
      db,
      EQUIPO,
      `select id::int as id, estado::text as estado, motivo_anulacion, anulada_por_nombre, es_la_mas_alta
       from public.v_ofertas_admin where obra_id = $1 order by monto desc`,
      [OBRA(5)],
    );
    expect(ofertas[0]).toEqual({
      id: primera.id,
      estado: "anulada",
      motivo_anulacion: "Oferente pidió la baja por escrito",
      anulada_por_nombre: "Equipo de ejemplo",
      es_la_mas_alta: false,
    });
    expect(ofertas.filter((o) => o.es_la_mas_alta).map((o) => o.id)).toEqual([segunda.id]);
  });

  it("si se anulan todas las ofertas de una obra, queda sin precio base", async () => {
    const vigentes = await ofertasVigentes(db, OBRA(1));
    expect(vigentes.length).toBeGreaterThan(0);
    for (const v of vigentes) {
      expect(await anular(db, EQUIPO, v.id, "Prueba de anulación total")).toMatchObject({ ok: true });
    }
    expect(await filaDe(1)).toMatchObject({ precio_base: null, dni: null, cantidad_ofertas: 0 });
  });

  it("una obra no publicada aparece igual en el listado (con publicada = false)", async () => {
    const antes = await filaDe(3);
    expect(antes.precio_base).not.toBeNull();
    expect(await afectadas(db, EQUIPO, "update public.obras set publicada = false where id = $1", [OBRA(3)])).toBe(1);

    expect(await listado()).toHaveLength(25);
    expect(await filaDe(3)).toEqual({ ...antes, publicada: false });
    const publicas = await filas(db, ANON, "select numero from public.v_obras_publicas where numero = 3");
    expect(publicas).toHaveLength(0);
  });

  it("toma el precio de salida propio de la obra o el general", async () => {
    await afectadas(db, EQUIPO, "update public.obras set precio_salida = 30000 where id = $1", [OBRA(6)]);
    expect((await filaDe(6)).precio_salida).toBe(30000);
    expect((await filaDe(7)).precio_salida).toBe(10000);
  });
});

// ---------------------------------------------------------------------------

describe("cola de avisos por correo (la usa el servidor)", () => {
  let db: PGlite;
  let ana: string;
  let beto: string;

  /**
   * Avisos que el servidor enviaría ahora a esa persona. avisos_para_enviar los reserva:
   * acá se deshace la reserva para solo mirar la cola.
   */
  async function avisosPara(uid: string) {
    return db.transaction(async (tx) => {
      const { rows } = await tx.query<{ aviso_id: number; email: string }>(
        `select a.aviso_id::int as aviso_id, a.email
         from public.avisos_para_enviar(100) a
         join public.avisos_correo c on c.id = a.aviso_id
         where c.oferente_id = $1`,
        [uid],
      );
      await tx.rollback();
      return rows;
    });
  }

  beforeAll(async () => {
    db = await baseDePrueba();
    ana = await nuevoOferente(db, "ana@prueba.test", "20111222");
    beto = await nuevoOferente(db, "beto@prueba.test", "20333444");
    expect((await ofertar(db, ana, OBRA(6), 10000)).ok).toBe(true);
    expect((await ofertar(db, beto, OBRA(6), 15000)).ok).toBe(true);
  });

  it("encola el aviso para quien quedó superado", async () => {
    expect(await avisosPara(ana)).toEqual([{ aviso_id: expect.any(Number), email: "ana@prueba.test" }]);
    expect(await avisosPara(beto)).toEqual([]);
  });

  // Un aviso pendiente (o en error, que se reintenta) no sale si la persona desactivó los avisos.
  it("no envía avisos a quien desactivó los avisos por correo", async () => {
    const [r] = await filas<{ r: { ok: boolean } }>(
      db,
      { rol: "authenticated", uid: ana },
      "select public.actualizar_mis_datos('3815551234', false) as r",
    );
    expect(r.r.ok).toBe(true);
    try {
      expect(await avisosPara(ana)).toEqual([]);
    } finally {
      await db.query("update public.oferentes set avisos_por_correo = true where id = $1", [ana]);
    }
  });

  // Si quien fue superado vuelve a tener la oferta más alta antes del envío, no recibe
  // "Superaron tu oferta"; si la vuelven a superar, el mismo aviso pendiente se habilita.
  it("no avisa \"te superaron\" a quien ya volvió a tener la oferta más alta", async () => {
    expect((await ofertar(db, ana, OBRA(6), 20000)).ok).toBe(true);
    expect(await avisosPara(ana)).toEqual([]);
    expect((await ofertar(db, beto, OBRA(6), 25000)).ok).toBe(true);
    expect(await avisosPara(ana)).toEqual([{ aviso_id: expect.any(Number), email: "ana@prueba.test" }]);
  });

  it("marcar_aviso saca de la cola los avisos enviados", async () => {
    // Reserva de verdad (como el servidor): el intento se cuenta al reservar.
    const pendientes = await directo<{ aviso_id: number }>(
      db,
      `select a.aviso_id::int as aviso_id
       from public.avisos_para_enviar(100) a
       join public.avisos_correo c on c.id = a.aviso_id
       where c.oferente_id = $1`,
      [ana],
    );
    expect(pendientes.length).toBeGreaterThan(0);
    for (const a of pendientes) await db.query("select public.marcar_aviso($1, true)", [a.aviso_id]);
    expect(await avisosPara(ana)).toEqual([]);
    const [fila] = await directo(
      db,
      "select estado, intentos, reservado_hasta from public.avisos_correo where id = $1",
      [pendientes[0].aviso_id],
    );
    expect(fila).toEqual({ estado: "enviado", intentos: 1, reservado_hasta: null });
  });
});
