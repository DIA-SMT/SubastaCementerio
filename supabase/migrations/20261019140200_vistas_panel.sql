-- Vistas del panel: el bloqueo del oferente queda a la vista.
-- Bloquear a una persona no anula sus ofertas (decisión de diseño): sus ofertas válidas
-- siguen contando y pueden ser el precio base del listado final. Estas columnas permiten
-- marcarlas en la exportación y en las pantallas de ofertas para que el equipo las revise.
-- create or replace view solo permite agregar columnas al final y conserva los permisos.

-- 1. Ofertas del panel: si quien ofertó está bloqueado.
create or replace view public.v_ofertas_admin as
select
  o.id,
  o.obra_id,
  ob.numero,
  ob.titulo,
  ar.nombre as artista_nombre,
  o.oferente_id,
  ofe.alias_numero,
  ofe.nombre,
  ofe.apellido,
  ofe.dni,
  ofe.telefono,
  ofe.email,
  o.monto,
  o.creada_at,
  o.estado,
  o.anulada_at,
  o.motivo_anulacion,
  adm.nombre as anulada_por_nombre,
  coalesce(mo.oferta_id = o.id, false) as es_la_mas_alta,
  ofe.bloqueado
from public.ofertas o
join public.obras ob on ob.id = o.obra_id
join public.artistas ar on ar.id = ob.artista_id
join public.oferentes ofe on ofe.id = o.oferente_id
left join public.admins adm on adm.user_id = o.anulada_por
left join public.v_mejor_oferta mo on mo.obra_id = o.obra_id
where public.es_admin();

-- 2. Listado final: si quien tiene la mayor oferta está bloqueado (false si no hay ofertas).
create or replace view public.v_listado_final as
select
  ob.id as obra_id,
  ob.numero,
  ob.titulo,
  ar.nombre as artista_nombre,
  ob.publicada,
  coalesce(ob.precio_salida, c.precio_salida) as precio_salida,
  mo.monto as precio_base,
  mo.creada_at as oferta_at,
  ofe.alias_numero,
  ofe.nombre,
  ofe.apellido,
  ofe.dni,
  ofe.telefono,
  ofe.email,
  coalesce(cnt.cantidad, 0) as cantidad_ofertas,
  coalesce(ofe.bloqueado, false) as bloqueado
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
where public.es_admin();
