import type { NextRequest } from "next/server";
import { inicioCidituc } from "@/lib/auth/cidituc/flujo";

/**
 * Arranque del ingreso con Cidituc: deja una cookie de diez minutos y redirige al derivador
 * municipal. Vive en /auth/cidituc/* (y no bajo /api) para que el registro en el derivador tenga
 * la misma forma que el de las demás apps del municipio.
 */
export async function GET(request: NextRequest) {
  return inicioCidituc(request);
}
