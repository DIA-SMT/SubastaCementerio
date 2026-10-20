import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Recuadro } from "@/components/Avisos";
import { Cabecera } from "@/components/Cabecera";
import { TituloSeccion } from "@/components/TituloSeccion";
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
      <Cabecera antetitulo="Tu participación" titulo="Mis ofertas" compacta />
      <div className="relative z-10 mx-auto -mt-12 max-w-3xl px-4">
        <div className="superficie-tarjeta p-6 md:p-8">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-linea" aria-busy="true" />}>
            <MisOfertas />
          </Suspense>
        </div>
      </div>
    </>
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
      <p className="text-lg">
        Hola, {perfil.nombre}. En el sitio aparecés como <strong className="text-tinta">Oferente {perfil.aliasNumero}</strong>.
      </p>

      {perfil.bloqueado && (
        <div className="mt-4">
          <Recuadro tono="error" titulo="Tu cuenta no puede ofertar" rol="alert">
            Comunicate con la Dirección de Cementerios.
          </Recuadro>
        </div>
      )}

      {filas.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-fondo p-5">
          <p className="text-lg">Todavía no hiciste ofertas.</p>
          <Link href="/obras" className="boton-primario mt-4 w-full sm:w-auto">
            Ver las obras
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {filas.map(({ ultima: o, mejorPropia, cantidad }) => {
            const gano = o.esLaMasAlta && o.estado === "valida";
            // Ninguna oferta propia sigue válida en esta obra.
            const anulada = mejorPropia === 0;
            return (
              <li key={o.numero} className="rounded-2xl border border-linea bg-white p-4">
                <p className="font-bold text-gris">Obra N° {o.numero}</p>
                <p className="text-xl font-extrabold text-tinta">
                  {tituloObra(o.titulo)} <span className="font-normal text-texto">de {o.artistaNombre}</span>
                </p>
                <p className="mt-1">
                  {!anulada ? (
                    <>
                      Tu mejor oferta: <strong className="text-tinta">{pesos(mejorPropia)}</strong>
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
                  <p className="mt-3 rounded-xl bg-linea px-3 py-2 text-tinta">
                    La obra ya no está en la subasta. Por consultas, comunicate con la Dirección de Cementerios.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {gano ? (
                      <span className="rounded-full bg-verde-suave px-3 py-1 font-bold text-tinta">
                        {estado.fase === "cerrada" ? "Quedaste con la oferta más alta" : "Tenés la oferta más alta"}
                      </span>
                    ) : anulada ? (
                      <span className="rounded-full bg-linea px-3 py-1 font-bold text-tinta">
                        Oferta anulada{o.ofertaActual != null && ` · oferta actual ${pesos(o.ofertaActual)}`}
                      </span>
                    ) : (
                      <span className="rounded-full bg-ambar-suave px-3 py-1 font-bold text-tinta">
                        Te superaron{o.ofertaActual != null && ` · oferta actual ${pesos(o.ofertaActual)}`}
                      </span>
                    )}
                    <Link href={`/obras/${o.numero}`} className="enlace">
                      {gano || estado.fase !== "abierta" ? "Ver la obra" : anulada ? "Ofertar de nuevo" : "Volver a ofertar"}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-10" aria-labelledby="titulo-datos">
        <TituloSeccion id="titulo-datos">Mis datos</TituloSeccion>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-bold text-tinta">Nombre</dt>
          <dd>{perfil.nombre} {perfil.apellido}</dd>
          <dt className="font-bold text-tinta">DNI</dt>
          <dd>{perfil.dni}</dd>
          <dt className="font-bold text-tinta">Correo</dt>
          <dd className="break-all">{perfil.email}</dd>
        </dl>
        <p className="mt-2 text-gris">Para corregir el nombre o el DNI, comunicate con la Dirección de Cementerios.</p>
        <div className="mt-5">
          <FormularioDatos telefono={perfil.telefono} avisos={perfil.avisosPorCorreo} />
        </div>
      </section>

      <form action={salir} className="mt-10">
        <button type="submit" className="boton-secundario w-full sm:w-auto">
          Cerrar sesión
        </button>
      </form>
    </>
  );
}
