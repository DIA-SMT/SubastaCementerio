-- Reglas de negocio: funciones, disparadores y vistas.
-- Las funciones SECURITY DEFINER fijan search_path vacío y califican todo con su esquema.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid() and a.activo
  )
$$;

create function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado_at := now();
  return new;
end $$;

create trigger artistas_actualizado before update on public.artistas
  for each row execute function public.tocar_actualizado();
create trigger obras_actualizado before update on public.obras
  for each row execute function public.tocar_actualizado();
create trigger oferentes_actualizado before update on public.oferentes
  for each row execute function public.tocar_actualizado();

create function public.tocar_configuracion() returns trigger
language plpgsql as $$
begin
  new.actualizada_at := now();
  return new;
end $$;

create trigger configuracion_actualizada before update on public.configuracion
  for each row execute function public.tocar_configuracion();

-- Cada cambio de texto sube la versión (las bases aceptadas guardan su versión).
create function public.versionar_pagina() returns trigger
language plpgsql as $$
begin
  if new.titulo is distinct from old.titulo or new.contenido is distinct from old.contenido then
    new.version := old.version + 1;
  end if;
  new.actualizada_at := now();
  new.actualizada_por := auth.uid();
  return new;
end $$;

create trigger paginas_version before update on public.paginas
  for each row execute function public.versionar_pagina();

-- ---------------------------------------------------------------------------
-- Inmutabilidad
-- ---------------------------------------------------------------------------

create function public.impedir_truncate() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % no se puede vaciar.', tg_table_name;
end $$;

create function public.proteger_ofertas() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las ofertas no se pueden borrar. Se anulan con un motivo.';
  end if;
  -- Único cambio permitido: pasar de válida a anulada sin tocar los datos de la oferta.
  if old.estado <> 'valida' or new.estado <> 'anulada'
     or new.id <> old.id
     or new.obra_id <> old.obra_id
     or new.oferente_id <> old.oferente_id
     or new.monto <> old.monto
     or new.creada_at <> old.creada_at then
    raise exception 'Las ofertas no se pueden modificar.';
  end if;
  return new;
end $$;

create trigger ofertas_inmutables before update or delete on public.ofertas
  for each row execute function public.proteger_ofertas();
create trigger ofertas_sin_truncate before truncate on public.ofertas
  for each statement execute function public.impedir_truncate();

create function public.proteger_auditoria() returns trigger
language plpgsql as $$
begin
  raise exception 'El registro de auditoría no se puede modificar ni borrar.';
end $$;

create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.proteger_auditoria();
create trigger auditoria_sin_truncate before truncate on public.auditoria
  for each statement execute function public.impedir_truncate();

-- ---------------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------------

create function public.tipo_actor() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then 'sistema'
    when public.es_admin() then 'admin'
    else 'oferente'
  end
$$;

create function public.registrar_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb;
  v_accion text := lower(tg_op);
