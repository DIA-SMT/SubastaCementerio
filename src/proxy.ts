import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { opcionesCookie, vidaAcotada } from "@/lib/auth/cookies";

// Con Supabase, renueva la sesión del usuario antes de cada pedido (los Server Components
// no pueden escribir cookies). En modo local no hace nada.
export async function proxy(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next();

  let respuesta = NextResponse.next({ request });
  // Si @supabase/ssr escribe cookies más de una vez, la respuesta se vuelve a crear: se
  // guardan las cookies y los encabezados anti-caché (que manda solo en la primera escritura)
  // para aplicarlos todos en la respuesta nueva.
  const escritas = new Map<string, { value: string; options: CookieOptions }>();
  const antiCache: Record<string, string> = {};
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: opcionesCookie,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista, encabezados) => {
          Object.assign(antiCache, encabezados);
          for (const { name, value, options } of lista) {
            request.cookies.set(name, value);
            escritas.set(name, { value, options });
          }
          respuesta = NextResponse.next({ request });
          for (const [name, { value, options }] of escritas) respuesta.cookies.set(name, value, vidaAcotada(options));
          // Una respuesta con el token de una persona no puede quedar en la caché de un CDN.
          for (const [clave, valor] of Object.entries(antiCache)) respuesta.headers.set(clave, valor);
        },
      },
    },
  );
  await supabase.auth.getClaims();
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ejemplo/|marca/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
