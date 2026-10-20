import { Document, Page, Path, Rect, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { tituloObra } from "@/lib/formato";
import { mesYAnio, urlCorta } from "./comun";
import { cargarLogos } from "./marca";
import { A4, ALTO_BANDA, ALTO_PIE, Banda, COLOR, FUENTE, MARGEN, Pie, mm } from "./pdf-base";
import { qrTrazado } from "./qr";
import type { Logos, MetaCarteles, ObraCartel } from "./tipos";

// Carteles para imprimir y poner junto a cada obra: A4 vertical, uno por página.
// Sin montos ni textos legales: solo la obra y el código para entrar a su ficha.

/** Lado de la zona de módulos del QR (sin contar el margen blanco). */
const LADO_MODULOS = mm(104);

/** Recorta textos muy largos en el último espacio, para que el cartel no se desborde. */
function recortar(texto: string, max: number) {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf(" ", max - 1);
  return `${texto.slice(0, corte > max / 2 ? corte : max - 1).trimEnd()}…`;
}

function tamanoTitulo(titulo: string) {
  if (titulo.length <= 26) return 30;
  if (titulo.length <= 48) return 25;
  return 20;
}

function Cartel({ obra, logos, mesAnio }: { obra: ObraCartel; logos: Logos; mesAnio: string }) {
  const qr = qrTrazado(obra.url);
  const ladoQr = (LADO_MODULOS * qr.lado) / qr.modulos;
  const titulo = recortar(tituloObra(obra.titulo), 120);
  return (
    <Page
      size="A4"
      wrap={false}
      style={{
        paddingTop: ALTO_BANDA + mm(10),
        paddingBottom: ALTO_PIE + mm(8),
        paddingHorizontal: MARGEN + mm(4),
        fontFamily: FUENTE.normal,
        color: COLOR.texto,
      }}
    >
      <Banda titulo="Subasta solidaria · Cementerio del Oeste" ancho={A4.ancho} logo={logos.smtBlanco} />

      <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: FUENTE.negrita, fontSize: 60, color: COLOR.tinta, lineHeight: 1 }}>
          Obra N° {obra.numero}
        </Text>
        <Text
          style={{
            fontFamily: obra.titulo?.trim() ? FUENTE.negrita : "Helvetica-BoldOblique",
            fontSize: tamanoTitulo(titulo),
            color: COLOR.tinta,
            textAlign: "center",
            marginTop: mm(6),
            lineHeight: 1.15,
          }}
        >
          {titulo}
        </Text>
        <Text style={{ fontSize: 19, color: COLOR.texto, textAlign: "center", marginTop: mm(2.5), lineHeight: 1.2 }}>
          de <Text style={{ fontFamily: FUENTE.negrita, color: COLOR.tinta }}>{recortar(obra.artista, 70)}</Text>
        </Text>

        <View
          style={{
            marginTop: mm(7),
            borderWidth: mm(0.35),
            borderColor: COLOR.linea,
            borderRadius: mm(2.6),
            backgroundColor: COLOR.blanco,
          }}
        >
          <Svg width={ladoQr} height={ladoQr} viewBox={`0 0 ${qr.lado} ${qr.lado}`}>
            <Rect x={0} y={0} width={qr.lado} height={qr.lado} fill={qr.claro} />
            <Path d={qr.d} fill={qr.oscuro} />
          </Svg>
        </View>

        <Text style={{ fontFamily: FUENTE.negrita, fontSize: 17, color: COLOR.azulProfundo, marginTop: mm(5) }}>
          {urlCorta(obra.url)}
        </Text>
        <Text style={{ fontSize: 15, color: COLOR.texto, marginTop: mm(2) }}>
          Escaneá el código para ver la obra y ofertar
        </Text>
      </View>

      <Pie logo={logos.muniIso} mesAnio={mesAnio} />
    </Page>
  );
}

export function DocumentoCarteles({ obras, meta, logos }: { obras: ObraCartel[]; meta: MetaCarteles; logos: Logos }) {
  const mesAnio = mesYAnio(meta.generado);
  return (
    <Document
      title="Carteles con código QR · Subasta solidaria"
      author="Municipalidad de San Miguel de Tucumán · Dirección de Cementerios"
      creator="Subasta solidaria del Cementerio del Oeste"
      producer="Subasta solidaria del Cementerio del Oeste"
      language="es-AR"
    >
      {obras.map((obra) => (
        <Cartel key={obra.numero} obra={obra} logos={logos} mesAnio={mesAnio} />
      ))}
    </Document>
  );
}

/** PDF con un cartel por obra (Buffer). Los logos se leen de public/marca si no se pasan. */
export async function generarPdfCarteles(
  obras: ObraCartel[],
  meta: MetaCarteles,
  logos: Logos = cargarLogos(),
): Promise<Buffer> {
  return renderToBuffer(<DocumentoCarteles obras={obras} meta={meta} logos={logos} />);
}