begin
  v_fila := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name = 'ofertas' and tg_op = 'UPDATE' then
    v_accion := 'anular';
  end if;
  insert into public.auditoria (actor_id, actor_tipo, accion, tabla, registro_id, antes, despues)
  values (
    auth.uid(),
    public.tipo_actor(),
    v_accion,
    tg_table_name,
    coalesce(v_fila ->> 'id', v_fila ->> 'slug', v_fila ->> 'user_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

create trigger auditar after insert or update or delete on public.configuracion
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.artistas
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.obras
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.obra_fotos
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.paginas
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.oferentes
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update on public.ofertas
  for each row execute function public.registrar_cambio();
create trigger auditar after insert or update or delete on public.admins
  for each row execute function public.registrar_cambio();

-- Eventos sin cambio de datos (por ejemplo, una exportación con datos personales).
create function public.registrar_evento(p_accion text, p_detalle jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  insert into public.auditoria (actor_id, actor_tipo, accion, detalle)
  values (auth.uid(), 'admin', p_accion, p_detalle);
end $$;

-- ---------------------------------------------------------------------------
-- Vistas
-- Son vistas con los permisos de su dueño: exponen solo las columnas indicadas y
-- se filtran explícitamente. Ninguna vista pública incluye datos personales.
-- ---------------------------------------------------------------------------

create view public.v_estado_subasta as
select
  c.inicio_virtual,
  c.cierre_virtual,
  c.fechas_confirmadas,
  c.fecha_presencial,
  c.detalle_presencial,
  c.incremento_minimo,
  c.precio_salida,
  c.modo_ejemplo,
  case
    when not c.fechas_confirmadas then 'por_confirmar'
    when now() < c.inicio_virtual then 'antes'
    when now() < c.cierre_virtual then 'abierta'
    else 'cerrada'
  end as fase,
  now() as ahora
from public.configuracion c
where c.id = 1;

-- Solo cuentan las ofertas válidas de oferentes con el correo verificado.
create view public.v_ofertas_vigentes as
select o.*
from public.ofertas o
join auth.users u on u.id = o.oferente_id and u.email_confirmed_at is not null
where o.estado = 'valida';

create view public.v_mejor_oferta as
select distinct on (v.obra_id)
  v.obra_id,
  v.id as oferta_id,
  v.oferente_id,
  v.monto,
  v.creada_at
from public.v_ofertas_vigentes v
order by v.obra_id, v.monto desc, v.creada_at asc;

create view public.v_obras_publicas as
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
  foto.alto as portada_alto
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

create view public.v_fotos_publicas as
select f.id, f.obra_id, f.ruta, f.texto_alternativo, f.orden, f.ancho, f.alto
from public.obra_fotos f
join public.obras ob on ob.id = f.obra_id and ob.publicada;

create view public.v_historial_publico as
select
  v.id,
  v.obra_id,
  ofe.alias_numero,
  v.monto,
  v.creada_at,
  coalesce(v.oferente_id = auth.uid(), false) as es_propia
from public.v_ofertas_vigentes v
join public.obras ob on ob.id = v.obra_id and ob.publicada
join public.oferentes ofe on ofe.id = v.oferente_id;

create view public.v_mis_ofertas as
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
  mo.monto as oferta_actual
from public.ofertas o
join public.obras ob on ob.id = o.obra_id
join public.artistas ar on ar.id = ob.artista_id
left join public.v_mejor_oferta mo on mo.obra_id = o.obra_id
where o.oferente_id = auth.uid();

-- Vistas del panel: devuelven filas solo a administradores.
create view public.v_ofertas_admin as
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
  coalesce(mo.oferta_id = o.id, false) as es_la_mas_alta
from public.ofertas o
join public.obras ob on ob.id = o.obra_id
join public.artistas ar on ar.id = ob.artista_id
join public.oferentes ofe on ofe.id = o.oferente_id
left join public.admins adm on adm.user_id = o.anulada_por
left join public.v_mejor_oferta mo on mo.obra_id = o.obra_id
where public.es_admin();

create view public.v_listado_final as
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
  coalesce(cnt.cantidad, 0) as cantidad_ofertas
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

-- ---------------------------------------------------------------------------
-- Oferentes
-- ---------------------------------------------------------------------------

-- Se llama después de verificar el correo con el código.
create function public.registrar_oferente(
  p_nombre text,
  p_apellido text,
  p_dni text,
  p_telefono text,
  p_acepta_bases boolean,
  p_acepta_privacidad boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_dni text := regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_version integer;
  v_alias integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return jsonb_build_object('ok', false, 'codigo', 'correo_sin_verificar');
  end if;

  if exists (select 1 from public.oferentes where id = v_uid) then
    return jsonb_build_object('ok', false, 'codigo', 'ya_registrado');
  end if;
  if not coalesce(p_acepta_bases, false) or not coalesce(p_acepta_privacidad, false) then
    return jsonb_build_object('ok', false, 'codigo', 'falta_aceptacion');
  end if;
  if length(btrim(coalesce(p_nombre, ''))) not between 1 and 80
     or length(btrim(coalesce(p_apellido, ''))) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'codigo', 'datos_incompletos');
  end if;
  if v_dni !~ '^[0-9]{7,8}$' then
    return jsonb_build_object('ok', false, 'codigo', 'dni_invalido');
  end if;
  if v_tel !~ '^\+?[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'codigo', 'telefono_invalido');
  end if;
  if exists (select 1 from public.oferentes where dni = v_dni) then
    return jsonb_build_object('ok', false, 'codigo', 'dni_registrado');
  end if;

  select p.version into v_version from public.paginas p where p.slug = 'bases-y-condiciones';

  insert into public.oferentes (
    id, nombre, apellido, dni, telefono, email,
    bases_version, bases_aceptadas_at, privacidad_aceptada_at
  ) values (
    v_uid, btrim(p_nombre), btrim(p_apellido), v_dni, v_tel, v_email,
    coalesce(v_version, 1), now(), now()
  )
  returning alias_numero into v_alias;

  return jsonb_build_object('ok', true, 'alias_numero', v_alias);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'dni_registrado');
end $$;

create function public.actualizar_mis_datos(p_telefono text, p_avisos_por_correo boolean)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;
  if v_tel !~ '^\+?[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'codigo', 'telefono_invalido');
  end if;
  update public.oferentes
  set telefono = v_tel, avisos_por_correo = coalesce(p_avisos_por_correo, true)
  where id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'sin_registro');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Ofertas
-- ---------------------------------------------------------------------------

-- Única forma de registrar una oferta. El cierre lo controla now() del servidor.
create function public.ofertar(p_obra_id uuid, p_monto integer)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.configuracion%rowtype;
  v_obra public.obras%rowtype;
  v_ofe public.oferentes%rowtype;
  v_mejor_monto integer;
  v_mejor_oferente uuid;
  v_minimo integer;
  v_id bigint;
  v_aviso bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;

  -- Bloquea la obra: dos ofertas simultáneas se procesan de a una.
  select * into v_obra from public.obras where id = p_obra_id and publicada for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'obra_inexistente');
  end if;

  select * into v_cfg from public.configuracion where id = 1;
  if not v_cfg.fechas_confirmadas or now() < v_cfg.inicio_virtual then
    return jsonb_build_object('ok', false, 'codigo', 'no_empezo');
  end if;
  if now() >= v_cfg.cierre_virtual then
    return jsonb_build_object('ok', false, 'codigo', 'cerrada');
  end if;

  select * into v_ofe from public.oferentes where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'sin_registro');
  end if;
  if not exists (
    select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'correo_sin_verificar');
  end if;
  if v_ofe.bloqueado then
    return jsonb_build_object('ok', false, 'codigo', 'bloqueado');
  end if;
  if (
    select count(*) from public.ofertas
    where oferente_id = v_uid and creada_at > now() - interval '1 minute'
  ) >= 10 then
    return jsonb_build_object('ok', false, 'codigo', 'demasiadas_ofertas');
  end if;

  select mo.monto, mo.oferente_id into v_mejor_monto, v_mejor_oferente
  from public.v_mejor_oferta mo
  where mo.obra_id = p_obra_id;

  v_minimo := case
    when v_mejor_monto is null then coalesce(v_obra.precio_salida, v_cfg.precio_salida)
    else v_mejor_monto + v_cfg.incremento_minimo
  end;

  if v_mejor_oferente = v_uid then
    return jsonb_build_object(
      'ok', false, 'codigo', 'ya_es_la_mas_alta',
      'oferta_actual', v_mejor_monto, 'minimo', v_minimo
    );
  end if;
  if p_monto is null or p_monto < v_minimo then
    return jsonb_build_object(
      'ok', false, 'codigo', 'monto_insuficiente',
      'oferta_actual', v_mejor_monto, 'minimo', v_minimo
    );
  end if;
  if p_monto > 1000000000 then
    return jsonb_build_object('ok', false, 'codigo', 'monto_invalido');
  end if;

  insert into public.ofertas (obra_id, oferente_id, monto)
  values (p_obra_id, v_uid, p_monto)
  returning id into v_id;

  -- Aviso a quien quedó superado (uno pendiente por obra y oferente, para no saturar).
  if v_mejor_oferente is not null
     and exists (
       select 1 from public.oferentes where id = v_mejor_oferente and avisos_por_correo
     )
     and not exists (
       select 1 from public.avisos_correo
       where oferente_id = v_mejor_oferente and obra_id = p_obra_id and estado = 'pendiente'
     ) then
    insert into public.avisos_correo (tipo, oferente_id, obra_id, oferta_id)
    values ('oferta_superada', v_mejor_oferente, p_obra_id, v_id)
    returning id into v_aviso;
  end if;

  return jsonb_build_object(
    'ok', true,
    'oferta_id', v_id,
    'monto', p_monto,
    'minimo_siguiente', p_monto + v_cfg.incremento_minimo,
    'aviso_id', v_aviso
  );
