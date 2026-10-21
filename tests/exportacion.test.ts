import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import ExcelJS from "exceljs";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoSubasta } from "@/lib/datos/tipos";
import { pesos } from "@/lib/formato";
import {
  adjunto,
  descargaRechazada,
  diaIso,
  esDireccionLocal,
  fechaHoraTexto,
  filasConOferenteBloqueado,
  horaTucumanParaExcel,
  mesYAnio,
  nombreArchivoListado,
  notaBloqueados,
  notaNoPublicadas,
  pedidoDelMismoSitio,
  renglonesDeCorreo,
  resumenOfertas,
  totalesListado,
  urlCorta,
  urlDeObra,
  volverAlListado,
} from "@/lib/exportacion/comun";
import { generarPdfCarteles } from "@/lib/exportacion/carteles-pdf";
import { generarPdfListado } from "@/lib/exportacion/listado-pdf";
import { cargarLogos, proporcionPng } from "@/lib/exportacion/marca";
import { generarPlanilla } from "@/lib/exportacion/planilla";
import { qrPng, qrSvg, qrTrazado } from "@/lib/exportacion/qr";
import type { FilaListado, MetaListado, ObraCartel, ObraNoPublicada } from "@/lib/exportacion/tipos";
import { SQL_LISTADO, SQL_REGISTRAR_EXPORTACION, armarListado, type FilaVista } from "@/lib/exportacion/vista";
import { ADMIN, OBRA, baseDePrueba, como } from "./db/ayuda";

// Generadores de la exportación con datos falsos. Para revisar los PDF a ojo:
// EXPORTACION_PDF_DIR=<carpeta> npx vitest run tests/exportacion.test.ts

// Rutas de descarga (POST /admin/exportar/planilla y /pdf): la sesión y la base se reemplazan
// para probar solo el control del pedido. La auditoría con la base real está en tests/db/driver.test.ts.
const rutas = vi.hoisted(() => ({
  admin: null as { id: string; email: string; nombre: string } | null,
  adminActual: vi.fn(),
  obtenerListadoFinal: vi.fn(),
  registrarExportacion: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/sesion", () => ({ adminActual: rutas.adminActual }));
vi.mock("@/lib/datos/admin/exportacion", () => ({
  obtenerListadoFinal: rutas.obtenerListadoFinal,
  registrarExportacion: rutas.registrarExportacion,
}));

const ARTISTAS = [
  "Inés Ñañez",
  "José María Peña",
  "Lucía Gómez Ibáñez",
  "Martín Agüero",
  "Sofía Muñoz",
  "Ramón Díaz Vélez",
];

const TITULOS: (string | null)[] = [
  "Memoria del río Salí",
  null,
  "El niño y la higuera",
  "Añoranza",
  "Cabeza N° 5 · Ensayo sobre la pérdida y el reencuentro en el Cementerio del Oeste",
  "Ofrenda",
  null,
  "Corazón de caña",
];

/** Obras cuya mayor oferta es de una persona bloqueada en los datos de prueba. */
const BLOQUEADAS = [3, 14];

/** 25 obras: algunas sin título, algunas sin ofertas, un correo larguísimo, dos con la mayor oferta bloqueada. */
function filasDePrueba(cantidad = 25): FilaListado[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const numero = i + 1;
    const sinOfertas = numero % 6 === 0;
    return {
      obraId: `obra-${numero}`,
      numero,
      titulo: TITULOS[i % TITULOS.length],
      artista: ARTISTAS[i % ARTISTAS.length],
      precioSalida: 10000,
      precioBase: sinOfertas ? null : 15000 + numero * 12500,
      // 23:30 en UTC = 20:30 en Tucumán.
      ofertaAt: sinOfertas ? null : new Date(Date.UTC(2026, 10, 1 + (i % 7), 23, 30)),
      oferente: sinOfertas
        ? null
        : {
            alias: 100 + numero,
            nombre: i % 3 === 0 ? "María Belén" : "Ñandú",
            apellido: i % 2 === 0 ? "Muñoz Ibáñez" : "Pérez",
            dni: String(30000000 + numero * 7919),
            telefono: `+54938155${String(numero).padStart(5, "0")}`,
            email:
              numero === 4
                ? "maria.belen.munoz.ibanez.correo.muy.largo@direccion-de-cementerios.smt.gob.ar"
                : `oferente${numero}@ejemplo.com.ar`,
            bloqueado: BLOQUEADAS.includes(numero),
          },
      cantidadOfertas: sinOfertas ? 0 : (numero % 5) + 1,
    };
  });
}

/** Dos obras sin publicar: una con ofertas (quedan afuera del listado) y otra sin ofertas. */
const NO_PUBLICADAS: ObraNoPublicada[] = [
  { obraId: "obra-26", numero: 26, titulo: "Retirada", artista: "Sofía Muñoz", cantidadOfertas: 3, mayorOferta: 20000 },
  { obraId: "obra-27", numero: 27, titulo: null, artista: "Martín Agüero", cantidadOfertas: 0, mayorOferta: null },
];

const META: MetaListado = {
  generado: new Date(Date.UTC(2026, 10, 7, 17, 32)), // 14:32 en Tucumán
  preliminar: true,
  cierre: new Date(Date.UTC(2026, 10, 8, 23, 0)),
  modoEjemplo: false,
  noPublicadas: NO_PUBLICADAS,
};

const CARTELES: ObraCartel[] = [
  { numero: 1, titulo: "Memoria del río Salí", artista: "Inés Ñañez", url: "https://subasta.smt.gob.ar/obras/1" },
  { numero: 2, titulo: null, artista: "José María Peña", url: "https://subasta.smt.gob.ar/obras/2" },
  {
    numero: 25,
    titulo: "Cabeza N° 25 · Ensayo sobre la pérdida y el reencuentro en el Cementerio del Oeste",
    artista: "Lucía Gómez Ibáñez",
    url: "https://subasta.smt.gob.ar/obras/25",
  },
  {
    numero: 13,
    titulo:
      "Retrato de una ciudad que recuerda: la memoria de los que se fueron, de los que quedaron y de los que todavía esperan volver a la plaza del barrio",
    artista: "Colectivo de Artistas Plásticos del Oeste y Taller Municipal de Escultura Ñuñorco",
    url: "http://localhost:3000/obras/13",
  },
];

/** Cantidad de páginas de un PDF (objetos /Type /Page, sin contar /Pages). */
function paginas(pdf: Buffer) {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

const salida = process.env.EXPORTACION_PDF_DIR;
function guardar(nombre: string, datos: Buffer) {
  if (!salida) return;
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, nombre), datos);
}

