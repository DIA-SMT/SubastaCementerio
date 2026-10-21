export type Fase = "por_confirmar" | "antes" | "abierta" | "cerrada";

export type EstadoSubasta = {
  inicio: Date;
  /** Cierre general de la etapa virtual. */
  cierre: Date;
  /** Hora en que cierra la última obra: igual a `cierre`, salvo que una oferta la haya extendido. */
  cierreFinal: Date;
  /** Pasó el cierre general, pero alguna obra sigue abierta por una oferta de último momento. */
  enExtension: boolean;
  /** Extensión del cierre por obra, si está habilitada. */
  extension: { minutos: number } | null;
  fechasConfirmadas: boolean;
  /** AAAA-MM-DD */
  fechaPresencial: string | null;
  detallePresencial: string | null;
  incrementoMinimo: number;
  precioSalida: number;
  modoEjemplo: boolean;
  fase: Fase;
  /** Hora del servidor de base de datos al momento de la consulta. */
  ahora: Date;
};

export type Foto = { ruta: string; alt: string; ancho: number | null; alto: number | null };

export type ObraResumen = {
  id: string;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  precioSalida: number;
  ofertaActual: number | null;
  ofertaActualAt: Date | null;
  ofertaActualAlias: number | null;
  ofertaActualEsMia: boolean;
  cantidadOfertas: number;
  minimoSiguiente: number;
  portada: Foto | null;
  esEjemplo: boolean;
  /** Cierre de esta obra: el general, o más tarde si una oferta de último momento lo extendió. */
  cierre: Date;
  /** Fase de esta obra (puede seguir abierta pasado el cierre general). */
  fase: Fase;
};

export type ObraDetalle = ObraResumen & {
  resena: string;
  tecnica: string | null;
  artistaResena: string;
  artistaEnlace: string | null;
  /** Ruta de la foto del artista (bucket "obras"), si se cargó. */
  artistaFotoRuta: string | null;
  fotos: Foto[];
};

export type OfertaPublica = {
  id: number;
  alias: number;
  monto: number;
  creadaAt: Date;
  esPropia: boolean;
};

export type SlugPagina = "portada" | "como-participar" | "bases-y-condiciones" | "destino" | "privacidad";

export type Pagina = {
  slug: SlugPagina;
  titulo: string;
  contenido: string;
  provisorio: boolean;
  version: number;
};

export type Perfil = {
  aliasNumero: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  avisosPorCorreo: boolean;
  bloqueado: boolean;
};

export type MiOferta = {
  id: number;
  numero: number;
  titulo: string | null;
  artistaNombre: string;
  monto: number;
  creadaAt: Date;
  estado: "valida" | "anulada";
  esLaMasAlta: boolean;
  ofertaActual: number | null;
  /** false si el equipo despublicó la obra: ya no está en la subasta. */
  publicada: boolean;
  /** Fase de la obra (puede seguir abierta pasado el cierre general). */
  fase: Fase;
};
