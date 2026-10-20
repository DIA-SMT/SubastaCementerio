import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as config } from "@/lib/entorno";
import { opcionesCookie, vidaAcotada } from "./cookies";
import type { ResultadoAuth, Usuario } from "./tipos";

// Autenticación con Supabase Auth. Los correos con el código los manda Supabase Auth (no
// Resend), con las plantillas de Authentication > Email Templates:
//  - "Confirm signup": primer ingreso de cada correo (signInWithOtp crea el usuario).
//  - "Magic Link": ingresos siguientes.
// Las dos tienen que mostrar el código con {{ .Token }}, sin el enlace {{ .ConfirmationURL }}
// (la app no procesa enlaces), y el largo del código (Email OTP Length) tiene que ser 6, que
// es lo que pide el formulario. "Confirm email" tiene que quedar activo. Hace falta además un
// SMTP propio: el servicio de correo que trae Supabase solo entrega a las direcciones del
// equipo del proyecto. Los pasos están en la sección de despliegue del README.

/** Cliente de Supabase con la sesión del pedido (cookies). También lo usa el almacenamiento de fotos. */
export async function clienteSupabase() {
  const almacen = await cookies();
  return createServerClient(config.url, config.claveAnonima, {
    cookieOptions: opcionesCookie,
    cookies: {
      getAll: () => almacen.getAll(),
      // Los encabezados anti-caché que manda @supabase/ssr (segundo argumento) los aplica
      // src/proxy.ts, que es donde se renueva la sesión en los GET. Acá las cookies solo se
      // escriben desde Server Actions (POST), cuyas respuestas no se guardan en caché.
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, vidaAcotada(options));
        } catch {
          // En un Server Component no se pueden escribir cookies; las renueva el proxy.
        }
      },
    },
  });
}

export async function usuarioActual(): Promise<Usuario | null> {
  const { data } = await (await clienteSupabase()).auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !claims.email) return null;
  return { id: claims.sub, email: claims.email };
}

type FallaAuth = { name: string; message: string; code?: string; status?: number };

/**
 * Deja el error en los logs sin datos personales: el mensaje de Supabase Auth puede traer el
 * correo ("Email address "…" is invalid"). Solo se agrega el mensaje, con los correos
 * enmascarados, cuando no hay código de error (por ejemplo, una falla de red).
 */
function registrarFalla(operacion: string, error: FallaAuth, nota?: string) {
  const partes: unknown[] = [error.name, error.code ?? "sin_codigo", error.status ?? "sin_estado"];
  if (!error.code) partes.push(error.message.replace(/[^\s"'<>@]+@[^\s"'<>@]+/g, "<correo>"));
  if (nota) partes.push(`— ${nota}`);
  console.error(`Supabase Auth ${operacion}:`, ...partes);
}

/** Red caída o error del servidor de Supabase: no dice nada sobre el código o la contraseña. */
const esFallaDelServicio = (error: FallaAuth) => !error.code || !error.status || error.status >= 500;

export async function enviarCodigo(email: string): Promise<ResultadoAuth> {
  const { error } = await (await clienteSupabase()).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (!error) return { ok: true };
  switch (error.code) {
    case "email_address_not_authorized":
      registrarFalla(
        "signInWithOtp",
        error,
        "sin SMTP propio, Supabase solo envía a las direcciones del equipo del proyecto (Authentication > SMTP Settings)",
      );
      return { ok: false, error: "correo_no_autorizado" };
    case "over_email_send_rate_limit":
      registrarFalla(
        "signInWithOtp",
        error,
        "límite de envío de correos: un envío por minuto por correo o el cupo del proyecto (Authentication > Rate Limits)",
      );
      return { ok: false, error: "limite_correos" };
    case "email_address_invalid":
      registrarFalla("signInWithOtp", error);
      return { ok: false, error: "correo_invalido" };
  }
  registrarFalla("signInWithOtp", error);
  return { ok: false, error: error.status === 429 ? "servicio_ocupado" : "error_servicio" };
}

export async function verificarCodigo(email: string, codigo: string): Promise<ResultadoAuth> {
  const { data, error } = await (await clienteSupabase()).auth.verifyOtp({ email, token: codigo, type: "email" });
  if (!error) return { ok: true, uid: data.user?.id };
  if (error.status === 429 || esFallaDelServicio(error)) {
    registrarFalla("verifyOtp", error);
    return { ok: false, error: error.status === 429 ? "servicio_ocupado" : "error_servicio" };
  }
  // Supabase Auth responde otp_expired tanto si el código venció como si está mal escrito.
  return { ok: false, error: error.code === "otp_expired" ? "codigo_invalido_o_vencido" : "codigo_incorrecto" };
}

export async function ingresarConContrasena(email: string, contrasena: string): Promise<ResultadoAuth> {
  const { data, error } = await (await clienteSupabase()).auth.signInWithPassword({ email, password: contrasena });
  if (!error) return { ok: true, uid: data.user.id };
  if (error.status === 429 || esFallaDelServicio(error)) {
    registrarFalla("signInWithPassword", error);
    return { ok: false, error: error.status === 429 ? "servicio_ocupado" : "error_servicio" };
  }
  return { ok: false, error: "credenciales_invalidas" };
}

export async function cerrarSesion() {
  await (await clienteSupabase()).auth.signOut();
}