describe("utilidades de exportación", () => {
  it("expresa las fechas en hora de Tucumán", () => {
    const d = new Date(Date.UTC(2026, 9, 20, 1, 15)); // 19/10 22:15 en Tucumán
    expect(diaIso(d)).toBe("2026-10-19");
    expect(fechaHoraTexto(d)).toBe("19 de octubre de 2026 a las 22:15");
    expect(mesYAnio(d)).toBe("Octubre de 2026");
    expect(horaTucumanParaExcel(d).toISOString()).toBe("2026-10-19T22:15:00.000Z");
  });

  it("arma el nombre del archivo y marca el preliminar", () => {
    const d = new Date(Date.UTC(2026, 9, 20, 1, 15));
    expect(nombreArchivoListado(d, false, "xlsx")).toBe("listado-final-subasta-2026-10-19.xlsx");
    expect(nombreArchivoListado(d, true, "pdf")).toBe("PRELIMINAR-listado-final-subasta-2026-10-19.pdf");
    expect(adjunto("PRELIMINAR-listado-final-subasta-2026-10-19.pdf")).toBe(
      'attachment; filename="PRELIMINAR-listado-final-subasta-2026-10-19.pdf"',
    );
  });

  it("suma el monto acumulado solo con las obras que tienen ofertas", () => {
    const filas = filasDePrueba(12);
    const t = totalesListado(filas);
    expect(t.obras).toBe(12);
    expect(t.obrasConOfertas).toBe(10);
    expect(t.montoAcumulado).toBe(
      filas.reduce((s, f) => s + (f.precioBase ?? 0), 0),
    );
  });

  it("parte los correos largos sin perder caracteres", () => {
    expect(renglonesDeCorreo("ana@ejemplo.com")).toEqual(["ana@ejemplo.com"]);
    const largo = "maria.belen.munoz.ibanez.correo.muy.largo@direccion-de-cementerios.smt.gob.ar";
    const renglones = renglonesDeCorreo(largo);
    expect(renglones.join("")).toBe(largo);
    expect(renglones.every((r) => r.length <= 28)).toBe(true);
    expect(renglonesDeCorreo("x".repeat(40) + "@a.ar").join("")).toBe("x".repeat(40) + "@a.ar");
  });

  it("detecta direcciones locales y acorta la URL del cartel", () => {
    expect(esDireccionLocal("http://localhost:3000")).toBe(true);
    expect(esDireccionLocal("http://127.0.0.1:3000/")).toBe(true);
    expect(esDireccionLocal("http://[::1]:3000")).toBe(true);
    expect(esDireccionLocal("http://subasta.localhost:3000")).toBe(true);
    expect(esDireccionLocal("http://192.168.0.15:3000")).toBe(true);
    expect(esDireccionLocal("http://172.20.1.4")).toBe(true);
    expect(esDireccionLocal("no es una dirección")).toBe(true);
    expect(esDireccionLocal("https://subasta.smt.gob.ar")).toBe(false);
    expect(esDireccionLocal("https://172.217.0.1")).toBe(false);
    expect(esDireccionLocal("https://localhost.smt.gob.ar")).toBe(false);
    expect(urlDeObra("https://subasta.smt.gob.ar/", 7)).toBe("https://subasta.smt.gob.ar/obras/7");
    expect(urlCorta("https://subasta.smt.gob.ar/obras/7")).toBe("subasta.smt.gob.ar/obras/7");
  });
});

