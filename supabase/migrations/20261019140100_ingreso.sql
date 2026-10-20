-- Ingreso: límites propios de intentos y registro de oferentes con DNI repetido.

-- ---------------------------------------------------------------------------
-- 1. Límites de intentos de ingreso
--    Supabase Auth limita por IP, y la IP que ve es la del servidor (Vercel), compartida por
--    todas las personas. Estos límites se controlan antes de llamar a Supabase Auth y cuentan
--    por correo y por la IP de quien hace el pedido. Los usa solo el servidor (rol de servicio).
--    No se guardan correos ni IP en claro: la clave es un hash SHA-256.
-- ---------------------------------------------------------------------------

create table public.intentos_ingreso (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('codigo_pedido', 'codigo_probado', 'contrasena_probada')),
  clave text not null,
  creado_at timestamptz not null default now()
);
create index intentos_ingreso_clave on public.intentos_ingreso (clave, tipo, creado_at desc);
create index intentos_ingreso_fecha on public.intentos_ingreso (creado_at);

alter table public.intentos_ingreso enable row level security;
revoke all on table public.intentos_ingreso from public, anon, authenticated;
revoke all on sequence public.intentos_ingreso_id_seq from public, anon, authenticated;

-- Hash de "correo:<correo>" o "ip:<ip>". Sin valor, devuelve null.
create function public.clave_ingreso(p_tipo text, p_valor text) returns text
language sql immutable set search_path = '' as $$
  select case
    when nullif(btrim(coalesce(p_valor, '')), '') is null then null
    else encode(extensions.digest(p_tipo || ':' || lower(btrim(p_valor)), 'sha256'), 'hex')
  end
$$;

create function public.contar_intentos_ingreso(p_tipo text, p_clave text, p_desde timestamptz)
returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer
  from public.intentos_ingreso i
  where i.clave = p_clave and i.tipo = p_tipo and i.creado_at > p_desde
$$;

-- Pedir un código: hasta 3 por correo cada 15 minutos y 20 por IP por hora.
-- Si se permite, registra el pedido. Devuelve 'ok', 'limite_correo' o 'limite_ip'.
create function public.ingreso_pedir_codigo(p_correo text, p_ip text) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_correo text := public.clave_ingreso('correo', p_correo);
  v_ip text := public.clave_ingreso('ip', p_ip);
begin
  if v_correo is null then
    raise exception 'Falta el correo.';
  end if;
  -- Dos pedidos simultáneos del mismo correo se cuentan de a uno.
  perform pg_advisory_xact_lock(hashtextextended(v_correo, 0));

  if public.contar_intentos_ingreso('codigo_pedido', v_correo, now() - interval '15 minutes') >= 3 then
    return 'limite_correo';
  end if;
  if v_ip is not null
     and public.contar_intentos_ingreso('codigo_pedido', v_ip, now() - interval '1 hour') >= 20 then
    return 'limite_ip';
  end if;

  -- Los intentos de más de un día ya no cuentan para ningún límite.
  delete from public.intentos_ingreso where creado_at < now() - interval '1 day';

  insert into public.intentos_ingreso (tipo, clave) values ('codigo_pedido', v_correo);
  if v_ip is not null then
    insert into public.intentos_ingreso (tipo, clave) values ('codigo_pedido', v_ip);
  end if;
  return 'ok';
end $$;

-- Probar un código: hace falta un código pedido en la última hora (la vigencia del código en
-- Supabase Auth no tiene que superarla) y se permiten 5 pruebas desde el último pedido.
-- La prueba se registra antes de llamar a Supabase Auth, así varias pruebas simultáneas no
-- pasan el límite. Devuelve 'ok', 'sin_codigo' o 'limite_correo'.
create function public.ingreso_probar_codigo(p_correo text) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_correo text := public.clave_ingreso('correo', p_correo);
  v_pedido timestamptz;
begin
  if v_correo is null then
    raise exception 'Falta el correo.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_correo, 0));

  select max(i.creado_at) into v_pedido
  from public.intentos_ingreso i
  where i.clave = v_correo and i.tipo = 'codigo_pedido' and i.creado_at > now() - interval '1 hour';
  if v_pedido is null then
    return 'sin_codigo';
  end if;
  if public.contar_intentos_ingreso('codigo_probado', v_correo, v_pedido) >= 5 then
    return 'limite_correo';
  end if;

  insert into public.intentos_ingreso (tipo, clave) values ('codigo_probado', v_correo);
  return 'ok';
