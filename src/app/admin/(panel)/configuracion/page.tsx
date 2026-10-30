import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Esqueleto, Etiqueta, Tarjeta, TituloPanel } from "@/components/admin/Panel";
import { Plazo } from "@/components/Plazo";
import { requerirAdmin } from "@/lib/admin/sesion";
import { obtenerConfiguracion } from "@/lib/datos/admin/configuracion";
import type { Fase } from "@/lib/datos/tipos";
import { aInputLocal } from "@/lib/fechas";
import { fechaHoraLarga, numeroConPuntos, pesos } from "@/lib/formato";
import { FormularioConfiguracion } from "./FormularioConfiguracion";

export const metadata: Metadata = { title: "Configuración" };

const FASES: Record<Fase, { tono: "verde" | "ambar" | "gris" | "azul"; texto: string }> = {
  por_confirmar: { tono: "ambar", texto: "Fechas a confirmar" },
  antes: { tono: "azul", texto: "Todavía no empezó" },
  abierta: { tono: "verde", texto: "Abierta: acepta ofertas" },
  cerrada: { tono: "gris", texto: "Etapa virtual cerrada" },
};

export default function Pagina() {
  return (
    <div className="space-y-6">
      <TituloPanel
        titulo="Configuración"
        bajada="Fechas de la etapa virtual y de la subasta presencial, incremento mínimo y precio de salida."
      />
      <Suspense fallback={<Esqueleto alto="h-96" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const admin = await requerirAdmin();
  const config = await obtenerConfiguracion(admin);
  const fase = FASES[config.fase];

  return (
    // En la computadora, el formulario a la izquierda y el estado y las advertencias a la derecha;
    // en pantallas chicas, las advertencias van primero (conviene leerlas antes de cambiar algo).
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <aside className="space-y-6 xl:col-start-2 xl:row-start-1">
        <Tarjeta titulo="Estado de la subasta">
          <div className="space-y-3">
            <Etiqueta tono={fase.tono}>{fase.texto}</Etiqueta>
            <Plazo estado={config} />
            {config.fase === "por_confirmar" && (
              <p>
                El sitio muestra «Fechas a confirmar» y no acepta ofertas. Para habilitarlas, marcá «Las fechas están
                confirmadas» y guardá.
              </p>
            )}
            <p className="text-base text-gris">
              Hora del servidor al cargar esta página: {fechaHoraLarga(config.ahora)} (hora de Tucumán).
            </p>
            {config.ultimoCambio && (
              <p className="text-base text-gris">
                Último cambio: {fechaHoraLarga(config.ultimoCambio.at)}
                {config.ultimoCambio.nombre
                  ? `, por ${config.ultimoCambio.nombre}`
                  : config.ultimoCambio.porSistema
                    ? ", por el sistema (carga de datos)"
                    : ""}
                .
              </p>
            )}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Antes de cambiar algo">
          <ul className="list-disc space-y-2 pl-6 marker:text-azul">
            <li>
              El cierre lo controla el servidor: a la hora indicada la base deja de aceptar ofertas, aunque alguien
              tenga la página abierta o el reloj de su teléfono esté atrasado.
            </li>
            <li>Las fechas y horas se cargan en hora de Tucumán.</li>
            <li>
              Con la extensión del cierre activa, una obra que recibe una oferta en los últimos minutos sigue abierta
              después de la hora de cierre general. La etapa cierra cuando cierra la última obra.
            </li>
            <li>
              Con la etapa virtual abierta, adelantar el cierre o dejar de aceptar ofertas pide una confirmación
              extra.
            </li>
            <li>
              Con la etapa ya cerrada también la piden reabrirla, cambiar la hora de cierre o desmarcar «Las fechas
              están confirmadas»: el listado FINAL que ya hayas descargado deja de coincidir con el sitio.
            </li>
            <li>
              Todos los cambios quedan registrados en la{" "}
              <Link href="/admin/auditoria" className="enlace">
                auditoría
              </Link>
              , con quién los hizo y los valores anteriores.
            </li>
          </ul>
        </Tarjeta>
      </aside>

      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <FormularioConfiguracion
          inicial={{
            inicio: aInputLocal(config.inicio),
            cierre: aInputLocal(config.cierre),
            fechas_confirmadas: config.fechasConfirmadas ? "si" : "no",
            fecha_presencial: config.fechaPresencial ?? "",
            detalle_presencial: config.detallePresencial ?? "",
            incremento_minimo: numeroConPuntos(config.incrementoMinimo),
            precio_salida: numeroConPuntos(config.precioSalida),
            modo_ejemplo: config.modoEjemplo ? "si" : "no",
            extension_activa: config.extensionActiva ? "si" : "no",
            extension_minutos: String(config.extensionMinutos),
          }}
          actuales={{
            inicio: fechaHoraLarga(config.inicio),
            cierre: fechaHoraLarga(config.cierre),
            incremento: pesos(config.incrementoMinimo),
            precioSalida: pesos(config.precioSalida),
            obrasConPrecioPropio: config.obrasConPrecioPropio,
            extensionMinutos: `${config.extensionMinutos} ${config.extensionMinutos === 1 ? "minuto" : "minutos"}${
              config.extensionActiva ? ", activa" : ", apagada"
            }`,
          }}
        />
      </div>
    </div>
  );
}
