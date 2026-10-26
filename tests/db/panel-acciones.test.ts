// Acciones del panel con la base de prueba (PGlite): las confirmaciones extra al despublicar una
// obra con ofertas y al tocar las fechas con la etapa cerrada, y la búsqueda de oferentes por POST.
// Se usan los módulos reales de datos y acciones; solo se reemplazan la sesión, la conexión y
// las funciones de Next que necesitan un pedido.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";

const prueba = vi.hoisted(() => ({
  db: undefined as unknown as PGlite,
  admin: { id: "00000000-0000-4000-d000-000000000001", email: "admin@ejemplo.test", nombre: "Equipo de ejemplo" },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect: ${url}`);
  },
}));
vi.mock("@/lib/almacenamiento", () => ({ borrarFoto: vi.fn(), guardarFoto: vi.fn() }));
vi.mock("@/lib/admin/sesion", () => ({
  requerirAdmin: async () => prueba.admin,
  adminActual: async () => prueba.admin,
  comoAdmin: (admin: { id: string }) => ({ rol: "authenticated", uid: admin.id }),
}));
// Mismo motor que el modo local: rol y claims dentro de cada transacción, con RLS.
vi.mock("@/lib/db", () => {
  type Ctx = { rol: "anon" } | { rol: "authenticated"; uid: string } | { rol: "servicio" };
  type Q = (texto: string, params?: unknown[]) => Promise<unknown[]>;
  const conBase = (ctx: Ctx, fn: (q: Q) => Promise<unknown>) =>
    prueba.db.transaction(async (tx) => {
      if (ctx.rol !== "servicio") {
        const claims = ctx.rol === "authenticated" ? { sub: ctx.uid, role: ctx.rol } : { role: ctx.rol };
        await tx.query("select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)", [
          JSON.stringify(claims),
          ctx.rol,
        ]);
      }
      return fn(async (texto, params) => (await tx.query(texto, params ?? [])).rows);
    });
  return {
    conBase,
    consultar: (ctx: Ctx, texto: string, params?: unknown[]) => conBase(ctx, (q) => q(texto, params)),
  };
});

import { guardarConfiguracion } from "@/app/admin/(panel)/configuracion/acciones";
import { actualizarObraAccion, crearObraAccion } from "@/app/admin/(panel)/obras/acciones";
import { guardarFoto } from "@/lib/almacenamiento";
import { buscarOferentesAccion } from "@/app/admin/(panel)/oferentes/acciones";
import {
  actualizarConfiguracion,
  obtenerConfiguracion,
  type ConfiguracionAdmin,
  type DatosConfiguracion,
} from "@/lib/datos/admin/configuracion";
import { actualizarObra, type DatosObra } from "@/lib/datos/admin/obras";
import { aInputLocal } from "@/lib/fechas";
import { fechaHoraLarga, pesos } from "@/lib/formato";
import { OBRA, baseDePrueba } from "./ayuda";

const ARTISTA = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const HORA = 60 * 60 * 1000;

async function directo<T = Record<string, unknown>>(texto: string, params: unknown[] = []) {
  return (await prueba.db.query<T>(texto, params)).rows;
}

function formulario(campos: Record<string, string | undefined>) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) if (valor !== undefined) datos.set(clave, valor);
  return datos;
}

// ---------------------------------------------------------------------------
// Obras: despublicar con ofertas válidas
// ---------------------------------------------------------------------------

describe("despublicar una obra con ofertas", () => {
  beforeAll(async () => {
    prueba.db = await baseDePrueba();
  });

  const datosObra = (n: number, publicada: boolean): DatosObra => ({
    numero: n,
    titulo: `Título de ejemplo ${n}`,
    artistaId: ARTISTA(n),
    resena: "Reseña de prueba.",
    tecnica: null,
    altoCm: null,
    anchoCm: null,
    profundidadCm: null,
    medidasAproximadas: false,
    precioSalida: null,
    publicada,
  });

  async function ofertasDe(n: number) {
    const [f] = await directo<{ cantidad: number; mayor: number }>(
      "select count(*)::int as cantidad, max(monto)::int as mayor from public.ofertas where obra_id = $1 and estado = 'valida'",
      [OBRA(n)],
    );
    return f;
  }

  async function publicada(n: number) {
    const [f] = await directo<{ publicada: boolean }>("select publicada from public.obras where id = $1", [OBRA(n)]);
    return f.publicada;
  }

  it("pide confirmación con la cantidad de ofertas y la mayor, y no guarda hasta tenerla", async () => {
    const { cantidad, mayor } = await ofertasDe(3);
    expect(cantidad).toBeGreaterThan(0);

    const r = await actualizarObra(prueba.admin, OBRA(3), datosObra(3, false));
    expect(r).toEqual({
      ok: false,
      motivo: "confirmar_despublicar",
      ofertasValidas: cantidad,
      mayorOferta: mayor,
      clave: `${cantidad}:${mayor}`,
    });
    expect(await publicada(3)).toBe(true);

    // Una confirmación de otro aviso (otra cantidad u otro monto) no vale.
    const otra = await actualizarObra(prueba.admin, OBRA(3), datosObra(3, false), `${cantidad + 1}:${mayor}`);
    expect(otra.ok).toBe(false);
    expect(await publicada(3)).toBe(true);

    const confirmada = await actualizarObra(prueba.admin, OBRA(3), datosObra(3, false), `${cantidad}:${mayor}`);
    expect(confirmada).toEqual({ ok: true });
    expect(await publicada(3)).toBe(false);

    // Ya despublicada: guardar otros cambios no vuelve a pedir la confirmación.
    expect(await actualizarObra(prueba.admin, OBRA(3), datosObra(3, false))).toEqual({ ok: true });
  });

  it("no pide confirmación si la obra no tiene ofertas válidas o si sigue publicada", async () => {
    expect((await ofertasDe(6)).cantidad).toBe(0);
    expect(await actualizarObra(prueba.admin, OBRA(6), datosObra(6, false))).toEqual({ ok: true });
    expect(await publicada(6)).toBe(false);
    expect(await actualizarObra(prueba.admin, OBRA(4), datosObra(4, true))).toEqual({ ok: true });
  });

  it("devuelve no_encontrada para una obra que no existe", async () => {
    expect(await actualizarObra(prueba.admin, OBRA(999), datosObra(99, false))).toEqual({
      ok: false,
      motivo: "no_encontrada",
    });
  });

  it("la acción muestra el aviso y guarda al reenviar con la confirmación marcada", async () => {
    const { cantidad, mayor } = await ofertasDe(5);
    const campos = {
      id: OBRA(5),
      numero: "5",
      titulo: "Título de ejemplo 5",
      artista_id: ARTISTA(5),
      resena: "Reseña de prueba.",
      tecnica: "",
      precio_salida: "",
    };

    const aviso = await actualizarObraAccion({}, formulario(campos));
    expect(aviso.ok).toBeUndefined();
    expect(aviso.error).toMatch(/ofertas válidas/);
    expect(aviso.errores?.confirmar_despublicar).toContain(`${cantidad} ofertas válidas`);
    expect(aviso.errores?.confirmar_despublicar).toContain(pesos(mayor));
    expect(aviso.errores?.confirmar_despublicar).toContain("listado final");
    expect(aviso.errores?.confirmar_despublicar).toContain("Mis ofertas");
    expect(aviso.valores?.confirmacion_para).toBe(`${cantidad}:${mayor}`);
    expect(await publicada(5)).toBe(true);

    // Sin marcar la casilla, aunque venga la clave, vuelve a pedirla.
    const sinMarcar = await actualizarObraAccion(aviso, formulario({ ...campos, confirmacion_para: aviso.valores?.confirmacion_para }));
    expect(sinMarcar.errores?.confirmar_despublicar).toBeDefined();
    expect(await publicada(5)).toBe(true);

    const guardada = await actualizarObraAccion(
      aviso,
      formulario({ ...campos, confirmacion_para: aviso.valores?.confirmacion_para, confirmar_despublicar: "si" }),
    );
    expect(guardada).toMatchObject({ ok: true });
    expect(await publicada(5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Configuración con la etapa virtual cerrada
// ---------------------------------------------------------------------------

describe("configuración con la etapa cerrada", () => {
  beforeAll(async () => {
    prueba.db = await baseDePrueba();
  });

  const datosDe = (c: ConfiguracionAdmin): DatosConfiguracion => ({
    inicio: c.inicio,
    cierre: c.cierre,
    fechasConfirmadas: c.fechasConfirmadas,
    fechaPresencial: c.fechaPresencial,
    detallePresencial: c.detallePresencial,
    incrementoMinimo: c.incrementoMinimo,
    precioSalida: c.precioSalida,
    modoEjemplo: c.modoEjemplo,
    extensionActiva: c.extensionActiva,
    extensionMinutos: c.extensionMinutos,
  });

  async function cerrarHaceUnaHora() {
    await directo(
      "update public.configuracion set cierre_virtual = date_trunc('minute', now()) - interval '1 hour', fechas_confirmadas = true where id = 1",
    );
    const c = await obtenerConfiguracion(prueba.admin);
    expect(c.fase).toBe("cerrada");
    return c;
  }

  async function ofertasDesde(desde: Date) {
    const [f] = await directo<{ cantidad: number; obras: number; ultima: string | Date | null }>(
      `select count(*)::int as cantidad, count(distinct o.obra_id)::int as obras, max(o.creada_at) as ultima
       from public.ofertas o join public.obras ob on ob.id = o.obra_id and ob.publicada
       where o.estado = 'valida' and o.creada_at >= $1`,
      [desde.toISOString()],
    );
    return { cantidad: f.cantidad, obras: f.obras, ultima: f.ultima == null ? null : new Date(f.ultima) };
  }

  it("cambiar el cierre pide confirmación e informa las ofertas posteriores al nuevo cierre", async () => {
    const c = await cerrarHaceUnaHora();
    const nuevoCierre = new Date(Math.floor((Date.now() - 20 * HORA) / 60000) * 60000);
    const esperadas = await ofertasDesde(nuevoCierre);
    expect(esperadas.cantidad).toBeGreaterThan(0);

    const r = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: nuevoCierre }, []);
    expect(r).toEqual({
      ok: false,
      codigo: "requiere_confirmacion",
      motivos: [{ tipo: "cambia_cierre", cierreActual: c.cierre, nuevoCierre, posteriores: esperadas }],
    });

    // Confirmar otro motivo no alcanza.
    const otro = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: nuevoCierre }, ["reabre"]);
    expect(otro.ok).toBe(false);

    const ok = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: nuevoCierre }, ["cambia_cierre"]);
    expect(ok).toEqual({ ok: true, sinCambios: false, fase: "cerrada" });
    const [guardada] = await directo<{ cierre: string | Date }>("select cierre_virtual as cierre from public.configuracion");
    expect(new Date(guardada.cierre).getTime()).toBe(nuevoCierre.getTime());
  });

  it("un cierre posterior que ya pasó no informa ofertas posteriores", async () => {
    const c = await cerrarHaceUnaHora();
    const nuevoCierre = new Date(c.cierre.getTime() + 30 * 60000);
    const r = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: nuevoCierre }, []);
    expect(r).toMatchObject({
      ok: false,
      motivos: [{ tipo: "cambia_cierre", posteriores: { cantidad: 0, obras: 0, ultima: null } }],
    });
  });

  it("desmarcar las fechas confirmadas pide confirmación", async () => {
    const c = await cerrarHaceUnaHora();
    const r = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), fechasConfirmadas: false }, []);
    expect(r).toEqual({ ok: false, codigo: "requiere_confirmacion", motivos: [{ tipo: "desconfirma_cerrada" }] });
    // La confirmación de la etapa abierta («desconfirma») no sirve para la etapa cerrada.
    expect((await actualizarConfiguracion(prueba.admin, { ...datosDe(c), fechasConfirmadas: false }, ["desconfirma"])).ok).toBe(
      false,
    );
    const ok = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), fechasConfirmadas: false }, ["desconfirma_cerrada"]);
    expect(ok).toEqual({ ok: true, sinCambios: false, fase: "por_confirmar" });
  });

  it("reabrir ahora o más adelante pide confirmación; otros cambios no", async () => {
    const c = await cerrarHaceUnaHora();
    const enUnaSemana = new Date(Math.floor((Date.now() + 7 * 24 * HORA) / 60000) * 60000);

    const ahora = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: enUnaSemana }, []);
    expect(ahora).toMatchObject({ ok: false, motivos: [{ tipo: "reabre", nuevoInicio: null, nuevoCierre: enUnaSemana }] });

    const manana = new Date(Math.floor((Date.now() + 24 * HORA) / 60000) * 60000);
    const despues = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), inicio: manana, cierre: enUnaSemana }, []);
    expect(despues).toMatchObject({ ok: false, motivos: [{ tipo: "reabre", nuevoInicio: manana }] });

    const incremento = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), incrementoMinimo: 7000 }, []);
    expect(incremento).toEqual({ ok: true, sinCambios: false, fase: "cerrada" });
  });

  it("la acción explica el efecto y guarda al confirmar", async () => {
    const c = await cerrarHaceUnaHora();
    const campos = {
      inicio: aInputLocal(c.inicio),
      cierre: aInputLocal(c.cierre),
      fecha_presencial: c.fechaPresencial ?? "",
      detalle_presencial: c.detallePresencial ?? "",
      incremento_minimo: String(c.incrementoMinimo),
      precio_salida: String(c.precioSalida),
      modo_ejemplo: c.modoEjemplo ? "si" : undefined,
      extension_minutos: String(c.extensionMinutos),
    };

    const aviso = await guardarConfiguracion({}, formulario(campos));
    expect(aviso.ok).toBeUndefined();
    expect(aviso.errores?.confirmacion).toContain("Pasa a subasta presencial con base de");
    expect(aviso.errores?.confirmacion).toContain("PRELIMINAR");

    const adelantado = aInputLocal(new Date(Date.now() - 20 * HORA));
    const avisoCierre = await guardarConfiguracion({}, formulario({ ...campos, fechas_confirmadas: "si", cierre: adelantado }));
    expect(avisoCierre.errores?.confirmacion).toContain("listado FINAL");
    expect(avisoCierre.errores?.confirmacion).toContain(`cerró el ${fechaHoraLarga(c.cierre)}`);
    expect(avisoCierre.errores?.confirmacion).toMatch(/Hay \d+ ofertas? válidas? registradas? en \d+ obras? después del nuevo cierre/);

    const ok = await guardarConfiguracion(
      aviso,
      formulario({ ...campos, confirmar: "si", confirmacion_para: aviso.valores?.confirmacion_para }),
    );
    expect(ok).toMatchObject({ ok: true });
    expect((await obtenerConfiguracion(prueba.admin)).fase).toBe("por_confirmar");
  });

  it("pasada la hora de cierre, la extensión no se puede activar ni cambiar (salvo que se reabra)", async () => {
    const c = await cerrarHaceUnaHora();
    expect(await actualizarConfiguracion(prueba.admin, { ...datosDe(c), extensionActiva: true }, [])).toEqual({
      ok: false,
      codigo: "extension_cerrada",
    });
    // Apagada, cambiar los minutos no cambia ningún cierre.
    const minutos = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), extensionMinutos: 5 }, []);
    expect(minutos).toMatchObject({ ok: true, sinCambios: false });

    const campos = {
      inicio: aInputLocal(c.inicio),
      cierre: aInputLocal(c.cierre),
      fechas_confirmadas: "si",
      fecha_presencial: c.fechaPresencial ?? "",
      detalle_presencial: c.detallePresencial ?? "",
      incremento_minimo: String(c.incrementoMinimo),
      precio_salida: String(c.precioSalida),
      modo_ejemplo: c.modoEjemplo ? "si" : undefined,
      extension_activa: "si",
      extension_minutos: "3",
    };
    const r = await guardarConfiguracion({}, formulario(campos));
    expect(r.errores?.extension_activa).toContain("Ya pasó la hora de cierre general");
    expect((await guardarConfiguracion({}, formulario({ ...campos, extension_minutos: "45" }))).errores?.extension_minutos).toContain(
      "entre 1 y 30",
    );

    const enUnaSemana = new Date(Math.floor((Date.now() + 7 * 24 * HORA) / 60000) * 60000);
    const reabre = await actualizarConfiguracion(
      prueba.admin,
      { ...datosDe(c), cierre: enUnaSemana, extensionActiva: true },
      ["reabre"],
    );
    expect(reabre).toMatchObject({ ok: true });
    expect(await obtenerConfiguracion(prueba.admin)).toMatchObject({ extensionActiva: true, extension: { minutos: 3 } });
    await directo("update public.configuracion set extension_activa = false, extension_minutos = 3 where id = 1");
  });

  it("con la etapa abierta, adelantar el cierre a una hora que ya pasó informa las ofertas posteriores", async () => {
    await directo(
      "update public.configuracion set cierre_virtual = date_trunc('minute', now()) + interval '5 days', fechas_confirmadas = true where id = 1",
    );
    const c = await obtenerConfiguracion(prueba.admin);
    expect(c.fase).toBe("abierta");
    const nuevoCierre = new Date(Math.floor((Date.now() - 20 * HORA) / 60000) * 60000);
    const r = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: nuevoCierre }, []);
    expect(r).toMatchObject({
      ok: false,
      motivos: [{ tipo: "adelanta_cierre", yaPaso: true, posteriores: await ofertasDesde(nuevoCierre) }],
    });

    const enDosDias = new Date(Math.floor((Date.now() + 48 * HORA) / 60000) * 60000);
    const futuro = await actualizarConfiguracion(prueba.admin, { ...datosDe(c), cierre: enDosDias }, []);
    expect(futuro).toMatchObject({
      ok: false,
      motivos: [{ tipo: "adelanta_cierre", yaPaso: false, posteriores: { cantidad: 0, obras: 0, ultima: null } }],
    });
  });
});

// ---------------------------------------------------------------------------
// Oferentes: búsqueda por POST
// ---------------------------------------------------------------------------

describe("búsqueda de oferentes", () => {
  beforeAll(async () => {
    prueba.db = await baseDePrueba();
  });

  it("busca por DNI con puntos y por correo, y devuelve los resultados", async () => {
    const porDni = await buscarOferentesAccion(null, formulario({ q: " 30.000.003 " }));
    expect(porDni).toMatchObject({ busqueda: "30.000.003", resultado: { total: 1 } });
    expect(porDni && "resultado" in porDni && porDni.resultado.oferentes[0].dni).toBe("30000003");

    const porCorreo = await buscarOferentesAccion(null, formulario({ q: "oferente2@ejemplo.test" }));
    expect(porCorreo && "resultado" in porCorreo && porCorreo.resultado.oferentes.map((o) => o.email)).toEqual([
      "oferente2@ejemplo.test",
    ]);
  });

  it("sin texto o con «Ver a todas» vuelve al listado completo", async () => {
    expect(await buscarOferentesAccion(null, formulario({ q: "   " }))).toBeNull();
    expect(await buscarOferentesAccion(null, formulario({ q: "30000003", accion: "todas" }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Alta de una obra con su foto principal
// ---------------------------------------------------------------------------

describe("alta de una obra con foto", () => {
  beforeAll(async () => {
    prueba.db = await baseDePrueba();
  });

  const conFoto = (campos: Record<string, string | undefined>) => {
    const datos = formulario(campos);
    datos.set("foto", new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" }));
    return datos;
  };
  const campos = (numero: number) => ({ numero: String(numero), artista_id: ARTISTA(1), titulo: `Prueba ${numero}` });
  const idDeObra = async (numero: number) =>
    (await directo<{ id: string }>("select id from public.obras where numero = $1", [numero]))[0]?.id;
  const fotosDe = (id: string) =>
    directo<{ ruta: string; texto_alternativo: string }>("select ruta, texto_alternativo from public.obra_fotos where obra_id = $1", [id]);

  it("crea la obra y guarda la foto como portada", async () => {
    vi.mocked(guardarFoto).mockResolvedValueOnce({ ruta: "obra-41/prueba.jpg", ancho: 800, alto: 1200 });
    const datos = conFoto({ ...campos(41), texto_alternativo: "Cabeza pintada de rojo con objetos encima" });
    await expect(crearObraAccion({}, datos)).rejects.toThrow(/redirect: \/admin\/obras\/[0-9a-f-]+\?creada=1$/);
    const id = await idDeObra(41);
    expect(await fotosDe(id)).toEqual([
      { ruta: "obra-41/prueba.jpg", texto_alternativo: "Cabeza pintada de rojo con objetos encima" },
    ]);
  });

  it("con foto pide el texto alternativo y no crea nada", async () => {
    const r = await crearObraAccion({}, conFoto({ ...campos(42), texto_alternativo: "" }));
    expect(r.errores?.texto_alternativo).toBeDefined();
    expect(await idDeObra(42)).toBeUndefined();
  });

  it("si la foto falla, la obra queda creada y la página lo avisa", async () => {
    vi.mocked(guardarFoto).mockRejectedValueOnce(new Error("No se pudo subir: prueba"));
    const datos = conFoto({ ...campos(43), texto_alternativo: "Cabeza escultórica de prueba" });
    await expect(crearObraAccion({}, datos)).rejects.toThrow(/\?creada=1&foto=error$/);
    const id = await idDeObra(43);
    expect(id).toBeDefined();
    expect(await fotosDe(id)).toEqual([]);
  });

  it("sin foto, se crea como antes", async () => {
    await expect(crearObraAccion({}, formulario(campos(44)))).rejects.toThrow(/\?creada=1$/);
    expect(await idDeObra(44)).toBeDefined();
  });
});
