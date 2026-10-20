"use server";

import { refresh } from "next/cache";
import { mensajeDeErrorDb, type EstadoAccion } from "@/lib/admin/acciones";
import { requerirAdmin } from "@/lib/admin/sesion";
import {
  actualizarConfiguracion,
  type MotivoConfirmacion,
  type OfertasPosteriores,
} from "@/lib/datos/admin/configuracion";
import { aInputDia, desdeInputLocal, diaDesdeInput } from "@/lib/fechas";
import { fechaHoraLarga, fechaLarga, pesos } from "@/lib/formato";

const MONTO_MAXIMO = 1_000_000_000;
const LARGO_DETALLE = 300;

/** Pesos enteros: "5000", "5.000", "$ 5.000". Rechaza centavos ("5000,50") y separadores mal puestos. */
function validarMonto(texto: string, nombre: string): { monto: number } | { error: string } {
  if (!texto) return { error: `Completá ${nombre}.` };
  if (!/^\$?\s*(\d{1,3}([.\s]\d{3})+|\d+)$/.test(texto)) {
    return { error: "Escribí un monto entero en pesos, sin centavos. Por ejemplo: 5.000." };
  }
  const digitos = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digitos.length > 10) return { error: `El monto no puede superar ${pesos(MONTO_MAXIMO)}.` };
  const monto = Number(digitos);
  if (monto <= 0) return { error: "El monto tiene que ser mayor que cero." };
  if (monto > MONTO_MAXIMO) return { error: `El monto no puede superar ${pesos(MONTO_MAXIMO)}.` };
  return { monto };
}

/** " Hay 3 ofertas válidas registradas en 2 obras después de…", o vacío si no hay ninguna. */
function textoPosteriores(p: OfertasPosteriores, despuesDe: string): string {
  if (p.cantidad === 0) return "";
  const ofertas = p.cantidad === 1 ? "1 oferta válida registrada" : `${p.cantidad} ofertas válidas registradas`;
  const obras = p.obras === 1 ? "1 obra" : `${p.obras} obras`;
  const ultima = p.ultima ? ` (la última, el ${fechaHoraLarga(p.ultima)})` : "";
  return (
    ` Hay ${ofertas} en ${obras} después ${despuesDe}${ultima}: no se anulan y siguen contando para el ` +
    "precio base del listado final."
  );
}

function textoMotivo(m: MotivoConfirmacion): string {
  switch (m.tipo) {
    case "adelanta_cierre":
      return (
        `Estás adelantando el cierre de la etapa virtual, que está abierta: pasa del ${fechaHoraLarga(m.cierreActual)} ` +
        `al ${fechaHoraLarga(m.nuevoCierre)}.` +
        (m.yaPaso
          ? " Esa hora ya pasó: al guardar, el sitio deja de aceptar ofertas en ese mismo momento." +
            textoPosteriores(m.posteriores, "de esa hora")
          : " Quienes pensaban ofertar más tarde pueden quedar afuera.")
      );
    case "cambia_cierre":
      return (
        `La etapa virtual ya cerró y estás cambiando la hora de cierre: pasa del ${fechaHoraLarga(m.cierreActual)} ` +
        `al ${fechaHoraLarga(m.nuevoCierre)}. Si ya descargaste el listado FINAL, ese archivo dice que la etapa ` +
        `cerró el ${fechaHoraLarga(m.cierreActual)} y no coincide con los que descargues desde ahora.` +
        textoPosteriores(m.posteriores, "del nuevo cierre")
      );
    case "desconfirma_cerrada":
      return (
        "Estás desmarcando «Las fechas están confirmadas» con la etapa virtual cerrada: el sitio va a mostrar " +
        "«Fechas a confirmar», las fichas de las obras dejan de mostrar «Pasa a subasta presencial con base de $ …» " +
        "y el listado final vuelve a descargarse como PRELIMINAR. Las ofertas registradas se conservan."
      );
    case "desconfirma":
      return (
        "Estás desmarcando «Las fechas están confirmadas» con la etapa virtual abierta: el sitio va a mostrar " +
        "«Fechas a confirmar» y deja de aceptar ofertas en ese mismo momento. Las ofertas registradas se conservan."
      );
    case "posterga_inicio":
      return (
        `Estás moviendo el inicio al ${fechaHoraLarga(m.nuevoInicio)} con la etapa virtual abierta: el sitio deja de ` +
        "aceptar ofertas hasta esa fecha. Las ofertas registradas se conservan."
      );
    case "reabre":
      return (
        (m.nuevoInicio
          ? `La etapa virtual ya cerró. Con las nuevas fechas se vuelve a abrir el ${fechaHoraLarga(m.nuevoInicio)} y el ` +
            `sitio acepta ofertas otra vez hasta el ${fechaHoraLarga(m.nuevoCierre)}.`
          : `La etapa virtual ya cerró. Con el nuevo cierre (${fechaHoraLarga(m.nuevoCierre)}) se vuelve a abrir y el ` +
            "sitio acepta ofertas otra vez.") + " Si ya exportaste el listado final, va a dejar de estar actualizado."
      );
  }
}

