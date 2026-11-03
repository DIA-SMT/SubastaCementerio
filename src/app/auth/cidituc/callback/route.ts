import type { NextRequest } from "next/server";
import { callbackCidituc } from "@/lib/auth/cidituc/flujo";

/**
 * La vuelta desde Cidituc, con `?auth=<token>&state=<nonce>`.
 *
 * Esta URL es la registrada en el derivador (repo `derivador`, src/components/Login/Login.jsx,
 * mapa RESPALDO_CALLBACK). Cambiarla acá sin cambiarla allá rompe el ingreso de una manera que
 * engaña: el primer intento falla porque la cookie del `state` la puso otro dominio, y el
 * segundo entra porque la persona ya quedó en el dominio viejo.
 *
 * Corre en Node (el único runtime con Cache Components): el transporte usa node:https.
 */
export async function GET(request: NextRequest) {
  return callbackCidituc(request);
}
