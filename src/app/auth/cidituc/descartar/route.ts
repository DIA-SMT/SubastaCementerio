import type { NextRequest } from "next/server";
import { descartarSesion } from "@/lib/auth/cidituc/flujo";

/** Borra una sesión de oferente que ya no corresponde a ninguna persona y vuelve al ingreso. */
export async function GET(request: NextRequest) {
  return descartarSesion(request);
}
