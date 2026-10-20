-- Muestra "Memorias del futuro" (datos de la Dirección de Cementerios, 20/10/2026, en borrador).
-- Textos PROVISORIOS: siguen marcados como provisorios hasta tener el OK de los contenidos.
-- Cada texto se cambia solo si sigue igual al original de 20261019120300_contenidos.sql
-- (si el equipo ya lo editó desde el panel, se respeta). Los \r se ignoran de los dos lados.

-- Portada: nombre de la muestra y texto del folleto (borrador).
update public.paginas
set titulo = $tit$Memorias del futuro$tit$,
    contenido = replace($txt$Artistas en diálogo con el patrimonio. Veinticinco artistas contemporáneos transformaron un conjunto de cabezas de yeso conservadas durante años. Las obras se exhiben en el Cementerio del Oeste desde el 31 de octubre, en la 19.ª Noche de los Museos.

La muestra nace del trabajo de la Dirección de Cementerios de la Municipalidad de San Miguel de Tucumán, en articulación con el proyecto PIUNT C/708 «Patrimonio artístico y museología» de la Facultad de Artes de la Universidad Nacional de Tucumán. Los artistas participan de manera desinteresada.

Una misma forma inicial se multiplica en interpretaciones diversas. Exhibidas en el Cementerio del Oeste, las intervenciones dialogan con sus esculturas, su arquitectura, sus símbolos y sus memorias.

Mientras dura la exhibición podés ofertar por cada obra desde este sitio. La oferta más alta de cada obra será el precio base de la subasta presencial, con martillero.

Lo recaudado será destinado al **Cottolengo Don Orione**.$txt$, E'\r', '')
where slug = 'portada'
  and titulo = $tit$Subasta solidaria del Cementerio del Oeste$tit$
  and replace(contenido, E'\r', '') = replace($txt$La Dirección de Cementerios, junto con la Facultad de Artes, entregó 25 cabezas escultóricas a 25 artistas locales, que las intervinieron sin cobrar. Las obras se exhiben sobre el camino principal del Cementerio del Oeste desde la Noche de los Museos.

Mientras dura la exhibición podés ofertar por cada obra desde este sitio. La oferta más alta de cada obra será el precio base de la subasta presencial, con martillero.

Lo recaudado tendrá un destino solidario.$txt$, E'\r', '');

-- Destino de lo recaudado: Cottolengo Don Orione. El modo de pago sigue pendiente.
update public.paginas
set titulo = $tit$Destino de lo recaudado$tit$,
    contenido = replace($txt$Lo recaudado en la subasta de las obras de «Memorias del futuro» será destinado al **Cottolengo Don Orione**.

La plataforma no cobra ni procesa pagos. **Pendiente:** cómo, cuándo y a quién se paga, a definir por la Dirección de Cementerios.$txt$, E'\r', '')
where slug = 'destino'
  and titulo = $tit$Destino de lo recaudado$tit$
  and replace(contenido, E'\r', '') = replace($txt$Lo recaudado tendrá un destino solidario.

**El destino todavía no está definido.** Cuando la Dirección de Cementerios lo confirme, lo vas a encontrar en esta página.$txt$, E'\r', '');

-- Bases: el destino de lo recaudado ya no figura entre los puntos a definir.
update public.paginas
set titulo = $tit$Bases y condiciones$tit$,
    contenido = replace($txt$> **Texto pendiente.** Las bases y condiciones las redactan y aprueban la Dirección de Cementerios y el área legal de la Municipalidad. Este sitio no define condiciones legales.

## Puntos a definir
- Encuadre legal de la subasta.
- Si la oferta virtual es vinculante.
- Quién cobra, cómo y en qué plazo.
- Requisitos para participar en la subasta presencial.

## Cómo funciona la plataforma
- Registra ofertas entre la fecha de inicio y la de cierre publicadas en el sitio. La hora de cierre la controla el servidor.
- Cada oferta tiene que superar la anterior por lo menos en el incremento mínimo.
- Las ofertas no se pueden editar ni borrar. La Dirección puede anular una oferta indicando el motivo, y la anulación queda registrada.
- La plataforma no cobra ni procesa pagos.$txt$, E'\r', '')
where slug = 'bases-y-condiciones'
  and titulo = $tit$Bases y condiciones$tit$
  and replace(contenido, E'\r', '') = replace($txt$> **Texto pendiente.** Las bases y condiciones las redactan y aprueban la Dirección de Cementerios y el área legal de la Municipalidad. Este sitio no define condiciones legales.

## Puntos a definir
- Encuadre legal de la subasta.
- Si la oferta virtual es vinculante.
- Quién cobra, cómo y en qué plazo.
- Requisitos para participar en la subasta presencial.
- Destino de lo recaudado.

## Cómo funciona la plataforma
- Registra ofertas entre la fecha de inicio y la de cierre publicadas en el sitio. La hora de cierre la controla el servidor.
- Cada oferta tiene que superar la anterior por lo menos en el incremento mínimo.
- Las ofertas no se pueden editar ni borrar. La Dirección puede anular una oferta indicando el motivo, y la anulación queda registrada.
- La plataforma no cobra ni procesa pagos.$txt$, E'\r', '');

-- Fechas por defecto de la etapa virtual: del 31/10 (19.ª Noche de los Museos) al 14/11, a las
-- 20 h como referencia. Siguen SIN confirmar: el sitio no acepta ofertas hasta que el equipo las
-- confirme desde Configuración. Solo cambia si nadie tocó todavía los valores iniciales.
update public.configuracion
set inicio_virtual = '2026-10-31 20:00:00-03',
    cierre_virtual = '2026-11-14 20:00:00-03'
where id = 1
  and not fechas_confirmadas
  and inicio_virtual = '2026-11-01 20:00:00-03'
  and cierre_virtual = '2026-11-15 20:00:00-03';
