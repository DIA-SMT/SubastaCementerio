import "server-only";
import { comoAdmin, type Admin } from "@/lib/admin/sesion";
import { conBase, type Consulta } from "@/lib/db";
import type { EstadoSubasta, Fase } from "@/lib/datos/tipos";

// Configuración general de la subasta (fila única id = 1). Todo corre como el integrante
// del equipo: la política configuracion_admin_edicion exige public.es_admin().
// Cada cambio queda en la auditoría por el disparador "auditar".

export type ConfiguracionAdmin = EstadoSubasta & {
  actualizadaAt: Date;
  /** Último cambio registrado en la auditoría (null si nunca se cambió desde el panel). */
  ultimoCambio: { at: Date; nombre: string | null; porSistema: boolean } | null;
  /** Obras con precio de salida propio: no usan el precio general. */
  obrasConPrecioPropio: number;
};

export type DatosConfiguracion = {
  inicio: Date;
  cierre: Date;
  fechasConfirmadas: boolean;
  /** AAAA-MM-DD */
  fechaPresencial: string | null;
  detallePresencial: string | null;
  incrementoMinimo: number;
  precioSalida: number;
  modoEjemplo: boolean;
};

/**
 * Ofertas válidas (de obras publicadas) registradas desde una hora. Se aceptaron antes de
 * guardar el cambio, así que siguen contando para el precio base del listado final.
 */
export type OfertasPosteriores = { cantidad: number; obras: number; ultima: Date | null };

/**
 * Cambios que afectan una subasta en curso o ya cerrada y necesitan una confirmación explícita.
 * Con la etapa abierta: adelanta_cierre, desconfirma, posterga_inicio. Con la etapa cerrada
 * (puede haber un listado FINAL ya descargado): reabre, cambia_cierre, desconfirma_cerrada.
 */
export type MotivoConfirmacion =
  | { tipo: "adelanta_cierre"; cierreActual: Date; nuevoCierre: Date; yaPaso: boolean; posteriores: OfertasPosteriores }
  | { tipo: "desconfirma" }
  | { tipo: "posterga_inicio"; nuevoInicio: Date }
  /** nuevoInicio solo cuando la etapa vuelve a abrir más adelante y no al guardar. */
  | { tipo: "reabre"; nuevoInicio: Date | null; nuevoCierre: Date }
  | { tipo: "cambia_cierre"; cierreActual: Date; nuevoCierre: Date; posteriores: OfertasPosteriores }
  | { tipo: "desconfirma_cerrada" };

export type ResultadoConfiguracion =
  | { ok: true; sinCambios: boolean; fase: Fase }
  | { ok: false; codigo: "requiere_confirmacion"; motivos: MotivoConfirmacion[] }
  | { ok: false; codigo: "sin_permiso" };

const aFecha = (v: unknown) => new Date(v as string);

/** Misma regla que la vista v_estado_subasta. */
function faseDe(inicio: Date, cierre: Date, confirmadas: boolean, ahora: Date): Fase {
  if (!confirmadas) return "por_confirmar";
  if (ahora < inicio) return "antes";
  if (ahora < cierre) return "abierta";
  return "cerrada";
}

/** Los formularios trabajan con minutos: se ignoran los segundos al comparar. */
const minuto = (fecha: Date) => Math.floor(fecha.getTime() / 60000);

const SIN_POSTERIORES: OfertasPosteriores = { cantidad: 0, obras: 0, ultima: null };

/** Ofertas válidas de obras publicadas registradas desde `desde` (inclusive). */
async function ofertasDesde(q: Consulta, desde: Date): Promise<OfertasPosteriores> {
  const [f] = await q(
    `select count(*)::int as cantidad, count(distinct o.obra_id)::int as obras, max(o.creada_at) as ultima
     from public.ofertas o
     join public.obras ob on ob.id = o.obra_id and ob.publicada
     where o.estado = 'valida' and o.creada_at >= $1::timestamptz`,
    [desde.toISOString()],
  );
  return {
    cantidad: Number(f?.cantidad ?? 0),
    obras: Number(f?.obras ?? 0),
    ultima: f?.ultima == null ? null : aFecha(f.ultima),
  };
}

export async function obtenerConfiguracion(admin: Admin): Promise<ConfiguracionAdmin> {
  return conBase(comoAdmin(admin), async (q) => {
    const [f] = await q(
      `select c.inicio_virtual, c.cierre_virtual, c.fechas_confirmadas,
              to_char(c.fecha_presencial, 'YYYY-MM-DD') as fecha_presencial, c.detalle_presencial,
              c.incremento_minimo, c.precio_salida, c.modo_ejemplo, c.actualizada_at,
              e.fase, e.ahora,
              (select count(*)::int from public.obras o where o.precio_salida is not null) as obras_con_precio_propio
       from public.configuracion c
       cross join public.v_estado_subasta e
       where c.id = 1`,
    );
    if (!f) throw new Error("No se pudo leer la configuración de la subasta.");
    const [u] = await q(
      `select a.ocurrido_at, a.actor_tipo, ad.nombre
       from public.auditoria a
       left join public.admins ad on ad.user_id = a.actor_id
       where a.tabla = 'configuracion' and a.accion = 'update'
       order by a.ocurrido_at desc, a.id desc
       limit 1`,
    );
    return {
      inicio: aFecha(f.inicio_virtual),
      cierre: aFecha(f.cierre_virtual),
      fechasConfirmadas: Boolean(f.fechas_confirmadas),
      fechaPresencial: (f.fecha_presencial as string | null) ?? null,
      detallePresencial: (f.detalle_presencial as string | null) ?? null,
      incrementoMinimo: Number(f.incremento_minimo),
      precioSalida: Number(f.precio_salida),
      modoEjemplo: Boolean(f.modo_ejemplo),
      fase: f.fase as Fase,
      ahora: aFecha(f.ahora),
      actualizadaAt: aFecha(f.actualizada_at),
      ultimoCambio: u
        ? { at: aFecha(u.ocurrido_at), nombre: (u.nombre as string | null) ?? null, porSistema: u.actor_tipo === "sistema" }
        : null,
      obrasConPrecioPropio: Number(f.obras_con_precio_propio ?? 0),
    };
  });
}

