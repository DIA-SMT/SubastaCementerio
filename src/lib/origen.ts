import "server-only";
import { urlSitio } from "@/lib/entorno";
import { esDireccionLocal } from "@/lib/exportacion/comun";

/**
 * La dirección pública de una ruta de este sitio, para redirigir.
 *
 * No sale de la URL del pedido: en el servidor propio la app corre detrás de nginx en
 * 127.0.0.1:3008, y Next arma `request.url` con esa dirección interna, así que una redirección
 * mandaría a la persona a https://localhost:3008. En producción manda la dirección configurada
 * (NEXT_PUBLIC_URL_SITIO: https://subastas.smt.gob.ar, la misma de los correos y los QR). En
 * desarrollo, con la dirección local, sí se usa la del pedido: así anda en cualquier puerto.
 */
export function urlDelSitio(ruta: string, urlDelPedido: string | URL): URL {
  const origen = esDireccionLocal(urlSitio) ? new URL(urlDelPedido).origin : new URL(urlSitio).origin;
  return new URL(ruta, origen);
}

/**
 * GET a una ruta de descarga del listado (un enlace o un marcador): lleva a la pantalla del
 * listado sin generar el archivo. La descarga se pide con el formulario de esa pantalla.
 */
export function volverAlListado(pedido: Request) {
  return Response.redirect(urlDelSitio("/admin/exportar", pedido.url), 303);
}
