// Funciones puras para mostrar el registro de auditoría: traducciones, filtros y resumen de
// cambios. No consultan la base (se pueden probar sin Next).
import type { EntradaAuditoria, FilaJson, FiltrosAuditoria, Referencias } from "@/lib/datos/admin/auditoria";
import { numeroConPuntos, pesos, tituloObra, ZONA } from "@/lib/formato";

// ---------------------------------------------------------------------------
// Traducciones
// ---------------------------------------------------------------------------

export const ACCIONES: Record<string, string> = {
  insert: "Alta",
  update: "Cambio",
  delete: "Baja",
  anular: "Anulación de oferta",
  exportar_listado: "Exportación del listado",
  dni_duplicado: "Intento con un DNI ya registrado",
};

export const TABLAS: Record<string, string> = {
  obras: "Obra",
  artistas: "Artista",
  obra_fotos: "Foto",
  configuracion: "Configuración",
  paginas: "Texto",
  oferentes: "Oferente",
  ofertas: "Oferta",
  admins: "Equipo",
};

/** Traducción de un valor; los que no están en el mapa se muestran tal cual (sin heredar de Object). */
function traducir(mapa: Record<string, string>, valor: string) {
  return Object.hasOwn(mapa, valor) ? mapa[valor] : valor;
}

export function nombreAccion(accion: string) {
  return traducir(ACCIONES, accion);
}

export function nombreTabla(tabla: string | null) {
  if (!tabla) return "—";
  return traducir(TABLAS, tabla);
}

/**
 * Opciones de un filtro: primero las conocidas (en orden), después las que aparezcan en el
 * registro o en el filtro aplicado, sin repetir.
 */
export function opciones(conocidas: Record<string, string>, otras: string[]) {
  const extra = [...new Set(otras)].filter((v) => v && !Object.hasOwn(conocidas, v)).sort();
  return [...Object.keys(conocidas), ...extra].map((valor) => ({ valor, texto: traducir(conocidas, valor) }));
}

// ---------------------------------------------------------------------------
// Filtros (searchParams)
// ---------------------------------------------------------------------------

export type ValoresFiltro = { tabla: string; accion: string; desde: string; hasta: string };

export type LecturaFiltros = {
  filtros: FiltrosAuditoria;
  /** Valores aplicados (válidos), para los campos y los enlaces de página. */
  valores: ValoresFiltro;
  errores: { desde?: string; hasta?: string };
  activos: boolean;
};

type Busqueda = Record<string, string | string[] | undefined>;

const DIA_MS = 24 * 60 * 60 * 1000;

