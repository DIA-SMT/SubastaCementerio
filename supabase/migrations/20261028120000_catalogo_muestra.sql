-- Catálogo oficial de "Memorias del futuro" (versión de imprenta, 28/10/2026).
--
-- 1. Nueva página editable "La muestra" (/la-muestra): presentación de la Intendenta, texto
--    curatorial, las 24 obras con su artista (numeradas como en el catálogo) y los créditos.
--    Queda marcada como provisoria hasta que el equipo la confirme desde el panel.
-- 2. Portada: son 24 obras (no 25) y enlaza a "La muestra". Se cambia solo si sigue igual al
--    texto de 20261020120000_muestra.sql (si el equipo ya la editó, se respeta).

alter table public.paginas drop constraint paginas_slug_check;
alter table public.paginas add constraint paginas_slug_check check (
  slug in ('portada', 'como-participar', 'bases-y-condiciones', 'destino', 'privacidad', 'la-muestra')
);

insert into public.paginas (slug, titulo, contenido, provisorio)
values (
  'la-muestra',
  $tit$La muestra$tit$,
  $txt$## Presentación

El patrimonio es uno de los ejes de nuestra gestión porque allí se expresa una parte esencial de la memoria y la identidad de San Miguel de Tucumán. En ese marco, el Cementerio del Oeste constituye un espacio de enorme valor histórico, artístico y cultural, que buscamos preservar, recuperar y acercar a la comunidad a través de nuevas formas de encuentro y conocimiento.

**Memorias del futuro. Artistas en diálogo con el patrimonio** nace de esa mirada y del trabajo impulsado desde la Dirección de Cementerios de la Municipalidad de San Miguel de Tucumán, en articulación con el proyecto PIUNT C/708 de la Facultad de Artes de la Universidad Nacional de Tucumán. La propuesta reúne a referentes de reconocida trayectoria que participan de manera desinteresada, aportando su trabajo y su sensibilidad para intervenir estas piezas y establecer, desde el arte contemporáneo, un diálogo con la historia, las esculturas y el paisaje patrimonial del Cementerio del Oeste.

Agradecemos especialmente la generosidad de quienes aceptaron formar parte de esta iniciativa y el compromiso de quienes, desde el ámbito municipal y universitario, hacen posible este encuentro. A su dimensión cultural se suma además un propósito solidario: las obras serán posteriormente subastadas y lo recaudado será destinado al Cottolengo Don Orione.

Proteger nuestro patrimonio también significa mantenerlo vivo, abrirlo a nuevas miradas y convertirlo en un espacio de participación, creación y compromiso con la comunidad.

**Dra. Rossana Chahla**, Intendenta de San Miguel de Tucumán.

## Sobre la muestra

**Memorias del futuro. Artistas en diálogo con el patrimonio** parte de una operación concreta: recuperar un conjunto de cabezas de yeso preexistentes, conservadas durante años, y proponer su transformación a partir de la mirada de veinticuatro artistas contemporáneos.

La muestra se articula con el **Proyecto PIUNT C/708 «Patrimonio artístico y museología. Las escenas artísticas, la escultura y el arte urbano en Tucumán»**, de la Facultad de Artes de la Universidad Nacional de Tucumán, y propone reflexionar sobre la capacidad del arte contemporáneo para activar nuevas lecturas del patrimonio.

Una misma forma inicial se multiplica en interpretaciones diversas. Materia, color, gesto y relato convierten cada pieza en una nueva obra, en una tensión entre permanencia y transformación. Exhibidas en el **Cementerio del Oeste**, las intervenciones dialogan con sus esculturas, arquitectura, símbolos y memorias, entendiendo el patrimonio no como una realidad inmóvil, sino como una construcción viva, susceptible de ser revisitada y resignificada.

Las veinticuatro obras conforman así una constelación de miradas sobre una forma común: distintas maneras de interrogar la memoria y proyectarla hacia el futuro.

## Artistas

Obras numeradas en orden alfabético, como en el catálogo de la muestra.

- 01. Silvia Leonor Agüero
- 02. Claudia Albarracín
- 03. Alejandro Contreras Moiraghi
- 04. Eugenia Correa
- 05. Rubén Giménez
- 06. Alejandro Gómez Tolosa
- 07. Elba Gramajo
- 08. Mane Guantay
- 09. Eduardo Joaquín
- 10. Rubén Kempa
- 11. Néstor Mercado
- 12. Natalia Morel
- 13. Jessica Ivana Morillo
- 14. Sandro Pereira
- 15. Elena Requelme
- 16. Pablo Iván Ríos
- 17. María de la Paz Risso Patrón
- 18. Sol Rodríguez Díaz
- 19. Marisa Rossini
- 20. Juliet Ruiz
- 21. Ana Singh
- 22. Mónica Vallejo
- 23. María Silvina Vera
- 24. Ariel Xamena

## Créditos

### Municipalidad de San Miguel de Tucumán
- Intendenta de San Miguel de Tucumán: **Dra. Rossana Chahla**
- Secretaria de Gobierno: **Mg. Camila Giuliano**
- Secretario General: **Dr. Rodrigo Gómez Tortosa**
- Secretario de Servicios Públicos: **Luciano Chincarini**
- Subsecretaria de Cultura: **Ana Lía Carbonell**
- Director de Cementerios: **Arq. Humberto Salazar**

### Facultad de Artes, Universidad Nacional de Tucumán
- Decana de la Facultad de Artes: **Dra. Silvia Leonor Agüero**
- Coordinadores del Proyecto PIUNT C/708: **Mg. Lic. Elba Gramajo**, **Lic. Natalia Morel**, **Lic. Ariel Xamena**, **Die. Julio Magli**, **Lic. M. Silvina Vera** y **Lic. Rodrigo Aredes Leiva**

### Curaduría
- **Die. Julio Magli** y **Lic. M. Silvina Vera**

### Soportes escultóricos
Cabezas de yeso macizo a escala natural, realizadas por Stella Maris Llanos y Jacob Paz (alumnos pasantes).$txt$,
  true
)
on conflict (slug) do nothing;

