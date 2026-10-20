"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { BotonEnviar } from "@/components/admin/BotonEnviar";
import { Campo, MensajeAccion } from "@/components/admin/Panel";
import { estadoInicial, type EstadoAccion } from "@/lib/admin/acciones";

// Subida de fotos desde el panel. Antes de enviar, el navegador achica la imagen a 2000 px
// por lado como máximo y la convierte a JPEG: así no supera el límite de 4 MB de los
// Server Actions y, de paso, se descartan los metadatos (EXIF, ubicación GPS).
// El servidor vuelve a normalizarla con guardarFoto().

const LADO_MAXIMO = 2000;
const CALIDAD = 0.85;
/** Límite de un envío (4 MB) con margen para los demás campos del formulario. */
const PESO_MAXIMO_ENVIO = 4 * 1024 * 1024 - 100 * 1024;
/** Más que esto suele ser un archivo que no es una foto o que el celular no puede procesar. */
const PESO_MAXIMO_ORIGINAL = 40 * 1024 * 1024;
const MIN_ALT = 5;

type FotoPreparada = { blob: Blob; ancho: number; alto: number; vista: string; pesoOriginal: number };

const formatoDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function pesoLegible(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${formatoDecimal.format(bytes / (1024 * 1024))} MB`;
}

function pareceImagen(archivo: File) {
  return archivo.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(archivo.name);
}

/** Decodifica la imagen respetando la orientación de la cámara. */
async function decodificar(archivo: File) {
  try {
    const mapa = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    return { fuente: mapa as CanvasImageSource, ancho: mapa.width, alto: mapa.height, cerrar: () => mapa.close() };
  } catch {
    // Algunos navegadores no decodifican todos los formatos con createImageBitmap.
    const url = URL.createObjectURL(archivo);
    const img = document.createElement("img");
    img.src = url;
    try {
      await img.decode();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  }
}

/** Achica a LADO_MAXIMO px por lado y convierte a JPEG con calidad 0,85. */
async function achicar(archivo: File): Promise<FotoPreparada> {
  const imagen = await decodificar(archivo);
  try {
    if (!imagen.ancho || !imagen.alto) throw new Error("Imagen sin tamaño");
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.ancho, imagen.alto));
    const ancho = Math.max(1, Math.round(imagen.ancho * escala));
    const alto = Math.max(1, Math.round(imagen.alto * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("Sin canvas");
    // Las imágenes con transparencia (PNG) quedan sobre fondo blanco.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/jpeg", CALIDAD));
    if (!blob) throw new Error("No se pudo generar el JPEG");
    return { blob, ancho, alto, vista: URL.createObjectURL(blob), pesoOriginal: archivo.size };
  } finally {
    imagen.cerrar();
  }
}

/**
 * Formulario para subir una foto. `guardarAction` es un Server Action que recibe el campo
 * "foto" (JPEG ya achicado), los campos `ocultos` y, si corresponde, "texto_alternativo".
 */
export function SubirFoto({
  guardarAction,
  ocultos,
  conTextoAlternativo = true,
  etiqueta = "Foto",
  textoBoton = "Subir la foto",
}: {
  guardarAction: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  ocultos: Record<string, string>;
  conTextoAlternativo?: boolean;
  etiqueta?: string;
  textoBoton?: string;
}) {
  const id = useId();
  const idFoto = `${id}foto`;
  const idAlt = `${id}alt`;

  const [preparada, setPreparada] = useState<FotoPreparada | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  // Después de elegir otra foto no tiene sentido seguir mostrando el error del envío anterior.
  const [eleccionNueva, setEleccionNueva] = useState(false);
  const pendiente = useRef<Promise<FotoPreparada | null> | null>(null);
  const vista = useRef<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // Con Cache Components, Next.js oculta la página al navegar (Activity) en lugar de
  // desmontarla: esta limpieza corre en los dos casos. Se descarta la foto elegida entera
  // (vista previa, estado y archivo del campo) para no dejar una vista previa revocada.
  useEffect(() => {
    const campo = entrada.current;
    return () => {
      if (vista.current) URL.revokeObjectURL(vista.current);
      vista.current = null;
      pendiente.current = null;
      setPreparada(null);
      setProcesando(false);
      if (campo) campo.value = "";
    };
  }, []);

  function descartar() {
    if (vista.current) URL.revokeObjectURL(vista.current);
    vista.current = null;
    // La preparación en curso (si había) queda descartada: su resultado ya no se usa.
    pendiente.current = null;
    setProcesando(false);
    setPreparada(null);
  }

  function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    descartar();
    setErrorLocal(null);
    setEleccionNueva(true);
    if (!archivo) return;
    if (!pareceImagen(archivo)) {
      setErrorLocal("El archivo que elegiste no es una imagen. Elegí una foto (JPG, PNG o WebP).");
      evento.target.value = "";
      return;
    }
    if (archivo.size > PESO_MAXIMO_ORIGINAL) {
      setErrorLocal(`La foto es muy pesada (${pesoLegible(archivo.size)}). Elegí otra de menos de 40 MB.`);
      evento.target.value = "";
      return;
    }

    setProcesando(true);
    const promesa: Promise<FotoPreparada | null> = achicar(archivo)
      .then(
        (lista) => {
          if (pendiente.current !== promesa) {
            URL.revokeObjectURL(lista.vista);
            return null;
          }
          if (lista.blob.size > PESO_MAXIMO_ENVIO) {
            URL.revokeObjectURL(lista.vista);
            setErrorLocal("Aun achicada, la foto pesa más de 4 MB. Probá con otra imagen.");
            return null;
          }
          vista.current = lista.vista;
          setPreparada(lista);
          return lista;
        },
        () => {
          if (pendiente.current === promesa) {
            setErrorLocal("No pudimos abrir esa imagen en este navegador. Probá con una foto en JPG, PNG o WebP.");
          }
          return null;
        },
      )
      .finally(() => {
        if (pendiente.current === promesa) setProcesando(false);
      });
    pendiente.current = promesa;
  }

  const [estado, enviar] = useActionState(async (previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> => {
    setEleccionNueva(false);
    const alt = String(datos.get("texto_alternativo") ?? "").trim();
    const valores = conTextoAlternativo ? { texto_alternativo: alt } : undefined;

    const errores: Record<string, string> = {};
    const lista = await (pendiente.current ?? Promise.resolve(null));
    if (!lista) errores.foto = "Elegí una foto.";
    if (conTextoAlternativo && alt.length < MIN_ALT) {
      errores.texto_alternativo = alt
        ? "La descripción es muy corta. Contá en pocas palabras qué se ve en la foto."
        : "Escribí una descripción breve de la foto.";
    }
    if (!lista || Object.keys(errores).length) return { errores, valores };

    datos.set("foto", lista.blob, "foto.jpg");
    try {
      const resultado = await guardarAction(previo, datos);
      if (resultado.ok) {
        descartar();
        if (entrada.current) entrada.current.value = "";
      }
      return resultado;
    } catch (error) {
      // Deja pasar las redirecciones (por ejemplo, si venció la sesión).
      unstable_rethrow(error);
      return {
        error: "No pudimos subir la foto. Revisá la conexión y probá de nuevo; si sigue fallando, probá con otra imagen.",
        valores,
      };
    }
  }, estadoInicial);

  const e = estado.errores ?? {};
  const errorFoto = errorLocal ?? (eleccionNueva ? undefined : e.foto);
  const describir = (campo: string, error?: string) =>
    [`${campo}-ayuda`, error && `${campo}-error`].filter(Boolean).join(" ");

  return (
    <form action={enviar} className="space-y-5" noValidate>
      {Object.entries(ocultos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}

      <Campo
        id={idFoto}
        etiqueta={etiqueta}
        ayuda="Elegí una imagen de la computadora o, desde el celular, sacá la foto en el momento. Antes de subirla la achicamos a 2000 px por lado como máximo."
        error={errorFoto}
      >
        {/* Sin name: se envía la versión achicada, nunca el archivo original. */}
        <input
          ref={entrada}
          id={idFoto}
          type="file"
          accept="image/*"
          onChange={alElegir}
          className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-linea bg-fondo p-3 text-base text-tinta file:mr-4 file:min-h-12 file:cursor-pointer file:rounded-lg file:border-0 file:bg-azul file:px-4 file:font-bold file:text-white hover:file:bg-azul-profundo"
          aria-invalid={errorFoto ? true : undefined}
          aria-describedby={describir(idFoto, errorFoto)}
        />
      </Campo>

      {procesando && (
        <p role="status" className="text-gris">
          Preparando la foto…
        </p>
      )}

      {preparada && (
        <figure className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* Vista previa local (blob:), no pasa por el optimizador de imágenes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preparada.vista}
            alt="Vista previa de la foto elegida"
            className="max-h-60 w-auto max-w-full rounded-xl border border-linea object-contain"
          />
          <figcaption className="text-base text-gris">
            Lista para subir: {preparada.ancho} × {preparada.alto} px, {pesoLegible(preparada.blob.size)}
            {preparada.pesoOriginal > preparada.blob.size && ` (la original pesaba ${pesoLegible(preparada.pesoOriginal)})`}.
          </figcaption>
        </figure>
      )}

      {conTextoAlternativo && (
        <Campo
          id={idAlt}
          etiqueta="Texto alternativo"
          ayuda="Descripción breve de lo que se ve, para las personas que usan lector de pantalla. Por ejemplo: «Cabeza escultórica pintada de azul, con flores de papel en la frente»."
          error={e.texto_alternativo}
        >
          <input
            id={idAlt}
            name="texto_alternativo"
            required
            maxLength={250}
            autoComplete="off"
            defaultValue={estado.valores?.texto_alternativo ?? ""}
            className="campo"
            aria-invalid={e.texto_alternativo ? true : undefined}
            aria-describedby={describir(idAlt, e.texto_alternativo)}
          />
        </Campo>
      )}

      <MensajeAccion estado={estado} />

      <BotonEnviar enviando="Subiendo…">{textoBoton}</BotonEnviar>
    </form>
  );
}