describe("avisos del listado", () => {
  it("avisa las obras cuya mayor oferta es de una persona bloqueada", () => {
    const filas = filasDePrueba();
    expect(filasConOferenteBloqueado(filas).map((f) => f.numero)).toEqual(BLOQUEADAS);
    expect(notaBloqueados(filas)).toBe(
      'Atención: en 2 obras (N° 3 y N° 14) la mayor oferta es de una persona bloqueada. Bloquear no anula sus ofertas: revisalas en el panel ("Ofertas de la obra") antes de entregar el listado.',
    );
    expect(notaBloqueados(filasDePrueba(5))).toBe(
      'Atención: en la obra N° 3 la mayor oferta es de una persona bloqueada. Bloquear no anula sus ofertas: revisala en el panel ("Ofertas de la obra") antes de entregar el listado.',
    );
    expect(notaBloqueados(filasDePrueba(2))).toBeNull();
  });

  it("detalla las ofertas de las obras sin publicar, que quedan afuera del listado", () => {
    expect(notaNoPublicadas([])).toBeNull();
    expect(notaNoPublicadas([NO_PUBLICADAS[1]])).toBe("Hay 1 obra sin publicar que no figura en este listado.");
    expect(notaNoPublicadas(NO_PUBLICADAS)).toBe(
      `Hay 2 obras sin publicar que no figuran en este listado. Ofertas que quedan afuera: N° 26 (3 ofertas válidas, la mayor de ${pesos(20000)}).`,
    );
    const dos = [NO_PUBLICADAS[0], { ...NO_PUBLICADAS[0], numero: 30, cantidadOfertas: 1, mayorOferta: 15000 }];
    expect(notaNoPublicadas(dos)).toBe(
      `Hay 2 obras sin publicar que no figuran en este listado. Ofertas que quedan afuera: N° 26 (3 ofertas válidas, la mayor de ${pesos(20000)}) y N° 30 (1 oferta válida de ${pesos(15000)}).`,
    );
    expect(resumenOfertas(NO_PUBLICADAS[1])).toBe("sin ofertas");
  });
});