-- Portada: 24 obras, con el texto del catálogo, y el enlace a "La muestra".
update public.paginas
set contenido = replace($txt$Artistas en diálogo con el patrimonio. Veinticuatro artistas contemporáneos transformaron un conjunto de cabezas de yeso preexistentes, conservadas durante años. Las obras se exhiben en el Cementerio del Oeste desde el 31 de octubre, en la 19.ª Noche de los Museos.

La muestra nace del trabajo de la Dirección de Cementerios de la Municipalidad de San Miguel de Tucumán, en articulación con el proyecto PIUNT C/708 «Patrimonio artístico y museología» de la Facultad de Artes de la Universidad Nacional de Tucumán. Los artistas participan de manera desinteresada.

Una misma forma inicial se multiplica en interpretaciones diversas. Exhibidas en el Cementerio del Oeste, las intervenciones dialogan con sus esculturas, su arquitectura, sus símbolos y sus memorias.

Mientras dura la exhibición podés ofertar por cada obra desde este sitio. La oferta más alta de cada obra será el precio base de la subasta presencial, con martillero.

Lo recaudado será destinado al **Cottolengo Don Orione**.

En [La muestra](/la-muestra) están la presentación, el texto curatorial, los artistas y los créditos.$txt$, E'\r', '')
where slug = 'portada'
  and replace(contenido, E'\r', '') = replace($txt$Artistas en diálogo con el patrimonio. Veinticinco artistas contemporáneos transformaron un conjunto de cabezas de yeso conservadas durante años. Las obras se exhiben en el Cementerio del Oeste desde el 31 de octubre, en la 19.ª Noche de los Museos.

La muestra nace del trabajo de la Dirección de Cementerios de la Municipalidad de San Miguel de Tucumán, en articulación con el proyecto PIUNT C/708 «Patrimonio artístico y museología» de la Facultad de Artes de la Universidad Nacional de Tucumán. Los artistas participan de manera desinteresada.

Una misma forma inicial se multiplica en interpretaciones diversas. Exhibidas en el Cementerio del Oeste, las intervenciones dialogan con sus esculturas, su arquitectura, sus símbolos y sus memorias.

Mientras dura la exhibición podés ofertar por cada obra desde este sitio. La oferta más alta de cada obra será el precio base de la subasta presencial, con martillero.

Lo recaudado será destinado al **Cottolengo Don Orione**.$txt$, E'\r', '');
