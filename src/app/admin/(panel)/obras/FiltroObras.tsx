"use client";

import { Fragment, useState, type ReactNode } from "react";
import { IconoBuscar, IconoObra } from "@/components/Iconos";
import { EstadoVacio, TablaContenedor } from "@/components/admin/Panel";

export type EstadoObra = "publicada" | "no_publicada" | "sin_fotos";

/** Fila ya dibujada en el servidor, con lo necesario para filtrarla. */
export type FilaFiltrable = { id: string; texto: string; estados: EstadoObra[]; fila: ReactNode };

const ESTADOS: { valor: EstadoObra | "todas"; texto: string }[] = [
  { valor: "todas", texto: "Todos los estados" },
  { valor: "publicada", texto: "Publicadas" },
  { valor: "no_publicada", texto: "No publicadas" },
  { valor: "sin_fotos", texto: "Sin fotos" },
];

/** Sin mayúsculas ni tildes: «raíces» encuentra «Raíces» y «raices». */
const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Buscador y filtro de estado del listado de obras. Filtra en el navegador las filas que ya
 * mandó el servidor (son pocas obras): no pide nada nuevo ni cambia la dirección.
 */
export function FiltroObras({ filas, encabezado }: { filas: FilaFiltrable[]; encabezado: ReactNode }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoObra | "todas">("todas");
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const visibles = filas.filter(
    (f) =>
      (estado === "todas" || f.estados.includes(estado)) &&
      palabras.every((p) => normalizar(f.texto).includes(p)),
  );
  const filtrando = palabras.length > 0 || estado !== "todas";

  return (
    <>
      <div role="search" aria-label="Buscar obras" className="tarjeta-panel grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_15rem_auto] md:items-end md:p-5">
        <div>
          <label htmlFor="buscar-obra" className="etiqueta">
            Buscar
          </label>
          <div className="relative">
            <IconoBuscar aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[1.2rem] text-gris" />
            <input
              id="buscar-obra"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Título, artista o número"
              autoComplete="off"
              className="campo pl-11"
            />
          </div>
        </div>
        <div>
          <label htmlFor="filtro-estado-obra" className="etiqueta">
            Estado
          </label>
          <select
            id="filtro-estado-obra"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoObra | "todas")}
            className="campo"
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.texto}
              </option>
            ))}
          </select>
        </div>
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setEstado("todas");
            }}
            className="boton-secundario"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/* Un solo aviso que cambia de texto: los lectores de pantalla anuncian cada resultado. */}
      <p role="status" className="text-[0.94rem] text-gris">
        {filtrando
          ? `${visibles.length} de ${filas.length} ${filas.length === 1 ? "obra" : "obras"}.`
          : `${filas.length} ${filas.length === 1 ? "obra" : "obras"}, por número.`}
      </p>

      {visibles.length > 0 ? (
        <TablaContenedor etiqueta="Listado de obras" apilable>
          {encabezado}
          <tbody>
            {visibles.map((f) => (
              <Fragment key={f.id}>{f.fila}</Fragment>
            ))}
          </tbody>
        </TablaContenedor>
      ) : (
        <EstadoVacio titulo="Ninguna obra coincide con la búsqueda." icono={IconoObra}>
          Revisá lo que escribiste o elegí otro estado.
        </EstadoVacio>
      )}
    </>
  );
}