/** 00:00 del día AAAA-MM-DD en hora de Tucumán (UTC-3 fijo), o null si la fecha no es válida. */
export function inicioDelDia(dia: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const control = new Date(Date.UTC(a, mes - 1, d));
  if (control.getUTCFullYear() !== a || control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== d) return null;
  const fecha = new Date(`${dia}T00:00:00-03:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function leerFiltros(busqueda: Busqueda): LecturaFiltros {
  const uno = (clave: string) => {
    const v = busqueda[clave];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
  };
  const errores: LecturaFiltros["errores"] = {};

  const tabla = uno("tabla");
  const accion = uno("accion");
  const tablaOk = tabla && tabla.length <= 64 ? tabla : "";
  const accionOk = accion && accion.length <= 100 ? accion : "";

  let desdeTexto = uno("desde");
  let hastaTexto = uno("hasta");
  let desde: Date | null = null;
  let hastaInicio: Date | null = null;
  if (desdeTexto) {
    desde = inicioDelDia(desdeTexto);
    if (!desde) {
      errores.desde = "La fecha no es válida. Elegila de nuevo en el calendario.";
      desdeTexto = "";
    }
  }
  if (hastaTexto) {
    hastaInicio = inicioDelDia(hastaTexto);
    if (!hastaInicio) {
      errores.hasta = "La fecha no es válida. Elegila de nuevo en el calendario.";
      hastaTexto = "";
    }
  }
  if (desde && hastaInicio && hastaInicio < desde) {
    errores.hasta = "La fecha «Hasta» tiene que ser igual o posterior a «Desde». No se aplicó.";
    hastaInicio = null;
    hastaTexto = "";
  }

  const numero = Number.parseInt(uno("pagina"), 10);
  const pagina = Number.isFinite(numero) && numero >= 1 ? Math.min(numero, 1_000_000) : 1;

  const valores: ValoresFiltro = { tabla: tablaOk, accion: accionOk, desde: desdeTexto, hasta: hastaTexto };
  return {
    filtros: {
      pagina,
      tabla: tablaOk || null,
      accion: accionOk || null,
      desde,
      // Fin del día "hasta": comienzo del día siguiente (exclusivo).
      hasta: hastaInicio ? new Date(hastaInicio.getTime() + DIA_MS) : null,
    },
    valores,
    errores,
    activos: Boolean(tablaOk || accionOk || desdeTexto || hastaTexto),
  };
}

/** Enlace a una página del registro conservando los filtros aplicados. */
export function hrefPagina(valores: ValoresFiltro, pagina: number) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) if (valor) params.set(clave, valor);
  if (pagina > 1) params.set("pagina", String(pagina));
  const texto = params.toString();
  return texto ? `/admin/auditoria?${texto}` : "/admin/auditoria";
}

// ---------------------------------------------------------------------------
// Quién y qué registro
// ---------------------------------------------------------------------------

const clave = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : "");

/**
 * Textos editables (public.paginas.slug), con pantalla en /admin/textos/[slug]. Mismos nombres
 * que en el panel de textos. Los cambios guardan solo las columnas que cambiaron, así que el
 * título de la página no siempre está en el registro.
 */
const NOMBRES_TEXTOS: Record<string, string> = {
  portada: "Portada",
  "como-participar": "Cómo participar",
  "bases-y-condiciones": "Bases y condiciones",
  destino: "Destino de lo recaudado",
  privacidad: "Política de privacidad",
};

export function quien(e: EntradaAuditoria, refs: Referencias): { nombre: string; rol: string | null } {
  if (!e.actorId || e.actorTipo === "sistema") return { nombre: "Sistema", rol: null };
  if (e.actorTipo === "admin") return { nombre: refs.admins[clave(e.actorId)] || "Integrante del equipo", rol: "Equipo" };
  const alias = refs.oferentes[clave(e.actorId)];
  return { nombre: alias != null ? `Oferente ${alias}` : "Oferente sin registro", rol: null };
}

/** Texto del registro afectado y, si corresponde, enlace a su pantalla en el panel. */
export function registro(e: EntradaAuditoria, refs: Referencias): { texto: string; href?: string } {
  const fila: FilaJson = e.despues ?? e.antes ?? {};
  const id = clave(e.registroId);
  const obraDeFila = refs.obras[clave(fila.obra_id)];
  switch (e.tabla) {
    case null:
      return { texto: "—" };
    case "obras": {
      const obra = refs.obras[id];
      const numero = obra?.numero ?? fila.numero;
      const titulo = obra ? obra.titulo : ((fila.titulo as string | null) ?? null);
      return {
        texto: `Obra N° ${numero ?? "?"} · ${tituloObra(titulo)}`,
        href: obra ? `/admin/obras/${id}` : undefined,
      };
    }
    case "artistas":
      return {
        texto: String(fila.nombre ?? refs.artistas[id] ?? e.registroId ?? "Artista"),
        href: refs.artistas[id] !== undefined ? `/admin/artistas/${id}` : undefined,
      };
    case "obra_fotos":
      return obraDeFila
        ? { texto: `Foto de la obra N° ${obraDeFila.numero}`, href: `/admin/obras/${clave(fila.obra_id)}` }
        : { texto: "Foto" };
    case "configuracion":
      return { texto: "Configuración general" };
    case "paginas": {
      const conocido = e.registroId != null && Object.hasOwn(NOMBRES_TEXTOS, e.registroId);
      return {
        texto: conocido ? NOMBRES_TEXTOS[e.registroId!] : String(fila.titulo ?? e.registroId ?? "Texto"),
        href: conocido ? `/admin/textos/${e.registroId}` : undefined,
      };
    }
    case "oferentes": {
      const alias = fila.alias_numero ?? refs.oferentes[id];
      return {
        texto: alias != null ? `Oferente ${alias}` : "Oferente",
        href: refs.oferentes[id] !== undefined ? `/admin/oferentes/${id}` : undefined,
      };
    }
    case "ofertas":
      return obraDeFila
        ? {
            texto: `Oferta N° ${e.registroId} · obra N° ${obraDeFila.numero}`,
            href: `/admin/obras/${clave(fila.obra_id)}/ofertas`,
          }
        : { texto: `Oferta N° ${e.registroId}` };
    case "admins":
      return { texto: String(fila.nombre ?? refs.admins[id] ?? "Integrante del equipo") };
    default:
      return { texto: e.registroId ?? "—" };
  }
}

// ---------------------------------------------------------------------------
// Resumen de cambios
// ---------------------------------------------------------------------------

/** Nombre legible de cada columna, en el orden en que conviene mostrarlas. */
const CAMPOS: [string, string][] = [
  ["numero", "Número"],
  ["titulo", "Título"],
  ["nombre", "Nombre"],
  ["apellido", "Apellido"],
  ["alias_numero", "Alias"],
  ["dni", "DNI"],
  ["telefono", "Teléfono"],
  ["email", "Correo"],
  ["artista_id", "Artista"],
  ["obra_id", "Obra"],
  ["oferente_id", "Oferente"],
  ["monto", "Monto"],
  ["estado", "Estado"],
  ["motivo_anulacion", "Motivo de la anulación"],
  ["anulada_at", "Anulada el"],
  ["anulada_por", "Anulada por"],
  ["publicada", "Publicada"],
  ["precio_salida", "Precio de salida"],
  ["tecnica", "Técnica"],
  ["resena", "Reseña"],
  ["enlace", "Enlace"],
  ["foto_ruta", "Foto"],
  ["ruta", "Archivo"],
  ["texto_alternativo", "Texto alternativo"],
  ["orden", "Orden"],
  ["ancho", "Ancho (px)"],
  ["alto", "Alto (px)"],
  ["inicio_virtual", "Inicio de la etapa virtual"],
  ["cierre_virtual", "Cierre de la etapa virtual"],
  ["fechas_confirmadas", "Fechas confirmadas"],
  ["fecha_presencial", "Fecha de la subasta presencial"],
  ["detalle_presencial", "Detalle de la subasta presencial"],
  ["incremento_minimo", "Incremento mínimo"],
  ["modo_ejemplo", "Modo ejemplo"],
  ["extension_activa", "Extensión del cierre"],
  ["extension_minutos", "Minutos de extensión"],
  ["slug", "Página"],
  ["contenido", "Contenido"],
  ["provisorio", "Provisorio"],
  ["version", "Versión"],
  ["actualizada_por", "Editado por"],
  ["bases_version", "Versión de las bases aceptada"],
  ["bases_aceptadas_at", "Bases aceptadas el"],
  ["privacidad_aceptada_at", "Privacidad aceptada el"],
  ["avisos_por_correo", "Avisos por correo"],
  ["bloqueado", "Bloqueado"],
  ["bloqueo_motivo", "Motivo del bloqueo"],
  ["user_id", "Usuario"],
  ["activo", "Activo"],
  ["es_ejemplo", "De ejemplo"],
  ["creada_at", "Creada el"],
  ["creado_at", "Creado el"],
  ["id", "Id"],
];
const ETIQUETAS = new Map(CAMPOS);
const ORDEN = new Map(CAMPOS.map(([c], i) => [c, i]));

/** Campos que cambian solos en cada edición: no aportan al resumen. */
const IGNORADOS = new Set(["actualizado_at", "actualizada_at"]);
/** En altas y bajas, además, se omiten el id y la fecha de creación (ya están en la fila). */
const IGNORADOS_ALTA_BAJA = new Set(["id", "creado_at", "creada_at"]);

const CAMPOS_PESOS = new Set(["monto", "precio_salida", "incremento_minimo"]);
const CAMPOS_FECHA_HORA = new Set(["inicio_virtual", "cierre_virtual"]);
const ESTADOS: Record<string, string> = { valida: "Válida", anulada: "Anulada" };

export const MAX_TEXTO = 80;

const limpiar = (texto: string) => texto.replace(/\s+/g, " ").trim();

export function recortar(texto: string, max = MAX_TEXTO) {
  const limpio = limpiar(texto);
  return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
}

/** Caracteres que se muestran antes del primer cambio cuando hay que saltear el comienzo. */
const CONTEXTO = 24;

/**
 * Recorta dos versiones de un texto largo alrededor del primer punto en que difieren.
 * Así, si el cambio está después de los primeros 80 caracteres (por ejemplo, un párrafo
 * agregado al final de un texto), "antes" y "después" no se ven iguales.
 */
export function recortarCambio(antes: string, despues: string, max = MAX_TEXTO): [string, string] {
  const a = limpiar(antes);
  const d = limpiar(despues);
  if (a === d) return [recortar(a, max), "Mismo texto, con otros espacios o saltos de línea"];
  let i = 0;
  while (i < a.length && i < d.length && a[i] === d[i]) i++;
  if (i < max - CONTEXTO) return [recortar(a, max), recortar(d, max)];
  // Arranca un poco antes de la diferencia, en el comienzo de una palabra si está cerca.
  let desde = i - CONTEXTO;
  const espacio = a.lastIndexOf(" ", desde);
  if (espacio >= 0 && desde - espacio <= 15) desde = espacio + 1;
  const tramo = (t: string) => {
    const resto = t.slice(desde);
    return resto ? `…${recortar(resto, max - 1)}` : "(vacío)";
  };
  return [tramo(a), tramo(d)];
}

const formatoFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function nombreCampo(campo: string) {
  return ETIQUETAS.get(campo) ?? campo;
}

/** Valor de una columna listo para leer: pesos, fechas en hora de Tucumán, Sí/No, nombres. */
export function formatearValor(campo: string, valor: unknown, refs: Referencias): string {
  if (valor === null || valor === undefined || valor === "") return "(vacío)";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";

  if (typeof valor === "string") {
    const id = valor.toLowerCase();
    switch (campo) {
      case "artista_id":
        if (refs.artistas[id]) return recortar(refs.artistas[id]);
        break;
      case "obra_id":
        if (refs.obras[id]) return `Obra N° ${refs.obras[id].numero}`;
        break;
      case "oferente_id":
        if (refs.oferentes[id] != null) return `Oferente ${refs.oferentes[id]}`;
        break;
      case "anulada_por":
      case "actualizada_por":
      case "user_id":
        if (refs.admins[id]) return recortar(refs.admins[id]);
        break;
      case "estado":
        if (Object.hasOwn(ESTADOS, valor)) return ESTADOS[valor];
        break;
      case "fecha_presencial": {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        break;
      }
    }
    if (campo.endsWith("_at") || CAMPOS_FECHA_HORA.has(campo)) {
      const fecha = new Date(valor);
      if (!Number.isNaN(fecha.getTime())) return formatoFechaHora.format(fecha);
    }
    return recortar(valor);
  }

  if (typeof valor === "number") {
    return CAMPOS_PESOS.has(campo) ? pesos(valor) : String(valor);
  }
  return recortar(JSON.stringify(valor));
}

export type Cambio = { campo: string; antes?: string; despues?: string };

const iguales = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const vacio = (v: unknown) => v === null || v === undefined || v === "";

function ordenar(campos: Iterable<string>) {
  return [...new Set(campos)].sort((a, b) => {
    const ia = ORDEN.get(a) ?? Number.MAX_SAFE_INTEGER;
    const ib = ORDEN.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ia - ib || a.localeCompare(b);
  });
}

/**
 * Lista de columnas que cambiaron, cuando el registro la trae en el detalle. Así se registran
 * los cambios de oferentes: los datos personales no se guardan en la auditoría, solo el nombre
 * de la columna (ver supabase/migrations/20261019140500_auditoria.sql).
 */
function camposCambiados(detalle: unknown): string[] | null {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) return null;
  const campos = (detalle as Record<string, unknown>).campos;
  return Array.isArray(campos) ? campos.filter((c): c is string => typeof c === "string") : null;
}

/** Texto de un campo que cambió y cuyo valor no se guarda (dato personal). */
export const SIN_VALOR = "cambió (por ser un dato personal, la auditoría no guarda el valor)";

/**
 * Campos que cambiaron entre "antes" y "después".
 *  - Cambio: "campo: antes → después" solo de los que cambiaron. Los que figuran en la lista
 *    del detalle sin valor guardado se muestran como "cambió".
 *  - Alta: los valores cargados (sin los vacíos). Baja: los valores que tenía.
 */
export function resumirCambios(e: EntradaAuditoria, refs: Referencias): Cambio[] {
  const { antes, despues } = e;
  if (antes && despues) {
    const sinValor = new Set(
      (camposCambiados(e.detalle) ?? []).filter((c) => !Object.hasOwn(antes, c) && !Object.hasOwn(despues, c)),
    );
    return ordenar([...Object.keys(antes), ...Object.keys(despues), ...sinValor])
      .filter((c) => !IGNORADOS.has(c) && (sinValor.has(c) || !iguales(antes[c], despues[c])))
      .map((c) => {
        if (sinValor.has(c)) return { campo: nombreCampo(c), despues: SIN_VALOR };
        const a = antes[c];
        const d = despues[c];
        let textoAntes = formatearValor(c, a, refs);
        let textoDespues = formatearValor(c, d, refs);
        // Textos largos que difieren después del recorte: se muestra el tramo que cambió.
        if (textoAntes === textoDespues && typeof a === "string" && typeof d === "string") {
          [textoAntes, textoDespues] = recortarCambio(a, d);
        }
        return { campo: nombreCampo(c), antes: textoAntes, despues: textoDespues };
      });
  }
  const fila = despues ?? antes;
  if (!fila) return [];
  return ordenar(Object.keys(fila))
    .filter((c) => !IGNORADOS.has(c) && !IGNORADOS_ALTA_BAJA.has(c) && !vacio(fila[c]))
    .map((c) =>
      despues
        ? { campo: nombreCampo(c), despues: formatearValor(c, fila[c], refs) }
        : { campo: nombreCampo(c), antes: formatearValor(c, fila[c], refs) },
    );
}

const FORMATOS: Record<string, string> = { xlsx: "Excel", pdf: "PDF" };

/** Descarga del listado final: { formato, preliminar, filas } (una fila por obra). */
function descripcionExportacion(d: Record<string, unknown>) {
  const formato = typeof d.formato === "string" && Object.hasOwn(FORMATOS, d.formato) ? FORMATOS[d.formato] : null;
  let texto = formato ? `Descarga del listado final (${formato})` : "Descarga del listado final";
  if (d.preliminar === true) texto += " con la marca PRELIMINAR";
  if (typeof d.filas === "number") texto += `: ${numeroConPuntos(d.filas)} ${d.filas === 1 ? "obra" : "obras"}`;
  return `${texto}.`;
}

/**
 * Detalle de un evento listo para leer, en renglones (por ejemplo, una exportación), o null si
 * no agrega nada a lo que ya muestra el resumen de cambios.
 */
export function detalleLegible(e: Pick<EntradaAuditoria, "accion" | "detalle">, refs: Referencias): string[] | null {
  const { accion, detalle } = e;
  if (vacio(detalle)) return null;
  if (typeof detalle !== "object") return [recortar(String(detalle), 300)];
  if (Array.isArray(detalle)) return [recortar(JSON.stringify(detalle), 300)];

  const d = detalle as Record<string, unknown>;
  if (accion === "exportar_listado") return [descripcionExportacion(d)];
  // La lista de campos de un cambio ya aparece en el resumen.
  const claves = Object.keys(d).filter((k) => !(k === "campos" && camposCambiados(d)));
  if (claves.length === 0) return null;
  return ordenar(claves).map((k) => `${nombreCampo(k)}: ${formatearValor(k, d[k], refs)}`);
}