export async function guardarConfiguracion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await requerirAdmin();

  const texto = (nombre: string) => String(datos.get(nombre) ?? "").trim();
  const casilla = (nombre: string) => (datos.get(nombre) === "si" ? "si" : "no");
  const valores: Record<string, string> = {
    inicio: texto("inicio"),
    cierre: texto("cierre"),
    fechas_confirmadas: casilla("fechas_confirmadas"),
    fecha_presencial: texto("fecha_presencial"),
    detalle_presencial: texto("detalle_presencial").replace(/\s+/g, " "),
    incremento_minimo: texto("incremento_minimo"),
    precio_salida: texto("precio_salida"),
    modo_ejemplo: casilla("modo_ejemplo"),
  };
  const errores: Record<string, string> = {};

  const inicio = desdeInputLocal(valores.inicio);
  if (!valores.inicio) errores.inicio = "Completá la fecha y la hora de inicio.";
  else if (!inicio) errores.inicio = "Revisá la fecha y la hora de inicio.";

  const cierre = desdeInputLocal(valores.cierre);
  if (!valores.cierre) errores.cierre = "Completá la fecha y la hora de cierre.";
  else if (!cierre) errores.cierre = "Revisá la fecha y la hora de cierre.";
  else if (inicio && cierre <= inicio) errores.cierre = "El cierre tiene que ser posterior al inicio.";

  let fechaPresencial: string | null = null;
  if (valores.fecha_presencial) {
    fechaPresencial = diaDesdeInput(valores.fecha_presencial);
    if (!fechaPresencial) {
      errores.fecha_presencial = "Revisá la fecha de la subasta presencial.";
    } else if (cierre && fechaPresencial < aInputDia(cierre)) {
      errores.fecha_presencial = `La subasta presencial no puede ser antes del cierre de la etapa virtual (${fechaLarga(aInputDia(cierre))}).`;
    }
  }

  if (valores.detalle_presencial.length > LARGO_DETALLE) {
    errores.detalle_presencial = `El detalle puede tener hasta ${LARGO_DETALLE} caracteres.`;
  }

  const incremento = validarMonto(valores.incremento_minimo, "el incremento mínimo");
  if ("error" in incremento) errores.incremento_minimo = incremento.error;
  const precio = validarMonto(valores.precio_salida, "el precio de salida");
  if ("error" in precio) errores.precio_salida = precio.error;

  if (Object.keys(errores).length > 0 || !inicio || !cierre || "error" in incremento || "error" in precio) {
    return { error: "Revisá los datos marcados. No guardamos ningún cambio.", errores, valores };
  }

  // La confirmación vale solo para las fechas y los motivos que se mostraron en el aviso:
  // confirmacion_para = "inicio|cierre|confirmadas#motivo1,motivo2".
  const clave = [valores.inicio, valores.cierre, valores.fechas_confirmadas].join("|");
  const [paraFechas, paraMotivos = ""] = String(datos.get("confirmacion_para") ?? "").split("#");
  const confirmados =
    datos.get("confirmar") === "si" && paraFechas === clave ? paraMotivos.split(",").filter(Boolean) : [];

  let resultado;
  try {
    resultado = await actualizarConfiguracion(
      admin,
      {
        inicio,
        cierre,
        fechasConfirmadas: valores.fechas_confirmadas === "si",
        fechaPresencial,
        detallePresencial: valores.detalle_presencial || null,
        incrementoMinimo: incremento.monto,
        precioSalida: precio.monto,
        modoEjemplo: valores.modo_ejemplo === "si",
      },
      confirmados,
    );
  } catch (error) {
    return { error: mensajeDeErrorDb(error), valores };
  }

  if (!resultado.ok) {
    if (resultado.codigo === "requiere_confirmacion") {
      return {
        error: "Este cambio afecta la subasta. Leé el aviso, marcá la confirmación y volvé a guardar.",
        errores: { confirmacion: resultado.motivos.map(textoMotivo).join("\n") },
        valores: { ...valores, confirmacion_para: `${clave}#${resultado.motivos.map((m) => m.tipo).join(",")}` },
      };
    }
    return { error: "Tu usuario no tiene permiso para cambiar la configuración.", valores };
  }

  refresh();
  return {
    ok: true,
    mensaje: resultado.sinCambios
      ? "No había cambios para guardar."
      : "Guardamos la configuración. El cambio quedó registrado en la auditoría.",
  };
}
