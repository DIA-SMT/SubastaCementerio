-- Ajustes surgidos al construir el panel.

-- 1. La versión de un texto solo la sube el disparador: no se puede fijar a mano.
--    (Las bases aceptadas por cada oferente guardan esta versión.)
create or replace function public.versionar_pagina() returns trigger
language plpgsql as $$
begin
  if new.titulo is distinct from old.titulo or new.contenido is distinct from old.contenido then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  new.actualizada_at := now();
  new.actualizada_por := auth.uid();
  return new;
end $$;

-- 2. Los avisos "te superaron" no salen si la persona desactivó los avisos o si, antes del
--    envío, volvió a tener la oferta más alta de esa obra. Si la vuelven a superar, el aviso
--    pendiente se habilita solo (ofertar() no crea un segundo aviso pendiente).
create or replace function public.avisos_para_enviar(p_limite integer default 20)
returns table (
  aviso_id bigint,
  email text,
  nombre text,
  obra_numero smallint,
  obra_titulo text,
  artista_nombre text,
  oferta_actual integer,
  minimo_siguiente integer,
  cierre_virtual timestamptz
)
language sql stable set search_path = '' as $$
  select
    a.id,
    ofe.email,
    ofe.nombre,
    ob.numero,
    ob.titulo,
    ar.nombre,
    op.oferta_actual,
    op.minimo_siguiente,
    c.cierre_virtual
  from public.avisos_correo a
  join public.oferentes ofe on ofe.id = a.oferente_id
  join public.obras ob on ob.id = a.obra_id
  join public.artistas ar on ar.id = ob.artista_id
  join public.v_obras_publicas op on op.id = a.obra_id
  join public.configuracion c on c.id = 1
  where a.estado in ('pendiente', 'error') and a.intentos < 5
    and ofe.avisos_por_correo
    and not exists (
      select 1 from public.v_mejor_oferta mo
      where mo.obra_id = a.obra_id and mo.oferente_id = a.oferente_id
    )
  order by a.creado_at
  limit p_limite
$$;
revoke execute on function public.avisos_para_enviar(integer) from public, anon, authenticated;

-- 3. Supabase Storage necesita permiso de lectura para borrar (remove() consulta antes el
--    objeto). Sin esta política, los archivos de fotos borradas quedaban en el bucket.
create policy obras_fotos_admin_lectura on storage.objects
  for select to authenticated
  using (bucket_id = 'obras' and public.es_admin());

-- 4. "Ingresos sin completar el registro": solo correos verificados (en Supabase, pedir el
--    código ya crea el usuario aunque nunca lo confirme).
create or replace function public.indicadores() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ofertas_validas', (select count(*) from public.v_ofertas_vigentes),
    'ofertas_anuladas', (select count(*) from public.ofertas where estado = 'anulada'),
    'oferentes_registrados', (select count(*) from public.oferentes),
    'oferentes_con_ofertas', (select count(distinct oferente_id) from public.v_ofertas_vigentes),
    'ingresos_sin_registro', (
      select count(*) from auth.users u
      where u.email_confirmed_at is not null
        and not exists (select 1 from public.oferentes o where o.id = u.id)
        and not exists (select 1 from public.admins a where a.user_id = u.id)
    ),
    'monto_acumulado', (
      select coalesce(sum(mo.monto), 0)
      from public.v_mejor_oferta mo
      join public.obras ob on ob.id = mo.obra_id and ob.publicada
    ),
    'obras_publicadas', (select count(*) from public.obras where publicada),
    'obras_con_ofertas', (
      select count(*)
      from public.v_mejor_oferta mo
      join public.obras ob on ob.id = mo.obra_id and ob.publicada
    )
  );
end $$;

-- 5. La foto del artista (cargada en el panel) se muestra en la ficha pública.
--    create or replace view solo permite agregar columnas al final.
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
  ar.foto_ruta as artista_foto_ruta
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
where ob.publicada;
