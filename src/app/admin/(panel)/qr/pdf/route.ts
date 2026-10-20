import { adminActual } from "@/lib/admin/sesion";
import { obrasParaCarteles } from "@/lib/datos/admin/exportacion";
import { urlSitio } from "@/lib/entorno";
import { generarPdfCarteles } from "@/lib/exportacion/carteles-pdf";
import { adjunto, diaIso } from "@/lib/exportacion/comun";

// Descarga del PDF con un cartel por obra publicada. Se valida la sesión del equipo acá:
// el layout del panel no protege las rutas.
export async function GET(pedido: Request) {
  const admin = await adminActual();
  if (!admin) return Response.redirect(new URL("/admin/ingresar", pedido.url), 303);

  const { obras, generado } = await obrasParaCarteles(admin, urlSitio);
  // Sin obras publicadas no hay carteles: vuelve a la pantalla, que lo explica, en lugar de
  // dejar a la persona en una página de texto suelto.
  if (obras.length === 0) return Response.redirect(new URL("/admin/qr", pedido.url), 303);

  const archivo = await generarPdfCarteles(obras, { generado });
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": adjunto(`carteles-qr-subasta-${diaIso(generado)}.pdf`),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
