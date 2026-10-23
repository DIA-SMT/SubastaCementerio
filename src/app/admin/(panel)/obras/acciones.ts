"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeDeErrorDb, type EstadoAccion } from "@/lib/admin/acciones";
import { requerirAdmin } from "@/lib/admin/sesion";
import { borrarFoto, guardarFoto } from "@/lib/almacenamiento";
import {
  actualizarObra,
  agregarFotoObra,
  borrarObra,
  cambiarTextoAlternativo,
  crearObra,
  esUuid,
  moverFotoObra,
  obtenerObraAdmin,
  quitarFotoObra,
  type DatosObra,
} from "@/lib/datos/admin/obras";
import { pesos } from "@/lib/formato";
import { medidaDesdeTexto, montoDesdeTexto } from "@/lib/validacion";

// Acciones del panel para obras y sus fotos. Cada una verifica la sesión del equipo.

const MAX_TITULO = 150;
const MAX_RESENA = 6000;
const MAX_TECNICA = 200;
const MAX_ALT = 250;
const PRECIO_MAXIMO = 1_000_000_000;

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();
const codigo = (error: unknown) => (error as { code?: string } | null)?.code;

/** Lee y valida el formulario de la obra. */
function leerObra(datos: FormData) {
  const valores = {
    numero: texto(datos, "numero"),
    titulo: texto(datos, "titulo"),
    artista_id: texto(datos, "artista_id"),
    resena: String(datos.get("resena") ?? "").replace(/\r\n/g, "\n").trim(),
    tecnica: texto(datos, "tecnica"),
    alto_cm: texto(datos, "alto_cm"),
    ancho_cm: texto(datos, "ancho_cm"),
    profundidad_cm: texto(datos, "profundidad_cm"),
    medidas_aproximadas: datos.get("medidas_aproximadas") === "si" ? "si" : "",
    precio_salida: texto(datos, "precio_salida"),
    publicada: datos.get("publicada") === "si" ? "si" : "",
  };
  const errores: Record<string, string> = {};

  const numero = /^\d{1,3}$/.test(valores.numero) ? Number(valores.numero) : NaN;
  if (!valores.numero) errores.numero = "Escribí el número de la obra.";
  else if (!(numero >= 1 && numero <= 999)) errores.numero = "El número tiene que ser un entero entre 1 y 999.";

  if (valores.titulo.length > MAX_TITULO) errores.titulo = `El título puede tener hasta ${MAX_TITULO} caracteres.`;

  if (!valores.artista_id) errores.artista_id = "Elegí el artista.";
  else if (!esUuid(valores.artista_id)) errores.artista_id = "Elegí un artista de la lista.";

  if (valores.resena.length > MAX_RESENA) errores.resena = `La memoria puede tener hasta ${MAX_RESENA} caracteres.`;
  if (valores.tecnica.length > MAX_TECNICA) {
    errores.tecnica = `La técnica y los materiales pueden tener hasta ${MAX_TECNICA} caracteres.`;
  }

  // Medidas en centímetros: alto y ancho van juntos; la profundidad puede faltar (obra plana).
  const medida = (campo: "alto_cm" | "ancho_cm" | "profundidad_cm") => {
    if (!valores[campo]) return null;
    const valor = medidaDesdeTexto(valores[campo]);
    if (valor == null) {
      errores[campo] = "Escribí la medida en centímetros, con un decimal como máximo. Por ejemplo: 80 o 30,5.";
    }
    return valor;
  };
  const altoCm = medida("alto_cm");
  const anchoCm = medida("ancho_cm");
  const profundidadCm = medida("profundidad_cm");
  if (valores.alto_cm && !valores.ancho_cm) errores.ancho_cm = "Completá también el ancho.";
  if (valores.ancho_cm && !valores.alto_cm) errores.alto_cm = "Completá también el alto.";
  if (valores.profundidad_cm && !valores.alto_cm && !valores.ancho_cm) {
    errores.alto_cm = "Completá el alto y el ancho.";
  }

  let precioSalida: number | null = null;
  if (valores.precio_salida) {
    // Pesos enteros: "15000", "15.000" o "$ 15.000". Sin centavos.
    const limpio = valores.precio_salida.replace(/\s/g, "").replace(/^\$/, "");
    const monto = /^(\d{1,3}(\.\d{3})+|\d+)$/.test(limpio) ? montoDesdeTexto(limpio) : null;
    if (monto == null) {
      errores.precio_salida = "Escribí el precio en pesos enteros, sin centavos. Por ejemplo: 15000 o 15.000.";
    } else if (monto < 1) {
      errores.precio_salida = "El precio de salida tiene que ser mayor que cero.";
    } else if (monto > PRECIO_MAXIMO) {
      errores.precio_salida = "El precio de salida no puede superar $ 1.000.000.000. Revisá el monto.";
    } else {
      precioSalida = monto;
    }
  }

  const obra: DatosObra = {
    numero,
    titulo: valores.titulo || null,
    artistaId: valores.artista_id,
    resena: valores.resena,
    tecnica: valores.tecnica || null,
    altoCm,
    anchoCm,
    profundidadCm,
    medidasAproximadas: valores.medidas_aproximadas === "si" && altoCm != null,
    precioSalida,
    publicada: valores.publicada === "si",
  };
  return { obra, errores, valores };
}

