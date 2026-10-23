"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeDeErrorDb, type EstadoAccion } from "@/lib/admin/acciones";
import { requerirAdmin } from "@/lib/admin/sesion";
import { borrarFoto, guardarFoto } from "@/lib/almacenamiento";
import {
  actualizarArtista,
  borrarArtista,
  cambiarFotoArtista,
  crearArtista,
  type DatosArtista,
} from "@/lib/datos/admin/artistas";
import { usuarioInstagram } from "@/lib/validacion";

// Acciones del panel para artistas. Cada una verifica la sesión del equipo.

const MAX_NOMBRE = 120;
const MAX_RESENA = 6000;
const MAX_ENLACE = 500;

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();
const codigo = (error: unknown) => (error as { code?: string } | null)?.code;

/** Solo enlaces web completos (http:// o https://). */
function enlaceValido(valor: string) {
  if (!/^https?:\/\//i.test(valor)) return false;
  try {
    const url = new URL(valor);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function leerArtista(datos: FormData) {
  const valores = {
    nombre: texto(datos, "nombre").replace(/\s+/g, " "),
    resena: String(datos.get("resena") ?? "").replace(/\r\n/g, "\n").trim(),
    enlace: texto(datos, "enlace"),
    instagram: texto(datos, "instagram"),
  };
  const errores: Record<string, string> = {};
  if (!valores.nombre) errores.nombre = "Escribí el nombre del artista.";
  else if (valores.nombre.length > MAX_NOMBRE) errores.nombre = `El nombre puede tener hasta ${MAX_NOMBRE} caracteres.`;
  if (valores.resena.length > MAX_RESENA) errores.resena = `La reseña puede tener hasta ${MAX_RESENA} caracteres.`;
  if (valores.enlace) {
    if (valores.enlace.length > MAX_ENLACE) errores.enlace = `El enlace puede tener hasta ${MAX_ENLACE} caracteres.`;
    else if (!enlaceValido(valores.enlace)) {
      errores.enlace = "Pegá la dirección completa, que empiece con http:// o https://. Por ejemplo: https://www.sitio.com.ar";
    }
  }
  const instagram = valores.instagram ? usuarioInstagram(valores.instagram) : null;
  if (valores.instagram && !instagram) {
    errores.instagram =
      "Escribí el usuario (por ejemplo, @usuario) o pegá la dirección del perfil (https://www.instagram.com/usuario).";
  }
  const artista: DatosArtista = {
    nombre: valores.nombre,
    resena: valores.resena,
    enlace: valores.enlace || null,
    instagram,
  };
  return { artista, errores, valores };
}

export async function crearArtistaAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const { artista, errores, valores } = leerArtista(datos);
  if (Object.keys(errores).length) return { errores, valores, error: "Revisá los datos marcados." };
  let id: string;
  try {
    id = await crearArtista(admin, artista);
  } catch (error) {
    return { error: mensajeDeErrorDb(error), valores };
  }
  redirect(`/admin/artistas/${id}?creado=1`);
}

export async function actualizarArtistaAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const { artista, errores, valores } = leerArtista(datos);
  if (Object.keys(errores).length) return { errores, valores, error: "Revisá los datos marcados." };
  try {
    const encontrado = await actualizarArtista(admin, texto(datos, "id"), artista);
    if (!encontrado) return { error: "El artista ya no existe. Volvé al listado de artistas.", valores };
  } catch (error) {
    return { error: mensajeDeErrorDb(error), valores };
  }
  refresh();
  // El campo vuelve a mostrar lo que quedó guardado: solo el usuario, con @.
  return {
    ok: true,
    mensaje: "Guardamos los cambios.",
    valores: { ...valores, instagram: artista.instagram ? `@${artista.instagram}` : "" },
  };
}

export async function subirFotoArtistaAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  const archivo = datos.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return { errores: { foto: "Elegí una foto." } };

  let ruta: string;
  try {
    ruta = (await guardarFoto(archivo, "artistas")).ruta;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";
    if (mensaje.startsWith("La foto")) return { errores: { foto: mensaje } };
    if (mensaje.startsWith("No se pudo subir")) {
      // Falla del almacenamiento (no de la imagen). El mensaje no tiene datos personales.
      console.error("No se pudo guardar la foto del artista:", mensaje);
      return { errores: { foto: "No pudimos guardar la foto en el almacenamiento. Probá de nuevo en unos minutos." } };
    }
    return { errores: { foto: "No pudimos procesar la foto. Probá con otra imagen en JPG, PNG o WebP." } };
  }

  let resultado: Awaited<ReturnType<typeof cambiarFotoArtista>>;
  try {
    resultado = await cambiarFotoArtista(admin, texto(datos, "artista_id"), ruta);
  } catch (error) {
    await borrarFoto(ruta);
    return { error: mensajeDeErrorDb(error) };
  }
  if (!resultado.encontrado) {
    await borrarFoto(ruta);
    return { error: "El artista ya no existe." };
  }
  // La foto anterior se reemplaza: se borra el archivo.
  if (resultado.anterior) await borrarFoto(resultado.anterior);
  refresh();
  return { ok: true, mensaje: resultado.anterior ? "Reemplazamos la foto." : "Subimos la foto." };
}

export async function quitarFotoArtistaAccion(datos: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const resultado = await cambiarFotoArtista(admin, texto(datos, "artista_id"), null);
  if (resultado.anterior) await borrarFoto(resultado.anterior);
  refresh();
}

export async function borrarArtistaAccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();
  if (datos.get("confirmo") !== "si") {
    return { errores: { confirmo: "Para borrar el artista, marcá la casilla de confirmación." } };
  }
  let resultado: Awaited<ReturnType<typeof borrarArtista>>;
  try {
    resultado = await borrarArtista(admin, texto(datos, "id"));
  } catch (error) {
    if (codigo(error) === "23001" || codigo(error) === "23503") {
      return { error: "No se puede borrar porque tiene obras asignadas. Asigná esas obras a otro artista o borralas primero." };
    }
    return { error: mensajeDeErrorDb(error) };
  }
  if (!resultado.ok) {
    if (resultado.motivo === "con_obras") {
      return {
        error: `No se puede borrar porque tiene ${resultado.cantidad === 1 ? "1 obra asignada" : `${resultado.cantidad} obras asignadas`}. Asigná esas obras a otro artista o borralas primero.`,
      };
    }
    return { error: "El artista ya no existe." };
  }
  if (resultado.fotoRuta) await borrarFoto(resultado.fotoRuta);
  redirect("/admin/artistas?borrado=1");
}
