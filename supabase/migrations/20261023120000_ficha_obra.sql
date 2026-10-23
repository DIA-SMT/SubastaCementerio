-- Ficha de cada obra con los datos que entrega cada artista (Dirección de Cementerios, 23/10/2026):
-- título, artista, técnica y materiales, medidas, memoria conceptual e Instagram.
--
-- 1. Medidas de la obra en centímetros (alto, ancho y profundidad), con un decimal, y si son
--    aproximadas. Van en números, no en texto libre, para mostrarlas siempre igual en el sitio.
-- 2. Instagram del artista: solo el nombre de usuario, sin @ ni dirección (el sitio arma el
--    enlace). El campo "enlace" queda para otra página del artista.
-- La técnica pasa a llamarse "Técnica y materiales" y la reseña de la obra, "Memoria
-- conceptual": cambian solo los rótulos, no las columnas.

alter table public.obras
  add column alto_cm numeric(6, 1) constraint obras_alto_cm_rango check (alto_cm > 0 and alto_cm < 10000),
  add column ancho_cm numeric(6, 1) constraint obras_ancho_cm_rango check (ancho_cm > 0 and ancho_cm < 10000),
  add column profundidad_cm numeric(6, 1)
    constraint obras_profundidad_cm_rango check (profundidad_cm > 0 and profundidad_cm < 10000),
  add column medidas_aproximadas boolean not null default false,
  -- La profundidad puede faltar (obra plana); alto y ancho van juntos.
  add constraint obras_medidas_completas check (
    (alto_cm is null) = (ancho_cm is null) and (profundidad_cm is null or alto_cm is not null)
  );

alter table public.artistas
  add column instagram text
    constraint artistas_instagram_usuario check (instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- Obras publicadas: se agregan al final las medidas y el Instagram del artista
-- (create or replace view solo permite agregar columnas al final y conserva los permisos).
create or replace view public.v_obras_publicas as
select
  ob.id,
  ob.numero,
  ob.titulo,
  ob.resena,
  ob.tecnica,
  ob.es_ejemplo,
  ar.id as artista_id,
  ar.nombre as artista_nombre,
  ar.resena as artista_resena,
  ar.enlace as artista_enlace,
  coalesce(ob.precio_salida, c.precio_salida) as precio_salida,
  mo.monto as oferta_actual,
  mo.creada_at as oferta_actual_at,
  ofe.alias_numero as oferta_actual_alias,
  coalesce(mo.oferente_id = auth.uid(), false) as oferta_actual_es_mia,
  coalesce(cnt.cantidad, 0) as cantidad_ofertas,
  case
    when mo.monto is null then coalesce(ob.precio_salida, c.precio_salida)
    else mo.monto + c.incremento_minimo
  end as minimo_siguiente,
  foto.ruta as portada_ruta,
  foto.texto_alternativo as portada_alt,
  foto.ancho as portada_ancho,
  foto.alto as portada_alto,
  ar.foto_ruta as artista_foto_ruta,
  cie.cierre,
  case
    when not c.fechas_confirmadas then 'por_confirmar'
    when now() < c.inicio_virtual then 'antes'
    when now() < cie.cierre then 'abierta'
    else 'cerrada'
  end as fase,
  ob.alto_cm,
  ob.ancho_cm,
  ob.profundidad_cm,
  ob.medidas_aproximadas,
  ar.instagram as artista_instagram
from public.obras ob
join public.artistas ar on ar.id = ob.artista_id
join public.configuracion c on c.id = 1
left join public.v_mejor_oferta mo on mo.obra_id = ob.id
left join public.oferentes ofe on ofe.id = mo.oferente_id
left join lateral (
  select count(*)::integer as cantidad
  from public.v_ofertas_vigentes v
  where v.obra_id = ob.id
) cnt on true
left join lateral (
  select f.ruta, f.texto_alternativo, f.ancho, f.alto
  from public.obra_fotos f
  where f.obra_id = ob.id
  order by f.orden, f.creado_at
  limit 1
) foto on true
cross join lateral (
  select public.cierre_con_extension(
    c.cierre_virtual, c.extension_activa, c.extension_minutos,
    (select max(o.creada_at) from public.ofertas o where o.obra_id = ob.id)
  ) as cierre
) cie
where ob.publicada;