/** Traduce el error de la base al campo que corresponde. */
function erroresDeGuardado(error: unknown, valores: Record<string, string>): EstadoAccion {
  if (codigo(error) === "23505") {
    return { errores: { numero: "Ya hay otra obra con ese número. Elegí otro." }, valores };
  }
  if (codigo(error) === "23503") {
    return { errores: { artista_id: "Ese artista ya no existe. Elegí otro de la lista." }, valores };
  }
  return { error: mensajeDeErrorDb(error), valores };
}

export async function crearObraAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const { obra, errores, valores } = leerObra(datos);
  if (Object.keys(errores).length) {
    return { errores, valores, error: "Revisá los datos marcados." };
  }
  let id: string;
  try {
    id = await crearObra(admin, obra);
  } catch (error) {
    return erroresDeGuardado(error, valores);
  }
  redirect(`/admin/obras/${id}?creada=1`);
}

/** Aviso antes de despublicar una obra con ofertas válidas. */
function textoDespublicar(ofertasValidas: number, mayorOferta: number) {
  const ofertas = ofertasValidas === 1 ? "1 oferta válida" : `${ofertasValidas} ofertas válidas`;
  return (
    `La obra tiene ${ofertas} y la mayor es de ${pesos(mayorOferta)}. Si la despublicás, deja de verse en el ` +
    "sitio, no recibe más ofertas y no figura en el listado final que se descarga para el martillero. " +
    "En «Mis ofertas», quienes ofertaron ven que la obra ya no está en la subasta. " +
    "Las ofertas se conservan y vuelven a contar si la publicás otra vez."
  );
}

export async function actualizarObraAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const id = texto(datos, "id");
  const { obra, errores, valores } = leerObra(datos);
  if (Object.keys(errores).length) {
    return { errores, valores, error: "Revisá los datos marcados." };
  }
  // La confirmación vale solo para el aviso que se mostró (misma cantidad de ofertas y mayor oferta).
  const confirmacion = datos.get("confirmar_despublicar") === "si" ? texto(datos, "confirmacion_para") : null;
  let resultado: Awaited<ReturnType<typeof actualizarObra>>;
  try {
    resultado = await actualizarObra(admin, id, obra, confirmacion);
  } catch (error) {
    return erroresDeGuardado(error, valores);
  }
  if (!resultado.ok) {
    if (resultado.motivo === "confirmar_despublicar") {
      return {
        error: "La obra tiene ofertas válidas. Leé el aviso, marcá la confirmación y volvé a guardar.",
        errores: { confirmar_despublicar: textoDespublicar(resultado.ofertasValidas, resultado.mayorOferta) },
        valores: { ...valores, confirmacion_para: resultado.clave },
      };
    }
    return { error: "La obra ya no existe. Volvé al listado de obras.", valores };
  }
  refresh();
  return { ok: true, mensaje: "Guardamos los cambios de la obra.", valores };
}

