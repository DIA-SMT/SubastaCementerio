import ExcelJS from "exceljs";
import { numeroConPuntos, tituloObra } from "@/lib/formato";
import { fechaHoraTexto, horaTucumanParaExcel, notaBloqueados, notaNoPublicadas, totalesListado } from "./comun";
import type { FilaListado, MetaListado } from "./tipos";

// Planilla del listado final para el martillero (una hoja, "Listado final").

const AZUL = "FF126FF5";
const BLANCO = "FFFFFFFF";
const TINTA = "FF10233D";
const TEXTO = "FF33414F";
// El gris solo va sobre blanco puro (sobre FONDO no llega al contraste AA).
const GRIS = "FF6B7885";
const LINEA = "FFE3E8EF";
const AMBAR_SUAVE = "FFFDEFD8";
const AMBAR = "FFF59E0B";
const VERDE_SUAVE = "FFDDF5ED";
const VERDE = "FF10B981";
const ROJO_SUAVE = "FFFDE9E9";
const ROJO = "FFEF4444";
const FONDO = "FFF6F9FF";

const MONEDA = "$ #,##0";
const FECHA_HORA = "dd/mm/yyyy hh:mm";

const COLUMNAS: { titulo: string; ancho: number }[] = [
  { titulo: "N°", ancho: 6 },
  { titulo: "Título", ancho: 30 },
  { titulo: "Artista", ancho: 26 },
  { titulo: "Precio base", ancho: 15 },
  { titulo: "Precio de salida (referencia)", ancho: 15 },
  { titulo: "Alias", ancho: 13 },
  { titulo: "Nombre", ancho: 18 },
  { titulo: "Apellido", ancho: 18 },
  { titulo: "DNI", ancho: 12 },
  { titulo: "Teléfono", ancho: 16 },
  { titulo: "Correo", ancho: 32 },
  { titulo: "Fecha y hora de la oferta", ancho: 18 },
  { titulo: "Ofertas válidas", ancho: 10 },
];

