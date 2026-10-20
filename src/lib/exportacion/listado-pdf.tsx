import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { numeroConPuntos, pesos, tituloObra } from "@/lib/formato";
import {
  fechaCorta,
  fechaHoraTexto,
  horaCorta,
  mesYAnio,
  notaBloqueados,
  notaNoPublicadas,
  renglonesDeCorreo,
  totalesListado,
} from "./comun";
import { cargarLogos } from "./marca";
import { A4, ALTO_BANDA, ALTO_PIE, Banda, Barrita, COLOR, FUENTE, MARGEN, MarcaDeAgua, Pie, mm } from "./pdf-base";
import type { FilaListado, Logos, MetaListado } from "./tipos";

// PDF del listado final para el martillero: A4 apaisado, una fila por obra publicada.

const ANCHO = A4.alto;
const ALTO = A4.ancho;

/** Anchos de columna en puntos (suman el ancho útil: 297 − 2 × 14 mm ≈ 762 pt). */
const COL = {
  numero: 26,
  obra: 162,
  precio: 80,
  oferente: 118,
  dni: 56,
  telefono: 76,
  correo: 140,
  fecha: 66,
  ofertas: 38,
} as const;

const celda: Style = { paddingHorizontal: 4, paddingVertical: 4.5 };
const derecha: Style = { ...celda, alignItems: "flex-end", textAlign: "right" };
// Los textos secundarios van en COLOR.texto: las filas impares tienen fondo y ahí el gris no llega a 4,5:1.
const secundario: Style = { fontSize: 7, color: COLOR.texto, marginTop: 1.5 };
const principal: Style = { fontFamily: FUENTE.negrita, color: COLOR.tinta };

function Correo({ email }: { email: string }) {
  return (
    <>
      {renglonesDeCorreo(email).map((renglon, i) => (
        <Text key={i}>{renglon}</Text>
      ))}
    </>
  );
}