export async function borrarObraAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  if (datos.get("confirmo") !== "si") {
    return { errores: { confirmo: "Para borrar la obra, marcá la casilla de confirmación." } };
  }
  let resultado: Awaited<ReturnType<typeof borrarObra>>;
  try {
    resultado = await borrarObra(admin, texto(datos, "id"));
  } catch (error) {
    if (codigo(error) === "23001" || codigo(error) === "23503") {
      return {
        error:
          "No se puede borrar porque la obra tiene ofertas registradas. Si no querés que se vea en el sitio, despublicala.",
      };
    }
    return { error: mensajeDeErrorDb(error) };
  }
  if (!resultado.ok) {
    if (resultado.motivo === "con_ofertas") {
      return {
        error: `No se puede borrar porque la obra tiene ${resultado.cantidad === 1 ? "1 oferta registrada" : `${resultado.cantidad} ofertas registradas`} (las anuladas también cuentan). Si no querés que se vea en el sitio, despublicala.`,
      };
    }
    return { error: "La obra ya no existe." };
  }
  // Los archivos se borran después de confirmar el borrado en la base.
  await Promise.allSettled(resultado.rutasFotos.map((ruta) => borrarFoto(ruta)));
  redirect(`/admin/obras?borrada=${resultado.numero}`);
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

function validarTextoAlternativo(valor: string) {
  if (!valor) return "Escribí una descripción breve de la foto.";
  if (valor.length < 5) return "La descripción es muy corta. Contá en pocas palabras qué se ve en la foto.";
  if (valor.length > MAX_ALT) return `La descripción puede tener hasta ${MAX_ALT} caracteres.`;
  return null;
}

/** Mensaje claro para los errores de guardarFoto (tipo, peso o imagen que no se puede leer). */
function errorDeFoto(error: unknown) {
  const mensaje = error instanceof Error ? error.message : "";
  if (mensaje.startsWith("La foto")) return mensaje;
  if (mensaje.startsWith("No se pudo subir")) {
    // Falla del almacenamiento (no de la imagen). El mensaje no tiene datos personales.
    console.error("No se pudo guardar la foto de la obra:", mensaje);
    return "No pudimos guardar la foto en el almacenamiento. Probá de nuevo en unos minutos.";
  }
  return "No pudimos procesar la foto. Probá con otra imagen en JPG, PNG o WebP.";
}

export async function subirFotoObraAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const textoAlternativo = texto(datos, "texto_alternativo");
  const valores = { texto_alternativo: textoAlternativo };
  const archivo = datos.get("foto");

  const errores: Record<string, string> = {};
  if (!(archivo instanceof File) || archivo.size === 0) errores.foto = "Elegí una foto.";
  const errorAlt = validarTextoAlternativo(textoAlternativo);
  if (errorAlt) errores.texto_alternativo = errorAlt;
  if (Object.keys(errores).length || !(archivo instanceof File)) return { errores, valores };

  const obra = await obtenerObraAdmin(admin, texto(datos, "obra_id"));
  if (!obra) return { error: "La obra ya no existe.", valores };

  let guardada: Awaited<ReturnType<typeof guardarFoto>>;
  try {
    guardada = await guardarFoto(archivo, `obra-${obra.numero}`);
  } catch (error) {
    return { errores: { foto: errorDeFoto(error) }, valores };
  }

  try {
    const agregada = await agregarFotoObra(admin, obra.id, { ...guardada, textoAlternativo });
    if (!agregada) {
      await borrarFoto(guardada.ruta);
      return { error: "La obra ya no existe.", valores };
    }
  } catch (error) {
    await borrarFoto(guardada.ruta);
    return { error: mensajeDeErrorDb(error), valores };
  }
  refresh();
  return { ok: true, mensaje: "Subimos la foto. Quedó al final de la lista." };
}

export async function cambiarTextoFotoAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const textoAlternativo = texto(datos, "texto_alternativo");
  const valores = { texto_alternativo: textoAlternativo };
  const errorAlt = validarTextoAlternativo(textoAlternativo);
  if (errorAlt) return { errores: { texto_alternativo: errorAlt }, valores };
  try {
    const encontrada = await cambiarTextoAlternativo(admin, texto(datos, "foto_id"), textoAlternativo);
    if (!encontrada) return { error: "La foto ya no existe.", valores };
  } catch (error) {
    return { error: mensajeDeErrorDb(error), valores };
  }
  refresh();
  return { ok: true, mensaje: "Guardamos la descripción.", valores };
}

export async function moverFotoAccion(datos: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const direccion = datos.get("direccion") === "subir" ? "subir" : "bajar";
  await moverFotoObra(admin, texto(datos, "foto_id"), direccion);
  refresh();
}

export async function borrarFotoAccion(datos: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const ruta = await quitarFotoObra(admin, texto(datos, "foto_id"));
  if (ruta) await borrarFoto(ruta);
  refresh();
}
