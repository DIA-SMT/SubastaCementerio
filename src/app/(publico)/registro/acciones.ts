"use server";

import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { registrarOferente } from "@/lib/datos/oferente";
import { rutaSegura } from "@/lib/validacion";

export type EstadoRegistro = {
  errores?: Partial<Record<"nombre" | "apellido" | "dni" | "telefono" | "aceptacion" | "general", string>>;
  valores?: Record<string, string>;
  /** Cuenta las respuestas, para que el aviso de errores se vuelva a anunciar en cada intento. */
  intento?: number;
};

const ERRORES: Record<string, NonNullable<EstadoRegistro["errores"]>> = {
  datos_incompletos: { general: "Completá tu nombre y apellido." },
  dni_invalido: { dni: "El DNI tiene que tener 7 u 8 números, sin puntos." },
  // Texto neutro: no confirma que ese DNI participa de la subasta.
  dni_registrado: {
    general:
      "No pudimos completar el registro con esos datos. Si ya participaste con otro correo, ingresá con ese correo o comunicate con la Dirección de Cementerios.",
  },
  demasiados_intentos: { general: "No pudimos completar el registro. Comunicate con la Dirección de Cementerios." },
  telefono_invalido: { telefono: "Escribí el teléfono con código de área, por ejemplo 381 555 1234." },
  falta_aceptacion: { aceptacion: "Para participar tenés que aceptar las bases y la política de privacidad." },
  ya_registrado: { general: "Ya completaste tus datos." },
  correo_sin_verificar: { general: "Primero confirmá tu correo con el código." },
};

export async function registrarse(previo: EstadoRegistro, datos: FormData): Promise<EstadoRegistro> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar");
  const intento = (previo.intento ?? 0) + 1;

  const valores = {
    nombre: String(datos.get("nombre") ?? "").trim(),
    apellido: String(datos.get("apellido") ?? "").trim(),
    dni: String(datos.get("dni") ?? "").trim(),
    telefono: String(datos.get("telefono") ?? "").trim(),
  };
  const aceptaBases = datos.get("bases") === "si";
  const aceptaPrivacidad = datos.get("privacidad") === "si";

  const errores: NonNullable<EstadoRegistro["errores"]> = {};
  if (!valores.nombre) errores.nombre = "Escribí tu nombre.";
  if (!valores.apellido) errores.apellido = "Escribí tu apellido.";
  if (!valores.dni) errores.dni = "Escribí tu DNI.";
  if (!valores.telefono) errores.telefono = "Escribí tu teléfono.";
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
