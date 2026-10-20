import { adminActual } from "@/lib/admin/sesion";
import { obrasParaCarteles } from "@/lib/datos/admin/exportacion";
import { urlSitio } from "@/lib/entorno";
import { adjunto } from "@/lib/exportacion/comun";
import { qrPng, qrSvg } from "@/lib/exportacion/qr";
import { numeroDeObra } from "@/lib/validacion";

// QR suelto de una obra publicada, en PNG de alta resolución (por defecto) o SVG.
// Se valida la sesión del equipo acá: el layout del panel no protege las rutas.
export async function GET(pedido: Request, { params }: RouteContext<"/admin/qr/[numero]">) {
  const admin = await adminActual();
  if (!admin) return Response.redirect(new URL("/admin/ingresar", pedido.url), 303);

  const numero = numeroDeObra((await params).numero);
  const { obras } = await obrasParaCarteles(admin, urlSitio);
  const obra = numero == null ? undefined : obras.find((o) => o.numero === numero);
  if (!obra) {
    return new Response("No hay una obra publicada con ese número.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const nombre = `qr-obra-${String(obra.numero).padStart(2, "0")}`;
  const comunes = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (new URL(pedido.url).searchParams.get("formato") === "svg") {
    return new Response(await qrSvg(obra.url), {
      headers: {
        ...comunes,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": adjunto(`${nombre}.svg`),
      },
    });
  }
  return new Response(new Uint8Array(await qrPng(obra.url)), {
    headers: { ...comunes, "Content-Type": "image/png", "Content-Disposition": adjunto(`${nombre}.png`) },
  });
}