export async function generarPlanilla(filas: FilaListado[], meta: MetaListado): Promise<Buffer> {
  const totales = totalesListado(filas);
  const libro = new ExcelJS.Workbook();
  libro.creator = "Municipalidad de San Miguel de Tucumán · Dirección de Cementerios";
  libro.title = "Listado final · Subasta presencial";
  libro.created = meta.generado;

  // Encabezado del documento: una línea por fila, en la columna A.
  const notas: { texto: string; estilo?: "titulo" | "estado" | "alerta" | "aviso" | "gris" }[] = [
    { texto: "Listado final para la subasta presencial · Subasta solidaria del Cementerio del Oeste", estilo: "titulo" },
    { texto: "Municipalidad de San Miguel de Tucumán · Dirección de Cementerios" },
    { texto: `Generado el ${fechaHoraTexto(meta.generado)} (hora de Tucumán)`, estilo: "gris" },
    {
      texto: meta.preliminar
        ? "Estado: PRELIMINAR. La etapa virtual todavía no cerró; los precios base pueden cambiar."
        : `Estado: FINAL. La etapa virtual cerró el ${fechaHoraTexto(meta.cierre)} (hora de Tucumán).`,
      estilo: "estado",
    },
    {
      texto: `Obras en el listado: ${totales.obras} · Con ofertas: ${totales.obrasConOfertas} · Monto acumulado: $ ${numeroConPuntos(totales.montoAcumulado)}`,
    },
    {
      texto: "Contiene DNI y datos de contacto: compartilo solo con el martillero (Ley 25.326).",
      estilo: "aviso",
    },
  ];
  const bloqueados = notaBloqueados(filas);
  if (bloqueados) notas.push({ texto: bloqueados, estilo: "alerta" });
  const noPublicadas = notaNoPublicadas(meta.noPublicadas);
  if (noPublicadas) {
    // Si alguna tiene ofertas, el aviso va en negrita: esas ofertas no le llegan al martillero.
    const conOfertas = meta.noPublicadas.some((o) => o.cantidadOfertas > 0);
    notas.push({ texto: noPublicadas, estilo: conOfertas ? "aviso" : "gris" });
  }
  if (meta.modoEjemplo) {
    notas.push({ texto: "Datos de ejemplo: las obras, artistas y ofertas no son reales.", estilo: "aviso" });
  }

  const filaEncabezado = notas.length + 2;
  const hoja = libro.addWorksheet("Listado final", {
    views: [{ state: "frozen", ySplit: filaEncabezado, topLeftCell: `A${filaEncabezado + 1}` }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${filaEncabezado}:${filaEncabezado}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: "&LListado final · Subasta presencial&RPágina &P de &N" },
  });

  COLUMNAS.forEach((c, i) => {
    hoja.getColumn(i + 1).width = c.ancho;
  });

  notas.forEach((nota, i) => {
    const celda = hoja.getCell(i + 1, 1);
    celda.value = nota.texto;
    switch (nota.estilo) {
      case "titulo":
        celda.font = { bold: true, size: 15, color: { argb: TINTA } };
        hoja.getRow(i + 1).height = 22;
        break;
      case "estado": {
        const fila = hoja.getRow(i + 1);
        fila.height = 20;
        for (let col = 1; col <= COLUMNAS.length; col++) {
          fila.getCell(col).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: meta.preliminar ? AMBAR_SUAVE : VERDE_SUAVE },
          };
        }
        fila.getCell(1).border = { left: { style: "thick", color: { argb: meta.preliminar ? AMBAR : VERDE } } };
        celda.font = { bold: true, size: 12, color: { argb: TINTA } };
        break;
      }
      case "alerta": {
        const fila = hoja.getRow(i + 1);
        fila.height = 20;
        for (let col = 1; col <= COLUMNAS.length; col++) {
          fila.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO_SUAVE } };
        }
        fila.getCell(1).border = { left: { style: "thick", color: { argb: ROJO } } };
        celda.font = { bold: true, color: { argb: TINTA } };
        break;
      }
      case "aviso":
        celda.font = { bold: true, color: { argb: TINTA } };
        break;
      case "gris":
        celda.font = { color: { argb: GRIS } };
        break;
      default:
        celda.font = { color: { argb: TINTA } };
    }
  });

  // Tabla.
  const encabezado = hoja.getRow(filaEncabezado);
  encabezado.values = COLUMNAS.map((c) => c.titulo);
  encabezado.height = 32;
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle", wrapText: true };
  });
  for (const col of [1, 4, 5, 13]) {
    encabezado.getCell(col).alignment = { vertical: "middle", horizontal: "right", wrapText: true };
  }

  filas.forEach((f, i) => {
    const fila = hoja.getRow(filaEncabezado + 1 + i);
    fila.values = [
      f.numero,
      tituloObra(f.titulo),
      f.artista,
      f.precioBase ?? "Sin ofertas",
      f.precioSalida,
      f.oferente ? `Oferente ${f.oferente.alias}${f.oferente.bloqueado ? " · BLOQUEADO" : ""}` : "",
      f.oferente?.nombre ?? "",
      f.oferente?.apellido ?? "",
      f.oferente?.dni ?? "",
      f.oferente?.telefono ?? "",
      f.oferente?.email ?? "",
      f.ofertaAt ? horaTucumanParaExcel(f.ofertaAt) : "",
      f.cantidadOfertas,
    ];
    fila.getCell(4).numFmt = MONEDA;
    fila.getCell(5).numFmt = MONEDA;
    fila.getCell(12).numFmt = FECHA_HORA;
    // DNI y teléfono como texto: que Excel no los convierta en números.
    fila.getCell(9).numFmt = "@";
    fila.getCell(10).numFmt = "@";
    fila.getCell(4).alignment = { horizontal: "right", vertical: "top" };
    fila.getCell(4).font = f.precioBase == null ? { italic: true, color: { argb: TEXTO } } : { bold: true };
    if (!f.titulo?.trim()) fila.getCell(2).font = { italic: true };
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      if (col > COLUMNAS.length) return;
      celda.border = { bottom: { style: "thin", color: { argb: LINEA } } };
      if (i % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FONDO } };
      if (!celda.alignment) celda.alignment = { vertical: "top" };
    });
    // La mayor oferta es de una persona bloqueada: marca en el alias (el encabezado lo explica).
    if (f.oferente?.bloqueado) {
      fila.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO_SUAVE } };
      fila.getCell(6).font = { bold: true, color: { argb: TINTA } };
    }
  });

  const ultimaFila = filaEncabezado + Math.max(filas.length, 0);
  hoja.autoFilter = {
    from: { row: filaEncabezado, column: 1 },
    to: { row: ultimaFila, column: COLUMNAS.length },
  };

  // Totales debajo de la tabla (fuera del autofiltro).
  const filaTotal = ultimaFila + 2;
  const total = hoja.getRow(filaTotal);
  total.getCell(2).value = "Monto acumulado (suma de los precios base)";
  total.getCell(4).value = totales.montoAcumulado;
  total.getCell(4).numFmt = MONEDA;
  total.font = { bold: true, color: { argb: TINTA } };
  const conOfertas = hoja.getRow(filaTotal + 1);
  conOfertas.getCell(2).value = "Obras con ofertas";
  conOfertas.getCell(4).value = totales.obrasConOfertas;
  conOfertas.getCell(4).numFmt = "0";
  conOfertas.font = { bold: true, color: { argb: TINTA } };

  const datos = await libro.xlsx.writeBuffer();
  return Buffer.from(datos as ArrayBuffer);
}
