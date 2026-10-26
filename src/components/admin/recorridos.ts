// Pasos de los recorridos guiados del panel. `elemento` es un selector CSS: casi todos usan lo
// que ya está en las pantallas (las tablas se buscan por su etiqueta, las tarjetas por su
// título en data-recorrido, los campos por su id). Si el elemento no aparece, el paso se
// muestra centrado; con `soloConElemento`, se saltea.

export type Paso = {
  titulo: string;
  texto: string;
  elemento?: string;
  soloConElemento?: boolean;
};
export type Recorrido = { clave: string; nombre: string; pasos: Paso[] };

const tarjeta = (titulo: string) => `[data-recorrido="${titulo}"]`;
const tabla = (etiqueta: string) => `[role="region"][aria-label="${etiqueta}"]`;
const seccion = (idTitulo: string) => `[aria-labelledby="${idTitulo}"]`;
const menu = (href: string) => `[data-recorrido="menu"] a[href="${href}"]`;

const AYUDA: Paso = {
  titulo: "Si tenés dudas",
  texto: "«Cómo se usa» explica la pantalla en la que estés. Desde el tablero vuelve a mostrar este recorrido.",
  elemento: '[data-recorrido="ayuda"]',
};

const GENERAL: Recorrido = {
  clave: "general",
  nombre: "Recorrido del panel",
  pasos: [
    {
      titulo: "Te damos la bienvenida al panel",
      texto:
        "Desde acá el equipo carga las obras, sigue las ofertas y prepara el listado para la subasta presencial. Son unos pocos pasos; podés salir cuando quieras con Escape.",
    },
    {
      titulo: "El menú",
      texto:
        "Cada sección del panel está acá. En la computadora se puede plegar con la flecha de arriba; en el celular se abre con el botón «Menú».",
      elemento: '[data-recorrido="menu"]',
    },
    {
      titulo: "Tablero",
      texto: "El estado de la etapa virtual, los números de la subasta y las últimas ofertas.",
      elemento: menu("/admin"),
      soloConElemento: true,
    },
    {
      titulo: "Obras",
      texto:
        "Cargá cada obra con su foto, técnica y materiales, medidas y memoria conceptual. Solo las publicadas se ven en el sitio.",
      elemento: menu("/admin/obras"),
      soloConElemento: true,
    },
    {
      titulo: "Artistas",
      texto: "Nombre, Instagram y, si querés, una reseña y una foto. Cada obra se asigna a un artista.",
      elemento: menu("/admin/artistas"),
      soloConElemento: true,
    },
    {
      titulo: "Ofertas",
      texto: "Todas las ofertas, con filtros. Una oferta no se edita ni se borra: se puede anular indicando el motivo.",
      elemento: menu("/admin/ofertas"),
      soloConElemento: true,
    },
    {
      titulo: "Oferentes",
      texto:
        "Las personas registradas y sus datos de contacto. Se puede bloquear a alguien para que no haga nuevas ofertas.",
      elemento: menu("/admin/oferentes"),
      soloConElemento: true,
    },
    {
      titulo: "Configuración",
      texto:
        "Fechas de la etapa virtual y de la subasta presencial, incremento mínimo, precio de salida y extensión del cierre.",
      elemento: menu("/admin/configuracion"),
      soloConElemento: true,
    },
    {
      titulo: "Textos",
      texto: "Portada, cómo participar, bases y condiciones, destino de lo recaudado y privacidad.",
      elemento: menu("/admin/textos"),
      soloConElemento: true,
    },
    {
      titulo: "Listado final",
      texto:
        "La planilla y el PDF con el precio base de cada obra para el martillero. Tiene datos personales: se descarga solo desde acá.",
      elemento: menu("/admin/exportar"),
      soloConElemento: true,
    },
    {
      titulo: "Carteles QR",
      texto: "Los carteles para imprimir y poner junto a cada obra: el código lleva a su ficha en el sitio.",
      elemento: menu("/admin/qr"),
      soloConElemento: true,
    },
    {
      titulo: "Auditoría",
      texto: "Quién cambió qué y cuándo. El registro no se puede editar ni borrar.",
      elemento: menu("/admin/auditoria"),
      soloConElemento: true,
    },
    {
      titulo: "Estado de la etapa virtual",
      texto:
        "Si la subasta está abierta, cuánto falta para el cierre y los montos configurados. Las fechas se cambian en Configuración.",
      elemento: tarjeta("Estado de la etapa virtual"),
    },
    {
      titulo: "Indicadores",
      texto:
        "Monto acumulado, ofertas válidas, oferentes registrados y cuántas obras tienen ofertas. Se calculan cada vez que abrís la página.",
      elemento: seccion("titulo-indicadores"),
    },
    {
      titulo: "Últimas ofertas",
      texto: "Las más recientes de todas las obras, con quién ofertó. El listado completo está en Ofertas.",
      elemento: seccion("titulo-ultimas"),
    },
    AYUDA,
  ],
};

