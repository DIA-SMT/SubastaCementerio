"use server";

import { redirect } from "next/navigation";
import { ciudadanoActual } from "@/lib/auth/ciudadano";
import { registrarOferente } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";

export type EstadoRegistro = {
  errores?: Partial<Record<"telefono" | "email" | "aceptacion" | "general", string>>;
  valores?: Record<string, string>;
  /** Cuenta las respuestas, para que el aviso de errores se vuelva a anunciar en cada intento. */
  intento?: number;
};

const ERRORES: Record<string, NonNullable<EstadoRegistro["errores"]>> = {
  datos_incompletos: {
    general:
      "Tu cuenta de Ciudadano Digital no tiene cargados el nombre y el apellido. Completalos ahí y volvé a ingresar.",
  },
  // Texto neutro: no confirma que ese DNI participa de la subasta.
  dni_registrado: {
    general:
      "No pudimos completar el registro con estos datos. Si ya participaste con otra cuenta, comunicate con la Dirección de Cementerios.",
  },
  demasiados_intentos: { general: "No pudimos completar el registro. Comunicate con la Dirección de Cementerios." },
  telefono_invalido: { telefono: "Escribí el teléfono con código de área, por ejemplo 381 555 1234." },
  correo_invalido: { email: "Revisá el correo: no parece una dirección válida." },
  falta_aceptacion: { aceptacion: "Para participar tenés que aceptar las bases y la política de privacidad." },
  sin_identidad: { general: "Volvé a ingresar con Ciudadano Digital." },
};

export async function registrarse(previo: EstadoRegistro, datos: FormData): Promise<EstadoRegistro> {
  const usuario = await ciudadanoActual();
  if (!usuario) redirect("/ingresar");
  const intento = (previo.intento ?? 0) + 1;

  const valores = {
    telefono: String(datos.get("telefono") ?? "").trim(),
    email: String(datos.get("email") ?? "").trim(),
  };
  const aceptaBases = datos.get("bases") === "si";
  const aceptaPrivacidad = datos.get("privacidad") === "si";

  const errores: NonNullable<EstadoRegistro["errores"]> = {};
  if (!valores.telefono) errores.telefono = "Escribí tu teléfono.";
  if (!valores.email) errores.email = "Escribí tu correo.";
  if (!aceptaBases || !aceptaPrivacidad) {
    errores.aceptacion = "Para participar tenés que aceptar las bases y la política de privacidad.";
  }
  const conAceptacion = { ...valores, bases: aceptaBases ? "si" : "", privacidad: aceptaPrivacidad ? "si" : "" };
  if (Object.keys(errores).length) return { errores, valores: conAceptacion, intento };

  const r = await registrarOferente(usuario.id, { ...valores, aceptaBases, aceptaPrivacidad });
  if (!r.ok) {
    if (r.codigo === "ya_registrado") redirect(rutaSegura(datos.get("volver")));
    return {
      errores: ERRORES[String(r.codigo)] ?? { general: "No pudimos guardar tus datos. Probá de nuevo." },
      valores: conAceptacion,
      intento,
    };
  }
  redirect(rutaSegura(datos.get("volver")));
}
