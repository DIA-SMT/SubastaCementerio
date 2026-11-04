import type { NextRequest } from "next/server";
import { inicioCidituc } from "@/lib/auth/cidituc/flujo";

/**
 * Arranque del ingreso con Cidituc: deja una cookie de diez minutos y redirige al login de
 * Ciudad Digital. Vive en /auth/cidituc/* (y no bajo /api) para que la vuelta anotada en ese
 * login tenga la misma forma que la de las demás apps del municipio.
 */
export async function GET(request: NextRequest) {
  return inicioCidituc(request);
}
