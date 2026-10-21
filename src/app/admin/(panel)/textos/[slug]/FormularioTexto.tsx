"use client";

import { useActionState, useDeferredValue, useEffect, useState } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { Markdown } from "@/components/Markdown";
import { estadoInicial } from "@/lib/admin/acciones";
import { numeroConPuntos } from "@/lib/formato";
import { guardarTexto } from "./acciones";
import { LARGO_MAXIMO_CONTENIDO, LARGO_MAXIMO_TITULO, normalizarContenido, normalizarTitulo } from "./reglas";

export type TextoGuardado = {
  titulo: string;
  contenido: string;
  provisorio: boolean;
  version: number;
  /** Hora del último guardado (ISO). Junto con la versión identifica qué texto se editó. */
  marca: string;
};

type Marca = { version: string; marca: string };

const FORMATOS: { codigo: string; resultado: string }[] = [
  { codigo: "## Título", resultado: "Título de sección" },
  { codigo: "### Subtítulo", resultado: "Subtítulo" },
  { codigo: "- elemento de lista", resultado: "Lista con viñetas" },
  { codigo: "1. elemento numerado", resultado: "Lista numerada" },
  { codigo: "**negrita**", resultado: "Texto en negrita" },
  { codigo: "[texto](https://...)", resultado: "Enlace (también a una ruta del sitio, como /obras)" },
  { codigo: "> recuadro destacado", resultado: "Recuadro destacado" },
];

