// El Image de react-pdf no admite texto alternativo: se importa con otro nombre para que la
// regla de accesibilidad de <img> no lo confunda con una imagen de la web.
import { Defs, Font, Image as ImagenPdf, LinearGradient, Rect, Stop, Svg, Text, View } from "@react-pdf/renderer";
import { proporcionPng } from "./marca";

// Piezas comunes de los PDF institucionales (identidad SMT): banda superior con degradé,
// pie con isologo y atribución, sello de documento preliminar. Medidas en puntos (1 mm = 2,835 pt).

// Sin cortes de palabras con guion (las reglas por defecto son del inglés).
Font.registerHyphenationCallback((palabra) => [palabra]);

export const COLOR = {
  azul: "#126ff5",
  azulMedio: "#2589ea",
  azulProfundo: "#28469f",
  azulOscuro: "#0d3fb0",
  celeste: "#3cb4f0",
  amarillo: "#F2D91C",
  tinta: "#10233d",
  texto: "#33414f",
  /** Solo sobre blanco puro: sobre fondo o fondoPie no llega al contraste AA. */
  gris: "#6b7885",
  linea: "#e3e8ef",
  fondo: "#f6f9ff",
  fondoPie: "#fbfcfe",
  ambar: "#f59e0b",
  ambarSuave: "#fdefd8",
  verde: "#10b981",
  verdeSuave: "#ddf5ed",
  rojo: "#ef4444",
  rojoSuave: "#fde9e9",
  blanco: "#ffffff",
} as const;

/** Helvetica es una fuente estándar de PDF: no hay que incrustarla y tiene acentos y ñ. */
export const FUENTE = { normal: "Helvetica", negrita: "Helvetica-Bold", cursiva: "Helvetica-Oblique" } as const;

export const mm = (valor: number) => (valor * 72) / 25.4;

/** A4 en puntos (vertical). */
export const A4 = { ancho: 595.28, alto: 841.89 } as const;
export const MARGEN = mm(14);
export const ALTO_BANDA = mm(20);
export const ALTO_LINEA = mm(1.6);
export const ALTO_PIE = mm(15);

/** Extremos de un degradé lineal a 112° (como en CSS) para un rectángulo de ancho × alto. */
function degrade112(ancho: number, alto: number) {
  const angulo = (112 * Math.PI) / 180;
  const dx = Math.sin(angulo);
  const dy = -Math.cos(angulo);
  const largo = Math.abs(ancho * dx) + Math.abs(alto * dy);
  const cx = ancho / 2;
  const cy = alto / 2;
  return {
    x1: cx - (dx * largo) / 2,
    y1: cy - (dy * largo) / 2,
    x2: cx + (dx * largo) / 2,
    y2: cy + (dy * largo) / 2,
  };
}