/**
 * Guarda la configuración. Si el cambio afecta una subasta en curso (adelanta el cierre o deja
 * de aceptar ofertas) o una etapa que ya cerró (la reabre, le cambia el cierre o desmarca las
 * fechas confirmadas) y alguno de esos motivos no está entre los `confirmados` (los que se le
 * mostraron a la persona), no guarda y devuelve los motivos.
 * La comparación se hace contra la fila bloqueada y con now() de la base.
 */
export async function actualizarConfiguracion(
  admin: Admin,
  datos: DatosConfiguracion,
  confirmados: readonly string[],
): Promise<ResultadoConfiguracion> {
  return conBase(comoAdmin(admin), async (q) => {
    const [a] = await q(
      `select inicio_virtual, cierre_virtual, fechas_confirmadas,
              to_char(fecha_presencial, 'YYYY-MM-DD') as fecha_presencial, detalle_presencial,
              incremento_minimo, precio_salida, modo_ejemplo, now() as ahora
       from public.configuracion
       where id = 1
       for update`,
    );
    if (!a) return { ok: false, codigo: "sin_permiso" };

    const ahora = aFecha(a.ahora);
    const inicioActual = aFecha(a.inicio_virtual);
    const cierreActual = aFecha(a.cierre_virtual);
    const faseActual = faseDe(inicioActual, cierreActual, Boolean(a.fechas_confirmadas), ahora);
    const faseNueva = faseDe(datos.inicio, datos.cierre, datos.fechasConfirmadas, ahora);

    const motivos: MotivoConfirmacion[] = [];
    if (faseActual === "abierta") {
      if (minuto(datos.cierre) < minuto(cierreActual)) {
        const yaPaso = datos.cierre <= ahora;
        // Si la nueva hora ya pasó, las ofertas entre esa hora y ahora se aceptaron y siguen contando.
        const posteriores = yaPaso ? await ofertasDesde(q, datos.cierre) : SIN_POSTERIORES;
        motivos.push({ tipo: "adelanta_cierre", cierreActual, nuevoCierre: datos.cierre, yaPaso, posteriores });
      }
      if (!datos.fechasConfirmadas) motivos.push({ tipo: "desconfirma" });
      if (datos.inicio > ahora) motivos.push({ tipo: "posterga_inicio", nuevoInicio: datos.inicio });
    } else if (faseActual === "cerrada") {
      // La etapa ya cerró: puede haber un listado FINAL descargado y las fichas dicen
      // «Pasa a subasta presencial con base de $ X».
      if (faseNueva === "abierta" || faseNueva === "antes") {
        motivos.push({ tipo: "reabre", nuevoInicio: faseNueva === "antes" ? datos.inicio : null, nuevoCierre: datos.cierre });
      } else {
        if (minuto(datos.cierre) !== minuto(cierreActual)) {
          const posteriores = await ofertasDesde(q, datos.cierre);
          motivos.push({ tipo: "cambia_cierre", cierreActual, nuevoCierre: datos.cierre, posteriores });
        }
        if (!datos.fechasConfirmadas) motivos.push({ tipo: "desconfirma_cerrada" });
      }
    }
    // Si entre el aviso y el nuevo envío cambió la situación (por ejemplo, la etapa cerró sola),
    // aparece un motivo que no se confirmó y se vuelve a pedir la confirmación.
    if (motivos.some((m) => !confirmados.includes(m.tipo))) {
      return { ok: false, codigo: "requiere_confirmacion", motivos };
    }

    const sinCambios =
      minuto(datos.inicio) === minuto(inicioActual) &&
      minuto(datos.cierre) === minuto(cierreActual) &&
      datos.fechasConfirmadas === Boolean(a.fechas_confirmadas) &&
      datos.fechaPresencial === ((a.fecha_presencial as string | null) ?? null) &&
      datos.detallePresencial === ((a.detalle_presencial as string | null) ?? null) &&
      datos.incrementoMinimo === Number(a.incremento_minimo) &&
      datos.precioSalida === Number(a.precio_salida) &&
      datos.modoEjemplo === Boolean(a.modo_ejemplo);
    if (sinCambios) return { ok: true, sinCambios: true, fase: faseActual };

    const filas = await q(
      `update public.configuracion
       set inicio_virtual = $1::timestamptz,
           cierre_virtual = $2::timestamptz,
           fechas_confirmadas = $3,
           fecha_presencial = $4::date,
           detalle_presencial = $5,
           incremento_minimo = $6,
           precio_salida = $7,
           modo_ejemplo = $8
       where id = 1
       returning id`,
      [
        datos.inicio.toISOString(),
        datos.cierre.toISOString(),
        datos.fechasConfirmadas,
        datos.fechaPresencial,
        datos.detallePresencial,
        datos.incrementoMinimo,
        datos.precioSalida,
        datos.modoEjemplo,
      ],
    );
    if (filas.length === 0) return { ok: false, codigo: "sin_permiso" };
    return { ok: true, sinCambios: false, fase: faseNueva };
  });
}
