import "server-only";
import crypto from "node:crypto";
import { modoLocal, proveedorDeCorreo } from "@/lib/entorno";

type Correo = {
  para: string;
  asunto: string;
  texto: string;
  /**
   * Identifica el envío ante Resend (encabezado Idempotency-Key, vale 24 horas): si el mismo
   * correo se vuelve a mandar con la misma clave, Resend no lo envía de nuevo.
   */
  idempotencia?: string;
};

/** Saca las direcciones de correo de un texto (para logs y mensajes de error). */
export function sinCorreos(texto: string) {
  return texto.replace(/[^\s"'<>(),;:@]+@[^\s"'<>(),;:@]+/g, "<correo>");
}

/**
 * Envía un correo con Resend. En modo local, sin RESEND_API_KEY o CORREO_REMITENTE, lo escribe
 * en la consola. Fuera del modo local, sin esas variables, falla sin escribir ningún dato
 * personal: quien llama decide qué hacer (los avisos quedan pendientes).
 */
export async function enviarCorreo({ para, asunto, texto, idempotencia }: Correo) {
  const proveedor = proveedorDeCorreo();
  if (!proveedor) {
    if (!modoLocal) throw new Error("Falta configurar RESEND_API_KEY o CORREO_REMITENTE.");
    console.info(`[correo sin enviar] Para: ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
    return;
  }
  const cuerpo = JSON.stringify({ from: proveedor.remitente, to: [para], subject: asunto, text: texto });
  const encabezados: Record<string, string> = {
    Authorization: `Bearer ${proveedor.clave}`,
    "Content-Type": "application/json",
  };
  if (idempotencia) {
    // Resend rechaza (409) la misma clave con otro contenido: si los datos del correo cambiaron
    // entre un intento y otro, la clave también cambia.
    const huella = crypto.createHash("sha256").update(cuerpo).digest("hex").slice(0, 16);
    encabezados["Idempotency-Key"] = `${idempotencia}-${huella}`;
  }
  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: encabezados,
    body: cuerpo,
    signal: AbortSignal.timeout(15_000),
  });
  if (!respuesta.ok) {
    const detalle = sinCorreos(await respuesta.text().catch(() => "")).slice(0, 300);
    throw new Error(`Resend respondió ${respuesta.status}: ${detalle}`);
  }
}
