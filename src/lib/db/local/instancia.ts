import "server-only";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { crearBaseLocal } from "./preparar";

// Una sola instancia por proceso, también entre recargas del servidor de desarrollo.
const global = globalThis as typeof globalThis & { __subastaBaseLocal?: Promise<PGlite> };

export function baseLocal() {
  global.__subastaBaseLocal ??= crearBaseLocal({
    carpeta: path.join(process.cwd(), ".local", "pgdata"),
    conEjemplos: true,
  });
  return global.__subastaBaseLocal;
}
