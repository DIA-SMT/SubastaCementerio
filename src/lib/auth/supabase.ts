import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase as config } from "@/lib/entorno";
import { opcionesCookie, vidaAcotada } from "./cookies";
import type { ResultadoAuth, Usuario } from "./tipos";

// Ingreso al panel con Supabase Auth (correo y contraseña de las cuentas del equipo). Los
// oferentes ingresan con Cidituc y tienen su propia sesión (src/lib/auth/ciudadano.ts).

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
