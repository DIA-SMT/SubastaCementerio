export type Usuario = { id: string; email: string };

export type ErrorAuth =
  /** Modo local: el código venció. También cuando no se pidió ningún código en la última hora. */
  | "codigo_vencido"
  /** Modo local: el código no coincide. */
  | "codigo_incorrecto"
  /** Supabase Auth responde lo mismo (otp_expired) si el código está mal escrito o si venció. */
  | "codigo_invalido_o_vencido"
  /** Límite propio: demasiadas pruebas de código o de contraseña. */
  | "demasiados_intentos"
  | "credenciales_invalidas"
  /** Límite propio: varios pedidos de código para el mismo correo. */
  | "limite_envios"
  /** Límite propio: muchos pedidos de código desde la misma conexión (IP). */
  | "limite_conexion"
  /** Supabase Auth: over_email_send_rate_limit (por correo o del proyecto). */
  | "limite_correos"
  /** Supabase Auth: email_address_not_authorized (sin SMTP propio solo envía al equipo). */
  | "correo_no_autorizado"
  /** Supabase Auth: email_address_invalid. */
  | "correo_invalido"
  /** Supabase Auth: 429 por IP (la del servidor, compartida por todas las personas). */
  | "servicio_ocupado"
  /** Red caída, error 5xx o base sin conexión. */
  | "error_servicio";

export type ResultadoAuth = { ok: true; uid?: string; codigoLocal?: string } | { ok: false; error: ErrorAuth };