const RECORRIDOS: { patron: RegExp; recorrido: Recorrido }[] = [
  { patron: /^\/admin$/, recorrido: GENERAL },
  {
    patron: /^\/admin\/obras$/,
    recorrido: {
      clave: "obras",
      nombre: "Obras",
      pasos: [
        {
          titulo: "Cargar una obra",
          texto:
            "Con «Nueva obra» cargás los datos y la foto principal. El número es el del cartel y el de la dirección /obras/N.",
          elemento: '[data-recorrido="acciones"]',
        },
        {
          titulo: "Listado de obras",
          texto:
            "Cada fila muestra la portada, si la obra está publicada, la oferta actual y cuántas ofertas válidas tiene. Entrá a una para editarla.",
          elemento: tabla("Listado de obras"),
        },
        {
          titulo: "Publicar",
          texto:
            "Una obra se ve en el sitio y recibe ofertas solo si está publicada. Despublicar una obra con ofertas pide una confirmación.",
        },
      ],
    },
  },
  {
    patron: /^\/admin\/obras\/nueva$/,
    recorrido: {
      clave: "obra-nueva",
      nombre: "Nueva obra",
      pasos: [
        {
          titulo: "Número y título",
          texto: "El número va del 1 al 999 y es el del cartel con el QR. Sin título, el sitio muestra «Sin título».",
          elemento: "#numero",
        },
        {
          titulo: "Artista",
          texto: "Elegí el artista de la lista. Si no está, cargalo primero en Artistas.",
          elemento: "#artista_id",
        },
        {
          titulo: "Foto principal",
          texto:
            "Es la portada en el catálogo. Se achica antes de subirla. Escribí también el texto alternativo: lo leen quienes usan lector de pantalla.",
          elemento: "#foto",
        },
        {
          titulo: "Medidas",
          texto: "En centímetros: alto, ancho y profundidad. Si llegan en metros, multiplicá por 100.",
          elemento: 'fieldset[aria-describedby="medidas-ayuda"]',
        },
        {
          titulo: "Memoria conceptual",
          texto:
            "El texto del artista sobre la obra, de 60 a 100 palabras. El contador avisa si se pasa, pero deja guardar igual.",
          elemento: "#resena",
        },
        {
          titulo: "Publicada",
          texto: "Marcala cuando la obra esté completa. Mientras no esté publicada, no se ve en el sitio.",
          elemento: 'input[name="publicada"]',
        },
      ],
    },
  },
  {
    patron: /^\/admin\/obras\/[^/]+$/,
    recorrido: {
      clave: "obra",
      nombre: "Obra",
      pasos: [
        {
          titulo: "Datos de la obra",
          texto:
            "Título, artista, técnica y materiales, medidas, memoria conceptual, precio de salida propio y si está publicada.",
          elemento: tarjeta("Datos de la obra"),
        },
        {
          titulo: "Fotos",
          texto:
            "La primera de la lista es la portada. Podés cambiar el orden, editar el texto alternativo o quitar una foto.",
          elemento: tarjeta("Fotos"),
        },
        {
          titulo: "Ofertas de la obra",
          texto: "Desde acá ves todas sus ofertas y, si hace falta, anulás una con el motivo.",
          elemento: '[data-recorrido="acciones"]',
        },
        {
          titulo: "Borrar",
          texto: "Solo se puede borrar una obra sin ofertas registradas. Si tiene ofertas, despublicala.",
          elemento: tarjeta("Borrar la obra"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/obras\/[^/]+\/ofertas$/,
    recorrido: {
      clave: "obra-ofertas",
      nombre: "Ofertas de la obra",
      pasos: [
        {
          titulo: "Todas las ofertas",
          texto: "De mayor a menor monto, también las anuladas. La primera válida es la oferta actual.",
          elemento: tabla("Ofertas de la obra, de mayor a menor monto"),
        },
        {
          titulo: "Anular una oferta",
          texto:
            "Elegí la oferta y escribí el motivo. La oferta no se borra: queda anulada y registrada en la auditoría.",
          elemento: seccion("titulo-anular"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/artistas$/,
    recorrido: {
      clave: "artistas",
      nombre: "Artistas",
      pasos: [
        {
          titulo: "Cargar un artista",
          texto: "Nombre (o nombre artístico) e Instagram. La reseña, la foto y otro enlace son opcionales.",
          elemento: '[data-recorrido="acciones"]',
        },
        {
          titulo: "Listado",
          texto: "Cada artista con sus obras. Entrá para editarlo.",
          elemento: tabla("Listado de artistas"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/artistas\/[^/]+$/,
    recorrido: {
      clave: "artista",
      nombre: "Artista",
      pasos: [
        {
          titulo: "Datos del artista",
          texto: "En Instagram podés pegar el @usuario o la dirección del perfil: se guarda solo el usuario.",
          elemento: `${tarjeta("Datos del artista")}, form:has(#nombre)`,
        },
        {
          titulo: "Foto",
          texto: "Opcional. Se muestra junto a sus datos en la ficha de la obra.",
          elemento: tarjeta("Foto del artista (opcional)"),
        },
        {
          titulo: "Sus obras",
          texto: "Las obras asignadas. Un artista con obras no se puede borrar.",
          elemento: tarjeta("Obras"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/ofertas$/,
    recorrido: {
      clave: "ofertas",
      nombre: "Ofertas",
      pasos: [
        {
          titulo: "Filtros",
          texto: "Filtrá por obra o por estado (válidas o anuladas).",
          elemento: 'form[action="/admin/ofertas"]',
        },
        {
          titulo: "Listado",
          texto: "Monto, quién ofertó y cuándo. Para anular una oferta, entrá a las ofertas de su obra.",
          elemento: tabla("Últimas ofertas"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/oferentes$/,
    recorrido: {
      clave: "oferentes",
      nombre: "Oferentes",
      pasos: [
        {
          titulo: "Buscar",
          texto: "Por DNI o por correo. La búsqueda no queda en la dirección del navegador.",
          elemento: 'form[aria-label="Buscar oferentes"]',
        },
        {
          titulo: "Listado",
          texto: "Las personas registradas. Sus datos son personales (Ley 25.326): no se comparten fuera del equipo.",
          elemento: tabla("Oferentes"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/oferentes\/[^/]+$/,
    recorrido: {
      clave: "oferente",
      nombre: "Oferente",
      pasos: [
        {
          titulo: "Datos",
          texto: "Datos de contacto y la versión de las bases que aceptó.",
          elemento: tarjeta("Datos"),
        },
        {
          titulo: "Bloquear",
          texto:
            "Impide nuevas ofertas, con un motivo. No anula las que ya hizo: si hace falta, anulalas desde cada obra.",
          elemento: `${tarjeta("Bloquear")}, ${tarjeta("Cuenta bloqueada")}`,
        },
        {
          titulo: "Sus ofertas",
          texto: "Todas las ofertas de la persona, en todas las obras.",
          elemento: seccion("titulo-ofertas"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/configuracion$/,
    recorrido: {
      clave: "configuracion",
      nombre: "Configuración",
      pasos: [
        {
          titulo: "Estado de la subasta",
          texto: "Si está abierta y cuándo cierra, según la hora del servidor.",
          elemento: tarjeta("Estado de la subasta"),
        },
        {
          titulo: "Etapa virtual",
          texto:
            "Inicio, cierre y «Las fechas están confirmadas». Sin esa casilla, el sitio muestra «Fechas a confirmar» y no acepta ofertas.",
          elemento: tarjeta("Etapa virtual"),
        },
        {
          titulo: "Extensión del cierre",
          texto:
            "Si está activa, una oferta en los últimos minutos extiende el cierre de esa obra. Pasada la hora de cierre ya no se puede cambiar.",
          elemento: tarjeta("Extensión del cierre"),
        },
        {
          titulo: "Montos",
          texto: "Incremento mínimo entre ofertas y precio de salida general.",
          elemento: tarjeta("Montos"),
        },
        {
          titulo: "Cambios delicados",
          texto:
            "Adelantar el cierre, reabrir la etapa o desmarcar las fechas piden una confirmación extra. Todo queda en la auditoría.",
          elemento: tarjeta("Antes de cambiar algo"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/textos$/,
    recorrido: {
      clave: "textos",
      nombre: "Textos",
      pasos: [
        {
          titulo: "Textos del sitio",
          texto:
            "Portada, cómo participar, bases y condiciones, destino y privacidad. Los provisorios se marcan así en el sitio.",
          elemento: tabla("Textos del sitio"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/textos\/[^/]+$/,
    recorrido: {
      clave: "texto",
      nombre: "Editar un texto",
      pasos: [
        {
          titulo: "Contenido",
          texto: "El texto que se publica. Dejá una línea en blanco entre párrafos.",
          elemento: "#contenido",
        },
        {
          titulo: "Provisorio",
          texto: "Mientras esté marcado, el sitio avisa que el texto es provisorio.",
          elemento: "#provisorio",
        },
        {
          titulo: "Vista previa",
          texto: "Así se va a ver en el sitio antes de guardar.",
          elemento: seccion("vista-previa"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/exportar$/,
    recorrido: {
      clave: "exportar",
      nombre: "Listado final",
      pasos: [
        {
          titulo: "Descargas",
          texto: "La planilla (Excel) y el PDF. Antes del cierre salen marcados como PRELIMINAR; después, como FINAL.",
          elemento: '[data-recorrido="acciones"]',
        },
        {
          titulo: "Etapa virtual",
          texto: "Cuándo cierra o cerró la etapa virtual.",
          elemento: tarjeta("Etapa virtual"),
        },
        {
          titulo: "Vista previa",
          texto:
            "Lo mismo que trae el archivo: obra, precio base y datos de contacto de quien tiene la oferta más alta.",
          elemento: seccion("titulo-vista-previa"),
        },
      ],
    },
  },
  {
    patron: /^\/admin\/qr$/,
    recorrido: {
      clave: "qr",
      nombre: "Carteles QR",
      pasos: [
        {
          titulo: "Imprimir todos",
          texto: "Un PDF con un cartel por obra publicada.",
          elemento: 'a[href="/admin/qr/pdf"]',
        },
        {
          titulo: "Cada código",
          texto: "Lleva a la ficha de la obra en el sitio. También se puede descargar uno por uno.",
          elemento: '[aria-label="Códigos QR de las obras"]',
        },
      ],
    },
  },
  {
    patron: /^\/admin\/auditoria$/,
    recorrido: {
      clave: "auditoria",
      nombre: "Auditoría",
      pasos: [
        {
          titulo: "Filtros",
          texto: "Por tabla (obras, ofertas, configuración…), por acción y por fechas.",
          elemento: '[aria-label="Filtros"]',
        },
        {
          titulo: "Registro",
          texto: "Cada cambio con su fecha, quién lo hizo y qué cambió. No se puede editar ni borrar.",
          elemento: tabla("Registro de auditoría"),
        },
      ],
    },
  },
];

/** Recorrido de la pantalla (por su ruta); si la pantalla no tiene uno propio, el general. */
export function recorridoPara(ruta: string): Recorrido {
  const sinBarra = ruta.replace(/\/+$/, "") || "/";
  return RECORRIDOS.find((r) => r.patron.test(sinBarra))?.recorrido ?? GENERAL;
}