function Encabezado({ meta, filas }: { meta: MetaListado; filas: FilaListado[] }) {
  const totales = totalesListado(filas);
  const notas: { texto: string; destacada?: boolean }[] = [
    { texto: "Contiene DNI y datos de contacto: compartilo solo con el martillero (Ley 25.326)." },
  ];
  const noPublicadas = notaNoPublicadas(meta.noPublicadas);
  if (noPublicadas) {
    // Si alguna tiene ofertas, va destacada: esas ofertas no le llegan al martillero.
    notas.push({ texto: noPublicadas, destacada: meta.noPublicadas.some((o) => o.cantidadOfertas > 0) });
  }
  if (meta.modoEjemplo) notas.push({ texto: "Datos de ejemplo: las obras, artistas y ofertas no son reales." });
  const bloqueados = notaBloqueados(filas);

  return (
    <View style={{ marginBottom: mm(5) }}>
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <Barrita alto={44} />
        <View style={{ flexGrow: 1 }}>
          <Text style={{ fontFamily: FUENTE.negrita, fontSize: 17, color: COLOR.tinta }}>
            Listado final para la subasta presencial
          </Text>
          <Text style={{ fontSize: 9.5, color: COLOR.texto, marginTop: 4 }}>
            Subasta solidaria del Cementerio del Oeste · Precio base de cada obra: la mayor oferta virtual válida.
          </Text>
          <Text style={{ fontSize: 9, color: COLOR.gris, marginTop: 3 }}>
            Generado el {fechaHoraTexto(meta.generado)} (hora de Tucumán)
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: mm(4), gap: mm(3) }}>
        <View
          style={{
            flexGrow: 1,
            flexBasis: 0,
            backgroundColor: meta.preliminar ? COLOR.ambarSuave : COLOR.verdeSuave,
            borderLeftWidth: mm(1.6),
            borderLeftColor: meta.preliminar ? COLOR.ambar : COLOR.verde,
            borderRadius: mm(1.6),
            paddingHorizontal: mm(3.5),
            paddingVertical: mm(2.5),
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: FUENTE.negrita, fontSize: 10.5, color: COLOR.tinta }}>
            {meta.preliminar ? "PRELIMINAR" : "FINAL"}
          </Text>
          <Text style={{ fontSize: 8.5, color: COLOR.tinta, marginTop: 2 }}>
            {meta.preliminar
              ? "La etapa virtual todavía no cerró; los precios base pueden cambiar."
              : `La etapa virtual cerró el ${fechaHoraTexto(meta.cierre)} (hora de Tucumán).`}
          </Text>
        </View>
        <Dato titulo="Obras en el listado" valor={String(totales.obras)} />
        <Dato titulo="Obras con ofertas" valor={String(totales.obrasConOfertas)} />
        <Dato titulo="Monto acumulado" valor={`$ ${numeroConPuntos(totales.montoAcumulado)}`} ancho={mm(48)} />
      </View>

      {bloqueados && (
        <View
          wrap={false}
          style={{
            marginTop: mm(3),
            backgroundColor: COLOR.rojoSuave,
            borderLeftWidth: mm(1.6),
            borderLeftColor: COLOR.rojo,
            borderRadius: mm(1.6),
            paddingHorizontal: mm(3.5),
            paddingVertical: mm(2),
          }}
        >
          <Text style={{ fontFamily: FUENTE.negrita, fontSize: 8.5, color: COLOR.tinta }}>{bloqueados}</Text>
        </View>
      )}

      <View style={{ marginTop: mm(3) }}>
        {notas.map((nota) => (
          <Text
            key={nota.texto}
            style={{
              fontSize: 8,
              color: nota.destacada ? COLOR.tinta : COLOR.texto,
              fontFamily: nota.destacada ? FUENTE.negrita : FUENTE.normal,
              marginTop: 1.5,
            }}
          >
            <Text style={{ fontFamily: FUENTE.negrita, color: COLOR.tinta }}>· </Text>
            {nota.texto}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Dato({ titulo, valor, ancho = mm(36) }: { titulo: string; valor: string; ancho?: number }) {
  return (
    <View
      style={{
        width: ancho,
        borderWidth: mm(0.35),
        borderColor: COLOR.linea,
        backgroundColor: COLOR.fondo,
        borderRadius: mm(1.6),
        paddingHorizontal: mm(3),
        paddingVertical: mm(2.5),
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 7.5, color: COLOR.texto }}>{titulo}</Text>
      <Text style={{ fontFamily: FUENTE.negrita, fontSize: 14, color: COLOR.tinta, marginTop: 2 }}>{valor}</Text>
    </View>
  );
}

function FilaEncabezado() {
  const th: Style = { ...celda, paddingVertical: 5, fontFamily: FUENTE.negrita, color: COLOR.blanco, fontSize: 7.8 };
  const thDer: Style = { ...th, textAlign: "right" };
  return (
    <View fixed style={{ flexDirection: "row", backgroundColor: COLOR.azul, borderRadius: 2 }}>
      <Text style={{ ...thDer, width: COL.numero }}>N°</Text>
      <Text style={{ ...th, width: COL.obra }}>Obra y artista</Text>
      <Text style={{ ...thDer, width: COL.precio }}>Precio base</Text>
      <Text style={{ ...th, width: COL.oferente }}>Oferente</Text>
      <Text style={{ ...th, width: COL.dni }}>DNI</Text>
      <Text style={{ ...th, width: COL.telefono }}>Teléfono</Text>
      <Text style={{ ...th, width: COL.correo }}>Correo</Text>
      <Text style={{ ...th, width: COL.fecha }}>Fecha y hora</Text>
      <Text style={{ ...thDer, width: COL.ofertas }}>Ofertas</Text>
    </View>
  );
}

/** Marca de oferente bloqueado (el encabezado del documento explica qué revisar). */
function MarcaBloqueado() {
  return (
    <View
      style={{
        marginTop: 2.5,
        alignSelf: "flex-start",
        backgroundColor: COLOR.rojoSuave,
        borderLeftWidth: 1.6,
        borderLeftColor: COLOR.rojo,
        borderRadius: 1.6,
        paddingHorizontal: 3,
        paddingVertical: 1.2,
      }}
    >
      <Text style={{ fontFamily: FUENTE.negrita, fontSize: 6.6, color: COLOR.tinta, letterSpacing: 0.4 }}>BLOQUEADO</Text>
    </View>
  );
}

/** Alto de la línea de totales: la última fila no se separa de ella (no queda sola en una página). */
const ALTO_TOTALES = mm(11);

function FilaObra({ fila, par, ultima }: { fila: FilaListado; par: boolean; ultima: boolean }) {
  const o = fila.oferente;
  return (
    <View
      wrap={false}
      {...(ultima ? { minPresenceAhead: ALTO_TOTALES } : {})}
      style={{
        flexDirection: "row",
        backgroundColor: par ? COLOR.blanco : COLOR.fondo,
        borderBottomWidth: 0.6,
        borderBottomColor: COLOR.linea,
      }}
    >
      <View style={{ ...derecha, width: COL.numero }}>
        <Text style={principal}>{fila.numero}</Text>
      </View>
      <View style={{ ...celda, width: COL.obra }}>
        <Text style={{ ...principal, fontFamily: fila.titulo?.trim() ? FUENTE.negrita : "Helvetica-BoldOblique" }}>
          {tituloObra(fila.titulo)}
        </Text>
        <Text style={secundario}>de {fila.artista}</Text>
      </View>
      <View style={{ ...derecha, width: COL.precio }}>
        {fila.precioBase != null ? (
          <Text style={{ ...principal, fontSize: 9 }}>{pesos(fila.precioBase)}</Text>
        ) : (
          <>
            <Text style={{ fontFamily: FUENTE.cursiva, color: COLOR.texto }}>Sin ofertas</Text>
            <Text style={secundario}>Salida: {pesos(fila.precioSalida)}</Text>
          </>
        )}
      </View>
      <View style={{ ...celda, width: COL.oferente }}>
        {o ? (
          <>
            <Text style={principal}>
              {o.nombre} {o.apellido}
            </Text>
            <Text style={secundario}>Oferente {o.alias}</Text>
            {o.bloqueado && <MarcaBloqueado />}
          </>
        ) : (
          <Text style={{ color: COLOR.texto }}>—</Text>
        )}
      </View>
      <View style={{ ...celda, width: COL.dni }}>
        <Text>{o?.dni ?? ""}</Text>
      </View>
      <View style={{ ...celda, width: COL.telefono }}>
        <Text>{o?.telefono ?? ""}</Text>
      </View>
      <View style={{ ...celda, width: COL.correo }}>{o && <Correo email={o.email} />}</View>
      <View style={{ ...celda, width: COL.fecha }}>
        {fila.ofertaAt && (
          <>
            <Text>{fechaCorta(fila.ofertaAt)}</Text>
            <Text style={secundario}>{horaCorta(fila.ofertaAt)} h</Text>
          </>
        )}
      </View>
      <View style={{ ...derecha, width: COL.ofertas }}>
        <Text>{fila.cantidadOfertas}</Text>
      </View>
    </View>
  );
}

export function DocumentoListado({ filas, meta, logos }: { filas: FilaListado[]; meta: MetaListado; logos: Logos }) {
  const totales = totalesListado(filas);
  const mesAnio = mesYAnio(meta.generado);
  return (
    <Document
      title={`${meta.preliminar ? "PRELIMINAR · " : ""}Listado final · Subasta presencial`}
      author="Municipalidad de San Miguel de Tucumán · Dirección de Cementerios"
      subject="Precio base de cada obra para la subasta presencial"
      creator="Subasta solidaria del Cementerio del Oeste"
      producer="Subasta solidaria del Cementerio del Oeste"
      language="es-AR"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={{
          paddingTop: ALTO_BANDA + mm(7),
          paddingBottom: ALTO_PIE + mm(7),
          paddingHorizontal: MARGEN,
          fontFamily: FUENTE.normal,
          fontSize: 8.2,
          color: COLOR.texto,
        }}
      >
        <Banda
          titulo="Listado final · Subasta presencial"
          ancho={ANCHO}
          logo={logos.smtBlanco}
          sello={meta.preliminar ? "PRELIMINAR" : undefined}
        />

        <Encabezado meta={meta} filas={filas} />

        {/* Los totales van dentro de la tabla para que la última fila los acompañe (minPresenceAhead). */}
        <View>
          <FilaEncabezado />
          {filas.map((fila, i) => (
            <FilaObra key={fila.numero} fila={fila} par={i % 2 === 0} ultima={i === filas.length - 1} />
          ))}
          {filas.length === 0 && (
            <Text style={{ ...celda, color: COLOR.gris, paddingVertical: mm(4) }}>No hay obras publicadas.</Text>
          )}
          <View
            wrap={false}
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginTop: mm(3),
              paddingTop: mm(2),
              borderTopWidth: mm(0.5),
              borderTopColor: COLOR.azul,
            }}
          >
            <Text style={{ fontSize: 9, color: COLOR.texto }}>
              {totales.obrasConOfertas} de {totales.obras} obras con ofertas · Monto acumulado (suma de los precios
              base):{" "}
            </Text>
            <Text style={{ fontFamily: FUENTE.negrita, fontSize: 9, color: COLOR.tinta }}>
              {pesos(totales.montoAcumulado)}
            </Text>
          </View>
        </View>

        {meta.preliminar && <MarcaDeAgua texto="PRELIMINAR" ancho={ANCHO} alto={ALTO} />}
        <Pie logo={logos.muniIso} mesAnio={mesAnio} />
      </Page>
    </Document>
  );
}

/** PDF del listado final (Buffer). Los logos se leen de public/marca si no se pasan. */
export async function generarPdfListado(
  filas: FilaListado[],
  meta: MetaListado,
  logos: Logos = cargarLogos(),
): Promise<Buffer> {
  return renderToBuffer(<DocumentoListado filas={filas} meta={meta} logos={logos} />);
}
