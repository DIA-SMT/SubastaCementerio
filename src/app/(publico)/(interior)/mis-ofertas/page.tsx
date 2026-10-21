import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Recuadro } from "@/components/Avisos";
import { Cabecera, Columna } from "@/components/Cabecera";
import { IconoFlecha, IconoMartillo } from "@/components/Iconos";
import { usuarioActual } from "@/lib/auth";
import { miPerfil, misOfertas } from "@/lib/datos/oferente";
import { estadoSubasta } from "@/lib/datos/publico";
import type { MiOferta } from "@/lib/datos/tipos";
import { haceCuanto, pesos, tituloObra } from "@/lib/formato";
import { FormularioDatos } from "./FormularioDatos";
import { salir } from "./acciones";

export const metadata: Metadata = { title: "Mis ofertas", robots: { index: false } };

export default function PaginaMisOfertas() {
  return (
    <>
      <Cabecera antetitulo="Tu participación" titulo="Mis ofertas" />
      <Columna>
        <Suspense fallback={<div className="esqueleto h-96" aria-busy="true" />}>
          <MisOfertas />
        </Suspense>
      </Columna>
    </>
  );
}

/** Estado de una oferta propia: punto de color y texto en tinta. */
function Estado({ tono, children }: { tono: "verde" | "ambar" | "gris"; children: ReactNode }) {
  const punto = { verde: "bg-verde", ambar: "bg-ambar", gris: "bg-gris-suave" }[tono];
  return (
    <p className="mt-3 inline-flex items-center gap-2 text-[0.94rem] font-medium text-tinta">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${punto}`} />
      {children}
    </p>
  );
}

type PorObra = { ultima: MiOferta; mejorPropia: number; cantidad: number };

async function MisOfertas() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?volver=/mis-ofertas");
  const perfil = await miPerfil(usuario.id);
  if (!perfil) redirect("/registro?volver=/mis-ofertas");
  const [ofertas, estado] = await Promise.all([misOfertas(usuario.id), estadoSubasta()]);

  // Una fila por obra con la mejor oferta propia que sigue válida.
  const porObra = new Map<number, PorObra>();
  for (const o of ofertas) {
    const fila = porObra.get(o.numero) ?? { ultima: o, mejorPropia: 0, cantidad: 0 };
    fila.cantidad++;
    if (o.estado === "valida") fila.mejorPropia = Math.max(fila.mejorPropia, o.monto);
    if (o.esLaMasAlta) fila.ultima = o;
    porObra.set(o.numero, fila);
  }
  const filas = [...porObra.values()].sort((a, b) => a.ultima.numero - b.ultima.numero);

  return (
    <>
      <p className="-mt-4 text-lg text-texto">
        Hola, {perfil.nombre}. En el sitio aparecés como <strong className="font-semibold text-tinta">Oferente {perfil.aliasNumero}</strong>.
      </p>

      {perfil.bloqueado && (
        <div className="mt-4">
          <Recuadro tono="error" titulo="Tu cuenta no puede ofertar" rol="alert">
            Comunicate con la Dirección de Cementerios.
          </Recuadro>
        </div>
      )}

      {filas.length === 0 ? (
        <div className="superficie-tarjeta mt-8 flex flex-col items-center px-6 py-14 text-center">
          <IconoMartillo className="text-4xl text-gris-suave" />
          <p className="mt-5 font-display text-subtitulo font-semibold text-tinta">Todavía no hiciste ofertas</p>
          <p className="mt-2 max-w-sm text-gris">Recorré el catálogo y elegí una obra para ofertar.</p>
          <Link href="/obras" className="boton-primario mt-7 w-full sm:w-auto">
            Explorar las obras
          </Link>
        </div>
      ) : (
        <ul className="superficie-tarjeta mt-8 divide-y divide-linea">
          {filas.map(({ ultima: o, mejorPropia, cantidad }) => {
            const gano = o.esLaMasAlta && o.estado === "valida";
            // Ninguna oferta propia sigue válida en esta obra.
            const anulada = mejorPropia === 0;
            return (
              <li key={o.numero} className="p-5 sm:p-6">
                <p className="rotulo">Obra N° {o.numero}</p>
                <p className="mt-1 font-display text-subtitulo font-semibold text-tinta">
                  {tituloObra(o.titulo)}{" "}
                  <span className="font-sans text-base font-normal tracking-normal text-gris">de {o.artistaNombre}</span>
                </p>
                <p className="mt-1.5 text-texto">
                  {!anulada ? (
                    <>
                      Tu mejor oferta: <strong className="font-semibold text-tinta tabular-nums">{pesos(mejorPropia)}</strong>
                    </>
                  ) : cantidad === 1 ? (
                    "Tu oferta fue anulada."
                  ) : (
                    "Tus ofertas fueron anuladas."
                  )}
                  <span className="text-gris"> · {cantidad} {cantidad === 1 ? "oferta" : "ofertas"} · la última {haceCuanto(o.creadaAt, estado.ahora)}</span>
                </p>
                {!o.publicada ? (
                  // El equipo despublicó la obra: ya no está en la subasta y su ficha no existe.
                  <p className="mt-3 rounded-md bg-superficie px-4 py-3 text-tinta">
                    La obra ya no está en la subasta. Por consultas, comunicate con la Dirección de Cementerios.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                    {gano ? (
                      <Estado tono="verde">
                        {o.fase === "cerrada" ? "Quedaste con la oferta más alta" : "Tenés la oferta más alta"}
                      </Estado>
                    ) : anulada ? (
                      <Estado tono="gris">
                        Oferta anulada{o.ofertaActual != null && ` · oferta actual ${pesos(o.ofertaActual)}`}
                      </Estado>
                    ) : (
                      <Estado tono="ambar">
                        Te superaron{o.ofertaActual != null && ` · oferta actual ${pesos(o.ofertaActual)}`}
                      </Estado>
                    )}
                    <Link href={`/obras/${o.numero}`} className="enlace-sutil group text-[0.94rem]">
                      {gano || o.fase !== "abierta" ? "Ver la obra" : anulada ? "Ofertar de nuevo" : "Volver a ofertar"}
                      <IconoFlecha className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="superficie-tarjeta mt-10 p-6 md:p-8" aria-labelledby="titulo-datos">
        <h2 id="titulo-datos" className="text-subtitulo">
          Mis datos
        </h2>
        <dl className="mt-5 grid gap-x-8 gap-y-2 border-y border-linea py-4 sm:grid-cols-[auto_1fr]">
          <dt className="text-gris">Nombre</dt>
          <dd className="text-tinta">{perfil.nombre} {perfil.apellido}</dd>
          <dt className="text-gris">DNI</dt>
          <dd className="text-tinta tabular-nums">{perfil.dni}</dd>
          <dt className="text-gris">Correo</dt>
          <dd className="break-all text-tinta">{perfil.email}</dd>
        </dl>
        <p className="mt-3 text-[0.9rem] text-gris">Para corregir el nombre o el DNI, comunicate con la Dirección de Cementerios.</p>
        <div className="mt-7">
          <FormularioDatos telefono={perfil.telefono} avisos={perfil.avisosPorCorreo} />
        </div>
      </section>

      <form action={salir} className="mt-8">
        <button type="submit" className="boton-secundario w-full sm:w-auto">
          Cerrar sesión
        </button>
      </form>
    </>
  );
}
