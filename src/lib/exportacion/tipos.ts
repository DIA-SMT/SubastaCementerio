// Datos que reciben los generadores de la planilla y los PDF. Son funciones puras:
// no leen la base ni la sesión, así se pueden probar con datos falsos.

export type OferenteListado = {
  alias: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  /** Bloqueado desde el panel: no puede ofertar, pero sus ofertas válidas siguen contando. */
  bloqueado: boolean;
};

/** Una obra publicada del listado final para el martillero. */
export type FilaListado = {
  /** Identificador de la obra (para enlazar a sus ofertas en el panel). */
  obraId: string;
  numero: number;
  titulo: string | null;
  artista: string;
  /** Precio de salida de la obra (referencia cuando no hay ofertas). */
  precioSalida: number;
  /** Mayor oferta válida (= precio base de la subasta presencial), o null si no hubo ofertas. */
  precioBase: number | null;
  /** Hora de la mayor oferta válida. */
  ofertaAt: Date | null;
  /** Quien hizo la mayor oferta válida. */
  oferente: OferenteListado | null;
  cantidadOfertas: number;
};

export type MetaListado = {
  /** Fecha y hora de generación (hora del servidor de base de datos). */
  generado: Date;
  /** true mientras la etapa virtual no cerró: los precios base pueden cambiar. */
  preliminar: boolean;
  /** Cierre de la etapa virtual: el de la última obra en cerrar (con la extensión, puede ser posterior al general). */
  cierre: Date;
  modoEjemplo: boolean;
  /** Obras cargadas pero no publicadas, que quedan afuera del listado aunque tengan ofertas. */
  noPublicadas: ObraNoPublicada[];
};

/** Obra cargada pero no publicada: no figura en el listado final. */
export type ObraNoPublicada = {
  obraId: string;
  numero: number;
  titulo: string | null;
  artista: string;
  /** Ofertas válidas que tiene y que quedan afuera del listado. */
  cantidadOfertas: number;
  /** Mayor oferta válida, o null si no tiene ofertas. */
  mayorOferta: number | null;
};

export type TotalesListado = {
  obras: number;
  obrasConOfertas: number;
  /** Suma de los precios base (mayor oferta válida de cada obra). */
  montoAcumulado: number;
};

export type ObraCartel = {
  numero: number;
  titulo: string | null;
  artista: string;
  /** Dirección completa de la ficha de la obra (lo que codifica el QR). */
  url: string;
};

export type MetaCarteles = {
  generado: Date;
};

/** Logos institucionales en PNG (null si falta el archivo en public/marca). */
export type Logos = {
  smtBlanco: Buffer | null;
  muniIso: Buffer | null;
};
