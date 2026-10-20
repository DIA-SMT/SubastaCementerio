"use server";

import { refresh } from "next/cache";
import { mensajeDeErrorDb, type EstadoAccion } from "@/lib/admin/acciones";
import { requerirAdmin } from "@/lib/admin/sesion";
import { guardarPagina, paginaEditable, type MarcaTexto } from "@/lib/datos/admin/textos";
import { numeroConPuntos } from "@/lib/formato";
import { LARGO_MAXIMO_CONTENIDO, LARGO_MAXIMO_TITULO, normalizarContenido, normalizarTitulo } from "./reglas";

/** Versión y hora del guardado, para que el formulario sepa sobre qué texto se sigue editando. */
function valoresDeMarca(marca: MarcaTexto): Record<string, string> {
  return { version: String(marca.version), marca: marca.actualizadaAt.toISOString() };
}

export async function guardarTexto(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();

  const pagina = paginaEditable(String(datos.get("slug") ?? ""));
  if (!pagina) return { error: "No encontramos esa página. Volvé a la lista de textos y elegila de nuevo." };

  const titulo = normalizarTitulo(String(datos.get("titulo") ?? ""));
  const contenido = normalizarContenido(String(datos.get("contenido") ?? ""));
  const provisorio = datos.get("provisorio") === "si";
  const leida: MarcaTexto = {
    version: Number(datos.get("version")),
    actualizadaAt: new Date(String(datos.get("marca") ?? "")),
  };

  const errores: Record<string, string> = {};
  if (!titulo) errores.titulo = "Escribí el título de la página.";
  else if (titulo.length > LARGO_MAXIMO_TITULO) {
    errores.titulo = `El título puede tener hasta ${LARGO_MAXIMO_TITULO} caracteres.`;
  }
  if (!contenido.trim()) errores.contenido = "Escribí el contenido de la página.";
  else if (contenido.length > LARGO_MAXIMO_CONTENIDO) {
    errores.contenido = `El contenido puede tener hasta ${numeroConPuntos(LARGO_MAXIMO_CONTENIDO)} caracteres (tiene ${numeroConPuntos(contenido.length)}).`;
  }
  if (Object.keys(errores).length > 0) {
    return { error: "Revisá los datos marcados. No guardamos ningún cambio.", errores };
  }
  if (!Number.isInteger(leida.version) || leida.version < 1 || Number.isNaN(leida.actualizadaAt.getTime())) {
    return { error: "No pudimos leer la versión del texto. Recargá la página y volvé a intentar." };
  }

  let resultado;
  try {
    resultado = await guardarPagina(admin, { slug: pagina.slug, titulo, contenido, provisorio, leida });
  } catch (error) {
    return { error: mensajeDeErrorDb(error) };
  }

  if (!resultado.ok) {
    if (resultado.codigo === "conflicto") {
      // Se actualiza la pantalla con lo que guardó la otra persona; el texto que estás editando se
      // mantiene y el próximo guardado reemplaza esa versión (ya fue avisado).
      refresh();
      return {
        error:
          `Otra persona del equipo guardó cambios en este texto mientras lo editabas (ahora está en la versión ${resultado.version}). ` +
          "No guardamos tus cambios para no pisar los suyos. Revisá la versión actual en el sitio; si querés reemplazarla por la tuya, volvé a guardar.",
        valores: valoresDeMarca(resultado),
      };
    }
    return { error: "No encontramos esa página. Volvé a la lista de textos y elegila de nuevo." };
  }

  refresh();
  const valores = valoresDeMarca(resultado);
  if (resultado.sinCambios) return { ok: true, mensaje: "No había cambios para guardar.", valores };
  if (!resultado.subioVersion) {
    return { ok: true, mensaje: "Guardamos los cambios. Quedaron registrados en la auditoría.", valores };
  }
  return {
    ok: true,
    mensaje:
      `Guardamos el texto. Ahora está en la versión ${resultado.version} y el cambio quedó registrado en la auditoría.` +
      (pagina.slug === "bases-y-condiciones" ? " Quienes se registren desde ahora aceptan esta versión." : ""),
    valores,
  };
}