end $$;

-- Ingreso al panel con contraseña: con 5 intentos sin éxito en 15 minutos, por correo o por
-- IP, no se prueba más hasta que pasen. El intento se registra antes de llamar a Supabase Auth.
-- Devuelve 'ok', 'limite_correo' o 'limite_ip'.
create function public.ingreso_probar_contrasena(p_correo text, p_ip text) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_correo text := public.clave_ingreso('correo', p_correo);
  v_ip text := public.clave_ingreso('ip', p_ip);
begin
  if v_correo is null then
    raise exception 'Falta el correo.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_correo, 0));

  if public.contar_intentos_ingreso('contrasena_probada', v_correo, now() - interval '15 minutes') >= 5 then
    return 'limite_correo';
  end if;
  if v_ip is not null
     and public.contar_intentos_ingreso('contrasena_probada', v_ip, now() - interval '15 minutes') >= 5 then
    return 'limite_ip';
  end if;

  delete from public.intentos_ingreso where creado_at < now() - interval '1 day';

  insert into public.intentos_ingreso (tipo, clave) values ('contrasena_probada', v_correo);
  if v_ip is not null then
    insert into public.intentos_ingreso (tipo, clave) values ('contrasena_probada', v_ip);
  end if;
  return 'ok';
end $$;

-- Con la contraseña correcta, los intentos anteriores de ese correo y esa IP dejan de contar.
create function public.ingreso_contrasena_correcta(p_correo text, p_ip text) returns void
language sql volatile set search_path = '' as $$
  delete from public.intentos_ingreso i
  where i.tipo = 'contrasena_probada'
    and i.clave in (public.clave_ingreso('correo', p_correo), public.clave_ingreso('ip', p_ip))
$$;

revoke execute on function public.clave_ingreso(text, text) from public, anon, authenticated;
revoke execute on function public.contar_intentos_ingreso(text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.ingreso_pedir_codigo(text, text) from public, anon, authenticated;
revoke execute on function public.ingreso_probar_codigo(text) from public, anon, authenticated;
revoke execute on function public.ingreso_probar_contrasena(text, text) from public, anon, authenticated;
revoke execute on function public.ingreso_contrasena_correcta(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registro de oferentes: DNI repetido
--    El rechazo queda en la auditoría con el DNI enmascarado (solo los últimos 3 números),
--    para que el equipo vea si alguien prueba DNI ajenos. Con dos rechazos, esa cuenta ya no
--    puede seguir probando: recibe 'demasiados_intentos' sea cual sea el DNI.
--    La auditoría no se puede borrar, así que no lleva el correo (ver 20261019140500_auditoria.sql):
--    actor_id ya identifica la cuenta de Supabase Auth.
-- ---------------------------------------------------------------------------

create index auditoria_dni_duplicado on public.auditoria (actor_id) where accion = 'dni_duplicado';

create function public.auditar_dni_duplicado(p_uid uuid, p_dni text) returns void
language sql volatile set search_path = '' as $$
  insert into public.auditoria (actor_id, actor_tipo, accion, tabla, detalle)
  values (
    p_uid,
    public.tipo_actor(),
    'dni_duplicado',
    'oferentes',
    jsonb_build_object('dni', repeat('*', greatest(length(p_dni) - 3, 0)) || right(p_dni, 3))
  )
$$;
revoke execute on function public.auditar_dni_duplicado(uuid, text) from public, anon, authenticated;

create or replace function public.registrar_oferente(
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
  if (
    select count(*) from public.auditoria a
    where a.accion = 'dni_duplicado' and a.actor_id = v_uid
  ) >= 2 then
    return jsonb_build_object('ok', false, 'codigo', 'demasiados_intentos');
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
    perform public.auditar_dni_duplicado(v_uid, v_dni);
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
    -- Otro registro con el mismo DNI entró al mismo tiempo.
    if exists (select 1 from public.oferentes where dni = v_dni) then
      perform public.auditar_dni_duplicado(v_uid, v_dni);
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'dni_registrado');
end $$;
