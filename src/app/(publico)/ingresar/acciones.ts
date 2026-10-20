"use server";

import { redirect } from "next/navigation";
import { enviarCodigo, verificarCodigo, type ErrorAuth } from "@/lib/auth";
import { miPerfil } from "@/lib/datos/oferente";
import { normalizarCorreo, rutaSegura } from "@/lib/validacion";

export type EstadoIngreso = {
  paso: "correo" | "codigo";
  email?: string;
  error?: string;
  /** Solo en modo local: el código se muestra en pantalla porque no se envían correos. */
  codigoLocal?: string;
  /** Códigos enviados a este correo desde esta pantalla (para anunciar cada reenvío). */
  envios?: number;
  /** En la revisión del código: a qué envío corresponde el error (uno anterior ya no se muestra). */
  envio?: number;
  /** Cuenta las respuestas, para que un mismo error se vuelva a anunciar. */
  intento?: number;
};

const ERRORES: Record<ErrorAuth, string> = {
  codigo_vencido: "El código venció. Pedí uno nuevo.",
  codigo_incorrecto: "El código no es correcto. Revisalo y probá de nuevo.",
  codigo_invalido_o_vencido:
    "El código no es correcto o ya venció. Revisalo y probá de nuevo; si sigue sin funcionar, pedí uno nuevo.",
  demasiados_intentos: "Hubo demasiados intentos con este código. Pedí uno nuevo.",
  credenciales_invalidas: "El correo o la contraseña no son correctos.",
  limite_envios: "Pediste varios códigos seguidos. Esperá unos minutos y probá de nuevo.",
  limite_conexion:
    "Se pidieron muchos códigos desde tu conexión. Esperá un rato y probá de nuevo, o probá desde otra conexión (por ejemplo, con los datos del celular en lugar del wifi).",
  limite_correos:
    "Se mandaron muchos códigos en poco tiempo. Esperá unos minutos y probá de nuevo. Si ya pediste uno, revisá también la carpeta de correo no deseado.",
  correo_no_autorizado: "En este momento no podemos enviar el código a ese correo. Probá de nuevo más tarde.",
  correo_invalido: "Revisá el correo: no parece una dirección válida.",
  servicio_ocupado: "El servicio de ingreso está recibiendo muchos pedidos. Esperá unos minutos y probá de nuevo.",
  error_servicio: "No pudimos enviar el correo. Probá de nuevo en unos minutos.",
};

/** Al revisar el código, una falla del servicio no tiene que hablar del envío del correo. */
const ERRORES_VERIFICACION: Partial<Record<ErrorAuth, string>> = {
  error_servicio: "No pudimos revisar el código. Probá de nuevo en unos minutos.",
};

export async function pedirCodigo(previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const intento = (previo.intento ?? 0) + 1;
  const email = normalizarCorreo(datos.get("email"));
  if (!email) {
    return { paso: "correo", intento, error: "Escribí un correo electrónico válido, por ejemplo nombre@gmail.com." };
  }
  const anteriores = previo.email === email ? (previo.envios ?? 0) : 0;
  const r = await enviarCodigo(email);
  if (!r.ok) {
    const error = ERRORES[r.error];
    // Si falla un reenvío, la persona sigue en el paso del código: el anterior puede seguir vigente.
    if (previo.paso === "codigo" && previo.email === email) return { ...previo, intento, error };
    return { paso: "correo", email, intento, envios: anteriores, error };
  }
  return { paso: "codigo", email, codigoLocal: r.codigoLocal, envios: anteriores + 1, intento };
}

export async function confirmarCodigo(previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const intento = (previo.intento ?? 0) + 1;
  const envio = Number(datos.get("envio")) || undefined;
  const email = normalizarCorreo(datos.get("email"));
  const codigo = String(datos.get("codigo") ?? "").replace(/\D/g, "");
  const volver = rutaSegura(datos.get("volver"));
  if (!email) return { paso: "correo", intento, envio, error: "Volvé a escribir tu correo." };
  if (codigo.length !== 6) {
    return { ...previo, paso: "codigo", email, intento, envio, error: "El código tiene 6 números." };
  }
  const r = await verificarCodigo(email, codigo);
  if (!r.ok) {
    const error = ERRORES_VERIFICACION[r.error] ?? ERRORES[r.error];
    return { ...previo, paso: "codigo", email, intento, envio, error };
  }

  const perfil = r.uid ? await miPerfil(r.uid) : null;
  redirect(perfil ? volver : `/registro?volver=${encodeURIComponent(volver)}`);
}