describe("descargas del listado", () => {
  const encabezados = (valores: Record<string, string>) => new Headers(valores);

  it("solo acepta pedidos que salen del propio sitio", () => {
    const host = { host: "subasta.smt.gob.ar" };
    expect(pedidoDelMismoSitio(encabezados({ ...host, "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(pedidoDelMismoSitio(encabezados({ ...host, "sec-fetch-site": "cross-site" }))).toBe(false);
    // Otro subdominio no es el panel, y un POST no se escribe en la barra de direcciones.
    expect(pedidoDelMismoSitio(encabezados({ ...host, "sec-fetch-site": "same-site" }))).toBe(false);
    expect(pedidoDelMismoSitio(encabezados({ ...host, "sec-fetch-site": "none" }))).toBe(false);
    // Lo que vale es Sec-Fetch-Site (lo pone el navegador): un Origin igual no alcanza.
    expect(
      pedidoDelMismoSitio(
        encabezados({ ...host, origin: "https://subasta.smt.gob.ar", "sec-fetch-site": "cross-site" }),
      ),
    ).toBe(false);
    // Navegadores sin Fetch Metadata: Origin contra Host (o X-Forwarded-Host detrás de un proxy).
    expect(pedidoDelMismoSitio(encabezados({ ...host, origin: "https://subasta.smt.gob.ar" }))).toBe(true);
    expect(
      pedidoDelMismoSitio(
        encabezados({
          host: "interno:3000",
          "x-forwarded-host": "subasta.smt.gob.ar",
          origin: "https://subasta.smt.gob.ar",
        }),
      ),
    ).toBe(true);
    expect(pedidoDelMismoSitio(encabezados({ ...host, origin: "https://otro-sitio.example" }))).toBe(false);
    expect(pedidoDelMismoSitio(encabezados({ ...host, origin: "https://subasta.smt.gob.ar.otro.example" }))).toBe(false);
    expect(pedidoDelMismoSitio(encabezados({ ...host, origin: "null" }))).toBe(false);
    // Sin ninguno de los dos: la cookie SameSite=Lax no viaja en un POST de otro sitio.
    expect(pedidoDelMismoSitio(encabezados(host))).toBe(true);
  });

  it("un enlace a la descarga lleva a la pantalla del listado y un pedido de otro sitio se rechaza", async () => {
    const r = volverAlListado(new Request("https://subasta.smt.gob.ar/admin/exportar/pdf"));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("https://subasta.smt.gob.ar/admin/exportar");
    const rechazo = descargaRechazada();
    expect(rechazo.status).toBe(403);
    expect(await rechazo.text()).toMatch(/no salió del panel/);
  });

  it("la pantalla pide las descargas con formularios POST, no con enlaces", () => {
    const pagina = fs.readFileSync(path.join(process.cwd(), "src/app/admin/(panel)/exportar/page.tsx"), "utf8");
    expect(pagina).toMatch(/<form method="post" action="\/admin\/exportar\/planilla">/);
    expect(pagina).toMatch(/<form method="post" action="\/admin\/exportar\/pdf">/);
    expect(pagina).not.toMatch(/href="\/admin\/exportar\/(planilla|pdf)"/);
  });

  describe.each([
    { ruta: "planilla", formato: "xlsx", tipo: /spreadsheetml/ },
    { ruta: "pdf", formato: "pdf", tipo: /^application\/pdf$/ },
  ] as const)("ruta /admin/exportar/$ruta", ({ ruta, formato, tipo }) => {
    const EQUIPO = { id: ADMIN, email: "admin@ejemplo.test", nombre: "Equipo de ejemplo" };
    const cargar = () =>
      ruta === "planilla"
        ? import("@/app/admin/(panel)/exportar/planilla/route")
        : import("@/app/admin/(panel)/exportar/pdf/route");
    const pedido = (metodo: "GET" | "POST", encabezados: Record<string, string> = {}) =>
      new Request(`https://subasta.smt.gob.ar/admin/exportar/${ruta}`, {
        method: metodo,
        headers: { host: "subasta.smt.gob.ar", ...encabezados },
      });

    beforeEach(() => {
      rutas.admin = EQUIPO;
      rutas.adminActual.mockReset().mockImplementation(async () => rutas.admin);
      rutas.obtenerListadoFinal.mockReset().mockResolvedValue({ filas: filasDePrueba(3), meta: META });
      rutas.registrarExportacion.mockReset().mockResolvedValue(undefined);
    });

    it("el formulario del panel descarga el archivo y deja la exportación en la auditoría", async () => {
      const { POST } = await cargar();
      const r = await POST(pedido("POST", { "sec-fetch-site": "same-origin", origin: "https://subasta.smt.gob.ar" }));
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toMatch(tipo);
      expect(r.headers.get("content-disposition")).toBe(adjunto(nombreArchivoListado(META.generado, true, formato)));
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(1000);
      expect(rutas.registrarExportacion).toHaveBeenCalledExactlyOnceWith(EQUIPO, { formato, preliminar: true, filas: 3 });
    });

    it("un pedido de otro sitio no descarga, no lee la sesión y no registra nada", async () => {
      const { POST } = await cargar();
      const deOtroSitio: Record<string, string>[] = [
        { "sec-fetch-site": "cross-site", origin: "https://otro-sitio.example" },
        { "sec-fetch-site": "same-site", origin: "https://otro.smt.gob.ar" },
        { origin: "https://otro-sitio.example" },
      ];
      for (const encabezados of deOtroSitio) {
        expect((await POST(pedido("POST", encabezados))).status).toBe(403);
      }
      expect(rutas.adminActual).not.toHaveBeenCalled();
      expect(rutas.obtenerListadoFinal).not.toHaveBeenCalled();
      expect(rutas.registrarExportacion).not.toHaveBeenCalled();
    });

    it("un GET (enlace o marcador) lleva a la pantalla del listado sin descargar", async () => {
      const { GET } = await cargar();
      const r = GET(pedido("GET", { "sec-fetch-site": "cross-site" }));
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe("https://subasta.smt.gob.ar/admin/exportar");
      expect(rutas.obtenerListadoFinal).not.toHaveBeenCalled();
      expect(rutas.registrarExportacion).not.toHaveBeenCalled();
    });

    it("sin sesión del equipo lleva al ingreso del panel", async () => {
      rutas.admin = null;
      const { POST } = await cargar();
      const r = await POST(pedido("POST", { "sec-fetch-site": "same-origin" }));
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe("https://subasta.smt.gob.ar/admin/ingresar");
      expect(rutas.obtenerListadoFinal).not.toHaveBeenCalled();
      expect(rutas.registrarExportacion).not.toHaveBeenCalled();
    });
  });
});

describe("códigos QR", () => {
  it("genera SVG, PNG y trazado vectorial", async () => {
    const url = "https://subasta.smt.gob.ar/obras/7";
    const svg = await qrSvg(url);
    expect(svg.startsWith("<svg")).toBe(true);
    const png = await qrPng(url, 1200);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    const trazado = qrTrazado(url);
    expect(trazado.lado).toBe(trazado.modulos + 8);
    expect(trazado.d.length).toBeGreaterThan(100);
  });
});

describe("planilla", () => {
  it("se puede volver a leer y tiene una fila por obra", async () => {
    const filas = filasDePrueba();
    const buffer = await generarPlanilla(filas, META);
    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK");

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet("Listado final");
    expect(hoja).toBeDefined();
    if (!hoja) return;

    // Encabezado del documento.
    const textos: string[] = [];
    hoja.eachRow((fila) => textos.push(String(fila.getCell(1).value ?? "")));
    expect(textos[1]).toBe("Municipalidad de San Miguel de Tucumán · Dirección de Cementerios");
    expect(textos.some((t) => t.startsWith("Estado: PRELIMINAR"))).toBe(true);
    // Avisos: obras con la mayor oferta de una persona bloqueada y obras sin publicar con ofertas.
    const filaAlerta = textos.indexOf(notaBloqueados(filas)!) + 1;
    expect(filaAlerta).toBeGreaterThan(0);
    expect((hoja.getRow(filaAlerta).getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFDE9E9");
    expect(hoja.getRow(filaAlerta).getCell(1).font?.bold).toBe(true);
    const filaNoPublicadas = textos.indexOf(notaNoPublicadas(NO_PUBLICADAS)!) + 1;
    expect(filaNoPublicadas).toBeGreaterThan(0);
    expect(hoja.getRow(filaNoPublicadas).getCell(1).font?.bold).toBe(true);

    // Fila de encabezado de la tabla: inmovilizada y con autofiltro.
    const vista = hoja.views[0] as { state?: string; ySplit?: number };
    expect(vista.state).toBe("frozen");
    const filaEnc = vista.ySplit ?? 0;
    const encabezado = hoja.getRow(filaEnc);
    expect(encabezado.getCell(1).value).toBe("N°");
    expect(encabezado.getCell(4).value).toBe("Precio base");
    expect(encabezado.getCell(1).font?.bold).toBe(true);
    expect((encabezado.getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF126FF5");
    expect(hoja.autoFilter).toBeDefined();

    // Datos.
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const fila = hoja.getRow(filaEnc + 1 + i);
      expect(fila.getCell(1).value).toBe(f.numero);
      expect(fila.getCell(2).value).toBe(f.titulo ?? "Sin título");
      expect(fila.getCell(3).value).toBe(f.artista);
      expect(fila.getCell(4).value).toBe(f.precioBase ?? "Sin ofertas");
      expect(fila.getCell(5).value).toBe(f.precioSalida);
      expect(fila.getCell(9).value).toBe(f.oferente?.dni ?? "");
      expect(fila.getCell(11).value).toBe(f.oferente?.email ?? "");
      expect(fila.getCell(13).value).toBe(f.cantidadOfertas);
    }
    const primera = hoja.getRow(filaEnc + 1);
    expect(primera.getCell(4).numFmt).toBe("$ #,##0");
    expect(primera.getCell(12).value).toEqual(horaTucumanParaExcel(filas[0].ofertaAt!));
    expect(primera.getCell(7).value).toBe("María Belén");
    expect(hoja.getRow(filaEnc + 6).getCell(4).value).toBe("Sin ofertas");
    // Sobre las filas con fondo, "Sin ofertas" va en el color de texto (el gris no llega a AA).
    expect(hoja.getRow(filaEnc + 6).getCell(4).font?.color?.argb).toBe("FF33414F");

    // La mayor oferta de una persona bloqueada queda marcada en el alias.
    for (const f of filas) {
      const alias = hoja.getRow(filaEnc + f.numero).getCell(6);
      if (!f.oferente) {
        expect(alias.value).toBe("");
      } else if (f.oferente.bloqueado) {
        expect(alias.value).toBe(`Oferente ${f.oferente.alias} · BLOQUEADO`);
        expect((alias.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFDE9E9");
      } else {
        expect(alias.value).toBe(`Oferente ${f.oferente.alias}`);
      }
    }
  });

  it("marca el listado final cuando la etapa cerró", async () => {
    const buffer = await generarPlanilla(filasDePrueba(3), { ...META, preliminar: false, noPublicadas: [] });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet("Listado final")!;
    const textos: string[] = [];
    hoja.eachRow((fila) => textos.push(String(fila.getCell(1).value ?? "")));
    expect(textos.some((t) => t.startsWith("Estado: FINAL"))).toBe(true);
    expect(textos.some((t) => t.includes("PRELIMINAR"))).toBe(false);
    // Sin obras sin publicar, no hay aviso de más.
    expect(textos.some((t) => t.includes("sin publicar"))).toBe(false);
  });

  it("una obra sin publicar y sin ofertas se menciona en gris, sobre blanco", async () => {
    const buffer = await generarPlanilla(filasDePrueba(2), { ...META, noPublicadas: [NO_PUBLICADAS[1]] });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet("Listado final")!;
    const textos: string[] = [];
    hoja.eachRow((fila) => textos.push(String(fila.getCell(1).value ?? "")));
    const fila = textos.indexOf("Hay 1 obra sin publicar que no figura en este listado.") + 1;
    expect(fila).toBeGreaterThan(0);
    expect(hoja.getRow(fila).getCell(1).font?.color?.argb).toBe("FF6B7885");
    expect((hoja.getRow(fila).getCell(1).fill as ExcelJS.FillPattern | undefined)?.fgColor).toBeUndefined();
  });
});

describe("listado final desde la base", () => {
  let db: PGlite;
  const EQUIPO = { rol: "authenticated", uid: ADMIN } as const;
  const ESTADO: EstadoSubasta = {
    inicio: new Date(Date.UTC(2026, 9, 17, 23, 0)),
    cierre: new Date(Date.UTC(2026, 10, 1, 23, 0)),
    cierreFinal: new Date(Date.UTC(2026, 10, 1, 23, 0)),
    enExtension: false,
    extension: null,
    fechasConfirmadas: true,
    fechaPresencial: null,
    detallePresencial: null,
    incrementoMinimo: 5000,
    precioSalida: 10000,
    modoEjemplo: true,
    fase: "abierta",
    ahora: new Date(Date.UTC(2026, 9, 19, 17, 0)),
  };
  // postgres.js (el motor de producción) no llega a conectarse: solo se usan sus serializadores.
  const sql = postgres({ max: 1 });

  /** El listado tal como lo arma el panel: la misma consulta, con el rol del equipo. */
  async function listado(estado = ESTADO) {
    const { rows } = await como(db, EQUIPO, (tx) => tx.query<FilaVista>(SQL_LISTADO));
    return armarListado(rows, estado);
  }

  async function mejorDe(obraId: string) {
    const { rows } = await db.query<{ oferente_id: string; monto: number }>(
      "select oferente_id, monto from public.v_mejor_oferta where obra_id = $1",
      [obraId],
    );
    return rows[0];
  }

  beforeAll(async () => {
    db = await baseDePrueba();
  });

  afterAll(async () => {
    await sql.end();
    await db?.close();
  });

  it("arma el listado con las obras publicadas y marca el estado de la etapa", async () => {
    const { filas, noPublicadas, meta, totales } = await listado();
    expect(filas).toHaveLength(25);
    expect(filas[0].obraId).toBe(OBRA(1));
    expect(noPublicadas).toEqual([]);
    expect(meta).toMatchObject({ preliminar: true, generado: ESTADO.ahora, modoEjemplo: true, noPublicadas: [] });
    expect(totales).toEqual(totalesListado(filas));
    expect((await listado({ ...ESTADO, fase: "cerrada" })).meta.preliminar).toBe(false);
  });

  it("marca las obras cuya mayor oferta es de una persona bloqueada, sin anular la oferta", async () => {
    const antes = await listado();
    expect(filasConOferenteBloqueado(antes.filas)).toEqual([]);
    const obra = antes.filas.find((f) => f.oferente)!;
    const mejor = await mejorDe(obra.obraId);

    await db.query("update public.oferentes set bloqueado = true, bloqueo_motivo = 'Fraude detectado' where id = $1", [
      mejor.oferente_id,
    ]);
    const { rows: suyas } = await db.query<{ numero: number }>(
      `select ob.numero from public.v_mejor_oferta mo join public.obras ob on ob.id = mo.obra_id
       where mo.oferente_id = $1 and ob.publicada order by ob.numero`,
      [mejor.oferente_id],
    );
    const { filas } = await listado();
    const marcadas = filasConOferenteBloqueado(filas);
    expect(marcadas.map((f) => f.numero)).toEqual(suyas.map((r) => r.numero));
    expect(marcadas.map((f) => f.numero)).toContain(obra.numero);
    // Bloquear no anula: sigue siendo el precio base, con los mismos datos.
    expect(filas.find((f) => f.numero === obra.numero)).toEqual({
      ...obra,
      oferente: { ...obra.oferente!, bloqueado: true },
    });
    expect(notaBloqueados(filas)).toContain(`N° ${obra.numero}`);

    // En las ofertas del panel, cada oferta de esa persona dice que está bloqueada.
    const { rows: ofertas } = await como(db, EQUIPO, (tx) =>
      tx.query<{ oferente_id: string; bloqueado: boolean }>("select oferente_id, bloqueado from public.v_ofertas_admin"),
    );
    expect(ofertas.some((o) => o.bloqueado)).toBe(true);
    for (const o of ofertas) expect(o.bloqueado).toBe(o.oferente_id === mejor.oferente_id);

    await db.query("update public.oferentes set bloqueado = false, bloqueo_motivo = null where id = $1", [
      mejor.oferente_id,
    ]);
    expect(filasConOferenteBloqueado((await listado()).filas)).toEqual([]);
  });

  it("informa las obras sin publicar con sus ofertas, que quedan afuera del listado", async () => {
    const antes = await listado();
    const obra = antes.filas.find((f) => f.cantidadOfertas > 1)!;
    await db.query("update public.obras set publicada = false where id = $1", [obra.obraId]);

    const despues = await listado();
    expect(despues.filas.map((f) => f.numero)).not.toContain(obra.numero);
    expect(despues.noPublicadas).toEqual([
      {
        obraId: obra.obraId,
        numero: obra.numero,
        titulo: obra.titulo,
        artista: obra.artista,
        cantidadOfertas: obra.cantidadOfertas,
        mayorOferta: obra.precioBase,
      },
    ]);
    expect(despues.meta.noPublicadas).toEqual(despues.noPublicadas);
    expect(notaNoPublicadas(despues.meta.noPublicadas)).toBe(
      `Hay 1 obra sin publicar que no figura en este listado. Ofertas que quedan afuera: N° ${obra.numero} (${obra.cantidadOfertas} ofertas válidas, la mayor de ${pesos(obra.precioBase!)}).`,
    );
    await db.query("update public.obras set publicada = true where id = $1", [obra.obraId]);
  });

  it("la auditoría guarda el detalle de la exportación como objeto, también con postgres.js", async () => {
    const detalle = { formato: "pdf", preliminar: true, filas: 25 };

    async function ultimoDetalle() {
      const { rows } = await db.query<{ tipo: string; detalle: unknown }>(
        `select jsonb_typeof(detalle) as tipo, detalle from public.auditoria
         where accion = 'exportar_listado' order by id desc limit 1`,
      );
      return rows[0];
    }

    /** Como postgres.js: describe la consulta y aplica su serializador al tipo que informa la base. */
    async function registrarComoPostgresJs(texto: string) {
      const { queryParams } = await db.describeQuery(texto);
      const params = [JSON.stringify(detalle)].map((valor, i) => {
        const serializar = sql.options.serializers[queryParams[i].dataTypeID];
        return serializar ? String(serializar(valor)) : valor;
      });
      await como(db, EQUIPO, (tx) => tx.query(texto, params));
      return ultimoDetalle();
    }

    // Con $1::jsonb, postgres.js serializa el texto otra vez y queda guardado un string.
    expect(
      await registrarComoPostgresJs("select public.registrar_evento('exportar_listado', $1::jsonb)"),
    ).toMatchObject({ tipo: "string" });
    // Con la consulta del panel queda un objeto, en producción y en el modo local (PGlite).
    expect(await registrarComoPostgresJs(SQL_REGISTRAR_EXPORTACION)).toEqual({ tipo: "object", detalle });
    await como(db, EQUIPO, (tx) => tx.query(SQL_REGISTRAR_EXPORTACION, [JSON.stringify(detalle)]));
    expect(await ultimoDetalle()).toEqual({ tipo: "object", detalle });
  });
});

describe("PDF", () => {
  it("encuentra los logos institucionales", () => {
    const logos = cargarLogos();
    expect(logos.smtBlanco).not.toBeNull();
    expect(logos.muniIso).not.toBeNull();
    expect(proporcionPng(logos.muniIso)).toBeCloseTo(1, 1);
  });

  it("genera el listado preliminar en varias páginas", async () => {
    const pdf = await generarPdfListado(filasDePrueba(), META);
    guardar("listado-preliminar.pdf", pdf);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(paginas(pdf)).toBe(3);
  });

  it("genera un listado final corto en una página", async () => {
    const pdf = await generarPdfListado(filasDePrueba(6), { ...META, preliminar: false, noPublicadas: [] });
    guardar("listado-final.pdf", pdf);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(paginas(pdf)).toBe(1);
  });

  it("genera el listado aunque falten los logos", async () => {
    const pdf = await generarPdfListado(filasDePrueba(2), META, { smtBlanco: null, muniIso: null });
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(paginas(pdf)).toBe(1);
  });

  it("genera el listado y la planilla aunque todavía no haya obras publicadas", async () => {
    const meta: MetaListado = {
      ...META,
      noPublicadas: filasDePrueba().map((f) => ({ ...f, cantidadOfertas: 0, mayorOferta: null })),
    };
    const pdf = await generarPdfListado([], meta);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(paginas(pdf)).toBe(1);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await generarPlanilla([], meta)) as unknown as ArrayBuffer);
    expect(libro.getWorksheet("Listado final")).toBeDefined();
  });

  it("genera un cartel por obra", async () => {
    const pdf = await generarPdfCarteles(CARTELES, { generado: META.generado });
    guardar("carteles.pdf", pdf);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(paginas(pdf)).toBe(CARTELES.length);
  });
});
