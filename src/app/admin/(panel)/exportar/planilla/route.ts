import { adminActual } from "@/lib/admin/sesion";
import { obtenerListadoFinal, registrarExportacion } from "@/lib/datos/admin/exportacion";
import {
  adjunto,
  descargaRechazada,
  nombreArchivoListado,
  pedidoDelMismoSitio,
  volverAlListado,
} from "@/lib/exportacion/comun";
import { generarPlanilla } from "@/lib/exportacion/planilla";

// Descarga de la planilla del listado final (tiene datos personales y queda en la auditoría).
// Es un POST desde el formulario de /admin/exportar: un enlace o una página de otro sitio no
// la pueden disparar. El layout del panel no protege las rutas: se valida la sesión acá.
export async function POST(pedido: Request) {
  if (!pedidoDelMismoSitio(pedido.headers)) return descargaRechazada();
  const admin = await adminActual();
  if (!admin) return Response.redirect(new URL("/admin/ingresar", pedido.url), 303);

  const { filas, meta } = await obtenerListadoFinal(admin);
  const archivo = await generarPlanilla(filas, meta);
  await registrarExportacion(admin, { formato: "xlsx", preliminar: meta.preliminar, filas: filas.length });

  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": adjunto(nombreArchivoListado(meta.generado, meta.preliminar, "xlsx")),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Un enlace o marcador viejo a esta dirección lleva a la pantalla del listado, sin descargar. */
export const GET = volverAlListado;
