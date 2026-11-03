/**
 * Nombre y apellido como los escribiría una persona. Tomado de El Sanmiguelino (repo
 * DiarioDigital, src/lib/auth/cidituc/nombre.ts).
 *
 * Cidituc devuelve los nombres en MAYÚSCULAS ("ALFREDO AGUSTIN BRITO"). Se normalizan al
 * ingresar, así llegan bien al registro de oferente, al panel y al listado del martillero.
 * Lo que no puede hacer: devolver las tildes. Si Cidituc manda "AGUSTIN", de ahí no sale
 * "Agustín" sin inventar.
 */

/**
 * Las partículas que van en minúscula, y por qué son tan pocas.
 *
 * La primera versión de este archivo listaba veinte —"di", "da", "el", "van",
 * "bin"— y **arruinaba apellidos reales de esta ciudad**. El problema es que el
 * nombre llega como "NOMBRE APELLIDO", así que una partícula del apellido nunca
 * es la primera palabra y siempre caía en la rama de minúscula:
 *
 *   "JORGE DI STEFANO"  →  "Jorge di Stefano"   (va "Di Stefano")
 *   "ANTONIO DA SILVA"  →  "Antonio da Silva"   (va "Da Silva")
 *   "JOSE EL HALABI"    →  "Jose el Halabi"     (va "El Halabi")
 *
 * El último importa especialmente: en San Miguel de Tucumán los apellidos de
 * origen sirio-libanés no son un caso de borde. Un apellido mal escrito es peor
 * que un apellido gritado.
 *
 * No se puede distinguir por posición a qué convención pertenece cada
 * partícula, así que la lista se recorta a lo que en un padrón local es seguro.
 *
 * "San" nunca estuvo, y no es un olvido: en "San Martín" no es partícula, es
 * parte del apellido. Lo mismo "Santa" y "Santo".
 */
const PARTICULAS_SIEMPRE = new Set(["de", "del", "y"]);

/**
 * Éstas van en minúscula **sólo detrás de "de"**.
 *
 * Con eso "María de los Ángeles" y "Juan de la Vega" quedan bien, y "Ana La
 * Rosa" —donde "La" es el apellido— también.
 */
const PARTICULAS_TRAS_DE = new Set(["la", "las", "los"]);

/**
 * Límite conocido y aceptado: "de" y "del" sueltos siguen bajando siempre, así
 * que "DE LUCA" sale "de Luca" y "DEL PIERO" sale "del Piero". Se elige el error
 * menos frecuente: "Juan de Dios", "María del Valle" y "María del Carmen" son
 * mucho más comunes acá que el apellido italiano con partícula suelta.
 */

/** Los separadores que hay adentro de un nombre y que no son un espacio. */
const SEPARADORES = /([\s,'’-]+)/u;

function capitalizar(palabra: string): string {
  if (!palabra) return palabra;
  // `toLocaleUpperCase` y no `toUpperCase`: con nombres acentuados y con ñ el
  // resultado es el mismo, pero la intención queda escrita.
  return palabra[0].toLocaleUpperCase("es") + palabra.slice(1).toLocaleLowerCase("es");
}

/**
 * ¿Viene todo en un solo caso?
 *
 * Si el nombre trae mayúsculas Y minúsculas, alguien —o algún sistema— ya decidió
 * cómo se escribe, y no lo tocamos: es lo que evita que un "de la Vega" bien
 * escrito termine como "De La Vega", y que un "DiCaprio" o un "McDonald" queden
 * arruinados. Sólo se normaliza lo que claramente no fue escrito, sino volcado.
 */
function unSoloCaso(valor: string): boolean {
  const tieneMinuscula = /\p{Ll}/u.test(valor);
  const tieneMayuscula = /\p{Lu}/u.test(valor);
  return !(tieneMinuscula && tieneMayuscula);
}

export function nombreDePersona(bruto: string): string {
  // Espacios de más, incluidos los del medio: Cidituc los manda tal cual salen
  // de dos columnas concatenadas.
  const limpio = bruto.trim().replace(/\s+/gu, " ");
  if (!limpio) return limpio;
  if (!unSoloCaso(limpio)) return limpio;

  const partes = limpio.split(SEPARADORES);
  let anterior: string | null = null;

  return partes
    .map((parte) => {
      // Los separadores vuelven tal cual: el split con grupo los conserva.
      if (!parte || SEPARADORES.test(parte)) return parte;

      const minuscula = parte.toLocaleLowerCase("es");
      // La primera palabra se capitaliza siempre, aunque sea una partícula: un
      // nombre que arranca con "de" arranca con "De".
      const baja =
        anterior !== null &&
        (PARTICULAS_SIEMPRE.has(minuscula) ||
          (PARTICULAS_TRAS_DE.has(minuscula) && anterior === "de"));

      anterior = minuscula;
      return baja ? minuscula : capitalizar(parte);
    })
    .join("");
}