function describir(id: string, conAyuda: boolean, error?: string) {
  const ids = [conAyuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return { "aria-describedby": ids || undefined, "aria-invalid": error ? true : undefined };
}

export function FormularioTexto({
  slug,
  guardado,
  esPortada,
  esBases,
  requiereAprobacion,
}: {
  slug: string;
  guardado: TextoGuardado;
  esPortada: boolean;
  esBases: boolean;
  requiereAprobacion: boolean;
}) {
  const [estado, enviar] = useActionState(guardarTexto, estadoInicial);
  const [titulo, setTitulo] = useState(guardado.titulo);
  const [contenido, setContenido] = useState(guardado.contenido);
  const [provisorio, setProvisorio] = useState(guardado.provisorio);
  // Guardado sobre el que se está editando: se manda con el formulario para que el servidor
  // detecte si otra persona guardó antes. No sigue a `guardado` automáticamente porque la
  // pantalla puede recibir datos nuevos con cambios sin guardar (por ejemplo, al volver a esta
  // página: Next.js conserva lo escrito) y entonces hay que avisar el conflicto, no pisarlo.
  const [base, setBase] = useState<Marca>({ version: String(guardado.version), marca: guardado.marca });
  const [guardadoVisto, setGuardadoVisto] = useState(guardado);
  const [estadoVisto, setEstadoVisto] = useState(estado);
  // La vista previa puede ir un paso atrás mientras se escribe rápido en textos largos.
  const vistaPrevia = useDeferredValue(contenido);
  const e = estado.errores ?? {};

  const mismoTextoQue = (t: TextoGuardado) =>
    normalizarTitulo(titulo) === normalizarTitulo(t.titulo) &&
    normalizarContenido(contenido) === normalizarContenido(t.contenido);

  if (guardado.marca !== guardadoVisto.marca) {
    setGuardadoVisto(guardado);
    // Llegó otra versión guardada. Si no se había tocado nada, se muestra la nueva; si hay
    // cambios sin guardar, se conservan y al guardar se avisa que otra persona guardó antes.
    if (mismoTextoQue(guardadoVisto) && provisorio === guardadoVisto.provisorio) {
      setTitulo(guardado.titulo);
      setContenido(guardado.contenido);
      setProvisorio(guardado.provisorio);
      setBase({ version: String(guardado.version), marca: guardado.marca });
    }
  }
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    // Después de guardar (o de avisar un conflicto) se sigue editando sobre lo que hay en la base.
    const v = estado.valores;
    if (v?.version && v.marca) setBase({ version: v.version, marca: v.marca });
  }

  const cambiaTexto = !mismoTextoQue(guardado);
  const hayCambios = cambiaTexto || provisorio !== guardado.provisorio;

  // Aviso del navegador si se cierra o recarga la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambios]);

  return (
    <form action={enviar} className="space-y-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="version" value={base.version} />
      <input type="hidden" name="marca" value={base.marca} />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-5 rounded-2xl border border-linea bg-white p-5">
          <Campo id="titulo" etiqueta="Título" error={e.titulo}>
            <input
              id="titulo"
              name="titulo"
              type="text"
              required
              maxLength={LARGO_MAXIMO_TITULO}
              autoComplete="off"
              value={titulo}
              onChange={(ev) => setTitulo(ev.target.value)}
              className="campo"
              {...describir("titulo", false, e.titulo)}
            />
          </Campo>

          <Campo
            id="contenido"
            etiqueta="Contenido"
            ayuda={`${numeroConPuntos(contenido.length)} de ${numeroConPuntos(LARGO_MAXIMO_CONTENIDO)} caracteres. Dejá una línea en blanco entre párrafos.`}
            error={e.contenido}
          >
            <textarea
              id="contenido"
              name="contenido"
              required
              rows={20}
              maxLength={LARGO_MAXIMO_CONTENIDO}
              value={contenido}
              onChange={(ev) => setContenido(ev.target.value)}
              className="campo min-h-[24rem] py-3 leading-relaxed"
              {...describir("contenido", true, e.contenido)}
            />
          </Campo>

          <details className="rounded-xl bg-fondo px-4 py-3" open>
            <summary className="cursor-pointer font-bold text-tinta">Formato que se puede usar</summary>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-base sm:grid-cols-[auto_1fr]">
              {FORMATOS.map((f) => (
                <div key={f.codigo} className="contents">
                  <dt>
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-tinta">{f.codigo}</code>
                  </dt>
                  <dd className="mb-1 sm:mb-0">{f.resultado}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-base">
              Los títulos, listas y recuadros van en su propio párrafo, separados por una línea en blanco.
            </p>
          </details>

          <div className="flex items-start gap-3">
            <input
              // La clave la vuelve a crear cuando cambia el guardado de base, así refleja el
              // valor nuevo aunque se haya tocado antes.
              key={base.marca}
              id="provisorio"
              name="provisorio"
              type="checkbox"
              value="si"
              // No controlada a propósito: al terminar la acción React reinicia el formulario
              // y una casilla vuelve a su defaultChecked, que así acompaña al estado.
              defaultChecked={provisorio}
              onChange={(ev) => setProvisorio(ev.target.checked)}
              aria-describedby="provisorio-ayuda"
              className="mt-1 h-6 w-6 shrink-0 accent-azul"
            />
            <div>
              <label htmlFor="provisorio" className="font-bold text-tinta">
                Texto en revisión (uso interno)
              </label>
              <p id="provisorio-ayuda" className="mt-0.5 text-base text-gris">
                Esta marca solo se ve en el panel. {requiereAprobacion
                  ? "Desmarcala cuando el texto esté aprobado."
                  : "Desmarcala cuando el texto sea definitivo."}
              </p>
            </div>
          </div>
        </div>

        <section
          aria-labelledby="vista-previa"
          className="rounded-2xl border border-linea bg-white p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
        >
          <h2 id="vista-previa" className="text-xl">
            Vista previa
          </h2>
          <p className="text-base text-gris">
            Así se va a ver en el sitio. Se actualiza mientras escribís. Los enlaces no se abren desde acá.
          </p>
          <div
            className="mt-4 rounded-xl border-2 border-dashed border-linea p-4 sm:p-6"
            // Un clic en un enlace de la vista previa no tiene que sacar a la persona del editor.
            onClickCapture={(ev) => {
              if ((ev.target as Element).closest("a")) ev.preventDefault();
            }}
          >
            <p className="flex items-stretch gap-3 text-3xl font-extrabold leading-tight text-tinta">
              {!esPortada && (
                <span aria-hidden className="w-1.5 shrink-0 rounded-full bg-linear-to-b from-azul to-celeste" />
              )}
              <span>{normalizarTitulo(titulo) || "Sin título"}</span>
            </p>
            <div className="mt-6">
              {vistaPrevia.trim() ? (
                <Markdown texto={vistaPrevia} />
              ) : (
                <p className="text-gris">Todavía no hay contenido.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <MensajeAccion estado={estado} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <BotonEnviar className="w-full sm:w-auto">Guardar texto</BotonEnviar>
        {hayCambios ? (
          <p className="font-bold text-tinta">
            <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-ambar" />
            Tenés cambios sin guardar.
            {esBases && cambiaTexto && ` Al guardar, las bases pasan a la versión ${guardado.version + 1}.`}
          </p>
        ) : (
          <p className="text-gris">Sin cambios desde la última vez que se guardó.</p>
        )}
      </div>
    </form>
  );
}