/** Banda superior de 20 mm: degradé azul, título en blanco, logo Ciudad SMT y línea amarillo/celeste. */
export function Banda({
  titulo,
  ancho,
  logo,
  sello,
}: {
  titulo: string;
  /** Ancho de la página en puntos. */
  ancho: number;
  logo: Buffer | null;
  /** Texto de una pastilla junto al título (por ejemplo, PRELIMINAR). */
  sello?: string;
}) {
  const g = degrade112(ancho, ALTO_BANDA);
  const altoLogo = mm(7.6);
  const anchoLogo = altoLogo * proporcionPng(logo, 507 / 206);
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, width: ancho, height: ALTO_BANDA }}>
      <Svg
        width={ancho}
        height={ALTO_BANDA}
        viewBox={`0 0 ${ancho} ${ALTO_BANDA}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Defs>
          <LinearGradient id="degrade-banda" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={COLOR.azulOscuro} />
            <Stop offset={0.6} stopColor={COLOR.azul} />
            <Stop offset={1} stopColor={COLOR.azulMedio} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={ancho} height={ALTO_BANDA} fill="url(#degrade-banda)" />
        <Rect x={0} y={ALTO_BANDA - ALTO_LINEA} width={ancho * 0.22} height={ALTO_LINEA} fill={COLOR.amarillo} />
        <Rect
          x={ancho * 0.22}
          y={ALTO_BANDA - ALTO_LINEA}
          width={ancho * 0.78}
          height={ALTO_LINEA}
          fill={COLOR.celeste}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: MARGEN,
          right: MARGEN,
          height: ALTO_BANDA - ALTO_LINEA,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: COLOR.blanco, fontFamily: FUENTE.negrita, fontSize: 13 }}>{titulo}</Text>
          {sello && (
            <View
              style={{
                marginLeft: mm(3),
                backgroundColor: COLOR.ambar,
                borderRadius: mm(3),
                paddingHorizontal: mm(2.4),
                paddingVertical: mm(0.8),
              }}
            >
              <Text style={{ color: COLOR.tinta, fontFamily: FUENTE.negrita, fontSize: 8.5, letterSpacing: 0.8 }}>
                {sello}
              </Text>
            </View>
          )}
        </View>
        {logo && <ImagenPdf src={{ data: logo, format: "png" }} style={{ height: altoLogo, width: anchoLogo }} />}
      </View>
    </View>
  );
}

/**
 * Pie de 15 mm en todas las páginas: isologo y organismo a la izquierda, atribución y página a la
 * derecha. Los textos secundarios van en COLOR.texto: el gris no llega a 4,5:1 sobre fondoPie.
 */
export function Pie({ logo, mesAnio }: { logo: Buffer | null; mesAnio: string }) {
  const altoLogo = mm(8.4);
  return (
    <View
      fixed
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: ALTO_PIE,
        backgroundColor: COLOR.fondoPie,
        borderTopWidth: mm(0.35),
        borderTopColor: COLOR.linea,
        borderTopStyle: "solid",
        paddingHorizontal: MARGEN,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {logo && (
          <ImagenPdf
            src={{ data: logo, format: "png" }}
            style={{ height: altoLogo, width: altoLogo * proporcionPng(logo), marginRight: mm(3) }}
          />
        )}
        <View>
          <Text style={{ fontFamily: FUENTE.negrita, fontSize: 7.4, color: COLOR.tinta }}>
            Municipalidad de San Miguel de Tucumán
          </Text>
          <Text style={{ fontSize: 6.6, color: COLOR.texto, marginTop: 1.5 }}>Dirección de Cementerios</Text>
        </View>
      </View>
      {/* Ancho fijo: el número de página se calcula al final y necesita el lugar reservado. */}
      <View style={{ width: mm(110) }}>
        <Text style={{ fontSize: 6.6, color: COLOR.texto, textAlign: "right" }}>
          Desarrollado por la Dirección de Inteligencia Artificial
        </Text>
        <Text
          style={{ fontSize: 6.6, color: COLOR.texto, marginTop: 1.5, textAlign: "right" }}
          render={({ pageNumber, totalPages }) => `${mesAnio} · Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </View>
  );
}

/**
 * Marca de agua diagonal en el centro de cada página. Va encima del contenido (si no, la
 * taparían los fondos de las filas), por eso es muy tenue.
 */
export function MarcaDeAgua({ texto, ancho, alto }: { texto: string; ancho: number; alto: number }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: alto / 2 - 90,
        left: 0,
        width: ancho,
        height: 180,
        alignItems: "center",
        justifyContent: "center",
        transform: "rotate(-16deg)",
      }}
    >
      <Text style={{ fontFamily: FUENTE.negrita, fontSize: 110, color: COLOR.tinta, opacity: 0.07, letterSpacing: 8 }}>
        {texto}
      </Text>
    </View>
  );
}

/** Barrita vertical azul-celeste que acompaña los títulos. */
export function Barrita({ alto }: { alto: number }) {
  const ancho = mm(1.5);
  return (
    <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} style={{ marginRight: mm(3) }}>
      <Defs>
        <LinearGradient id="degrade-barrita" x1={0} y1={0} x2={0} y2={1}>
          <Stop offset={0} stopColor={COLOR.azul} />
          <Stop offset={1} stopColor={COLOR.celeste} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={ancho} height={alto} rx={ancho / 2} ry={ancho / 2} fill="url(#degrade-barrita)" />
    </Svg>
  );
}
