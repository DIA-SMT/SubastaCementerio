-- Mis ofertas: indica si la obra sigue publicada.
-- Despublicar una obra la retira de la subasta (no figura en el catálogo ni en el listado
-- final). La persona conserva el historial de sus ofertas, pero la pantalla tiene que
-- mostrar que la obra ya no está en la subasta en lugar de "Tenés la oferta más alta".
-- create or replace view solo permite agregar columnas al final y conserva los permisos
-- (grant select ... to authenticated, en 20261019120200_permisos.sql).
create or replace view public.v_mis_ofertas as
select
  o.id,
  o.obra_id,
  ob.numero,
  ob.titulo,
  ar.nombre as artista_nombre,
  o.monto,
  o.creada_at,
  o.estado,
  coalesce(mo.oferta_id = o.id, false) as es_la_mas_alta,
  mo.monto as oferta_actual,
  ob.publicada
from public.ofertas o
join public.obras ob on ob.id = o.obra_id
join public.artistas ar on ar.id = ob.artista_id
left join public.v_mejor_oferta mo on mo.obra_id = o.obra_id
where o.oferente_id = auth.uid();
