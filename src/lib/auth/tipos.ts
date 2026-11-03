// Ingreso al panel (cuentas del equipo). Los oferentes ingresan con Cidituc: sus errores están en
// src/lib/auth/cidituc/errores.ts.

export type Usuario = { id: string; email: string };

export type ErrorAuth =
  /** Límite propio: demasiadas pruebas de contraseña. */
  | "demasiados_intentos"
  | "credenciales_invalidas"
  /** Supabase Auth: 429 por IP (la del servidor, compartida por todas las personas). */
  | "servicio_ocupado"
  /** Red caída, error 5xx o base sin conexión. */
  | "error_servicio";

export type ResultadoAuth = { ok: true; uid?: string } | { ok: false; error: ErrorAuth };
