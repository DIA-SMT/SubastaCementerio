// Carga en Supabase los 24 artistas y sus obras del catálogo de "Memorias del futuro", con el
// número de obra del catálogo (orden alfabético por apellido). Las obras quedan SIN PUBLICAR:
// el equipo completa desde el panel la foto, el título, la técnica, las medidas, la memoria
// conceptual y el Instagram, y las publica cuando estén listas.
//
// No pisa nada: si ya existe un artista con ese nombre (sin importar mayúsculas), lo reutiliza;
// si ese artista ya tiene una obra cargada (con cualquier número), no le crea otra; si el número
// ya está ocupado, lo saltea. Se puede correr más de una vez.
//
// Uso:  npm run db:catalogo            (carga lo que falta)
//       npm run db:catalogo -- --ver   (solo muestra qué haría)
//
// Lee DATABASE_URL de .env.local (como scripts/migrar.mjs).
import postgres from "postgres";

/** Número de obra, nombre del artista (como figura en el sitio) y datos ya entregados. */
const CATALOGO = [
  [1, "Silvia Leonor Agüero"],
  [2, "Claudia Albarracín"],
  [3, "Alejandro Contreras Moiraghi"],
  [4, "Eugenia Correa"],
  [5, "Rubén Giménez"],
  [
    6,
    "Alejandro Gómez Tolosa",
    {
      instagram: "alejandrogomeztolosa",
      titulo: "Inconsciente colectivo",
      tecnica:
        "Yeso, vendas enyesadas, telgopor, elementos en PLA (impresión 3D), soldaditos de plástico, pintura roja y barniz brillante",
      altoCm: 80,
      anchoCm: 30,
      profundidadCm: 40,
      medidasAproximadas: true,
      resena:
        "La obra toma su título del concepto de la psicología analítica de Carl Jung. Esta pieza materializa visualmente la premisa de que el ser humano no opera únicamente desde su individualidad, sino que arrastra una herencia psíquica conformada por símbolos, mitos e historias compartidas por la humanidad. La cabeza sirve de base física para una masiva y caótica superestructura. Esta acumulación vertical simboliza la mente como un contenedor saturado. Es un rostro antropomorfo de ojos desorbitados y expresión de asombro o perturbación. Esta mirada conecta directamente con el espectador, desnudando la vulnerabilidad del individuo ante el desborde de sus propios contenidos mentales.",
    },
  ],
  [7, "Elba Gramajo"],
  [8, "Mane Guantay"],
  [9, "Eduardo Joaquín"],
  [10, "Rubén Kempa"],
  [11, "Néstor Mercado"],
  [12, "Natalia Morel"],
  [13, "Jessica Ivana Morillo"],
  [14, "Sandro Pereira"],
  [15, "Elena Requelme"],
  [16, "Pablo Iván Ríos"],
  [17, "María de la Paz Risso Patrón"],
  [18, "Sol Rodríguez Díaz"],
  [19, "Marisa Rossini"],
  [20, "Juliet Ruiz"],
  [21, "Ana Singh"],
  [22, "Mónica Vallejo"],
  [23, "María Silvina Vera"],
  [24, "Ariel Xamena"],
];

const soloVer = process.argv.includes("--ver");
const cadena = process.env.DATABASE_URL;
if (!cadena) {
  console.error("Falta DATABASE_URL (en .env.local). Este script carga datos en Supabase, no en la base local.");
  process.exit(1);
}
const url = new URL(cadena);
if (url.port === "6543") url.port = "5432";
const sql = postgres(url.toString(), { ssl: "require", prepare: false, max: 1, onnotice: () => {} });

try {
  const resumen = await sql.begin(async (tx) => {
    const hechos = { artistasNuevos: 0, artistasExistentes: 0, obrasNuevas: 0, obrasSalteadas: [], yaTenianObra: [] };
    for (const [numero, nombre, datos = {}] of CATALOGO) {
      const [existente] = await tx`select id from public.artistas where lower(nombre) = lower(${nombre}) limit 1`;
      let artistaId = existente?.id;
      if (artistaId) {
        hechos.artistasExistentes++;
      } else {
        hechos.artistasNuevos++;
        if (!soloVer) {
          [{ id: artistaId }] = await tx`
            insert into public.artistas (nombre, instagram)
            values (${nombre}, ${datos.instagram ?? null})
            returning id`;
        }
      }

      if (artistaId) {
        const [suya] = await tx`select numero from public.obras where artista_id = ${artistaId} order by numero limit 1`;
        if (suya) {
          hechos.yaTenianObra.push(`${nombre} (cargada como N° ${suya.numero}; en el catálogo es la N° ${numero})`);
          continue;
        }
      }
      const [obra] = await tx`select id from public.obras where numero = ${numero}`;
      if (obra) {
        hechos.obrasSalteadas.push(numero);
        continue;
      }
      hechos.obrasNuevas++;
      if (soloVer) continue;
      await tx`
        insert into public.obras (
          numero, titulo, artista_id, resena, tecnica,
          alto_cm, ancho_cm, profundidad_cm, medidas_aproximadas, publicada
        ) values (
          ${numero}, ${datos.titulo ?? null}, ${artistaId}, ${datos.resena ?? ""}, ${datos.tecnica ?? null},
          ${datos.altoCm ?? null}, ${datos.anchoCm ?? null}, ${datos.profundidadCm ?? null},
          ${datos.medidasAproximadas ?? false}, false
        )`;
    }
    return hechos;
  });

  const accion = soloVer ? "Se cargarían" : "Cargados";
  console.log(`${accion}: ${resumen.artistasNuevos} artistas nuevos y ${resumen.obrasNuevas} obras (sin publicar).`);
  if (resumen.artistasExistentes) console.log(`Artistas que ya estaban: ${resumen.artistasExistentes} (se reutilizan).`);
  for (const aviso of resumen.yaTenianObra) console.log(`Ya tenía su obra, no se creó otra: ${aviso}.`);
  if (resumen.obrasSalteadas.length) {
    console.log(`Obras que ya existían y no se tocaron: N° ${resumen.obrasSalteadas.join(", ")}.`);
  }
} catch (e) {
  console.error(`No se pudo cargar el catálogo: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