end $$;

create function public.anular_oferta(p_oferta_id bigint, p_motivo text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_obra_id uuid;
begin
  if not public.es_admin() then
    return jsonb_build_object('ok', false, 'codigo', 'sin_permiso');
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then
    return jsonb_build_object('ok', false, 'codigo', 'motivo_requerido');
  end if;

  select o.obra_id into v_obra_id from public.ofertas o where o.id = p_oferta_id;
  if v_obra_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;
  perform 1 from public.obras where id = v_obra_id for update;

  update public.ofertas
  set estado = 'anulada',
      anulada_at = now(),
      anulada_por = auth.uid(),
      motivo_anulacion = btrim(p_motivo)
  where id = p_oferta_id and estado = 'valida';
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'ya_anulada');
  end if;

  return jsonb_build_object('ok', true, 'obra_id', v_obra_id);
end $$;

-- ---------------------------------------------------------------------------
-- Panel
-- ---------------------------------------------------------------------------

create function public.indicadores() returns jsonb
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
      where not exists (select 1 from public.oferentes o where o.id = u.id)
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

-- ---------------------------------------------------------------------------
-- Avisos por correo (los usa el servidor con el rol de servicio)
-- ---------------------------------------------------------------------------

create function public.avisos_para_enviar(p_limite integer default 20)
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
  order by a.creado_at
  limit p_limite
$$;

create function public.marcar_aviso(p_aviso_id bigint, p_enviado boolean, p_error text default null)
returns void
language sql volatile set search_path = '' as $$
  update public.avisos_correo
  set estado = case when p_enviado then 'enviado' else 'error' end,
      intentos = intentos + 1,
      ultimo_error = p_error,
      enviado_at = case when p_enviado then now() end
  where id = p_aviso_id
$$;
