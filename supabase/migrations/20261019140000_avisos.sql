-- Avisos "te superaron": cada aviso sale una sola vez y solo cuando corresponde.
--
-- 1. Reserva atómica. Dos envíos simultáneos (el after() de cada oferta y el cron corren en
--    instancias y conexiones distintas) ya no toman los mismos avisos: avisos_para_enviar
--    reserva las filas con un plazo (reservado_hasta) y SKIP LOCKED, y suma el intento al
--    reservar. Si el proceso se corta a mitad del envío, vencido el plazo el aviso se vuelve a
--    tomar. marcar_aviso ya no suma intentos ni toca avisos enviados o descartados.
-- 2. Un solo aviso vivo (pendiente, o en error con reintentos) por persona y obra: ofertar()
--    reutiliza el que ya existe y devuelve su id, así el envío sale en el momento.
-- 3. El aviso solo sale si otra persona tiene hoy la oferta más alta de esa obra publicada.
--    Devuelve la fase y si la persona está bloqueada, para no invitarla a volver a ofertar
--    cuando la etapa virtual cerró o cuando no puede ofertar.

alter table public.avisos_correo add column reservado_hasta timestamptz;

-- Cambia el tipo de resultado: hay que borrarla y volver a crearla (y a quitarle el permiso).
drop function public.avisos_para_enviar(integer);

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
  cierre_virtual timestamptz,
  fase text,
  -- AAAA-MM-DD (texto, para que no dependa de cómo cada driver convierte las fechas).
  fecha_presencial text,
  detalle_presencial text,
  bloqueado boolean
)
language sql volatile set search_path = '' as $$
  with elegidos as (
    select a.id
    from public.avisos_correo a
    join public.oferentes ofe on ofe.id = a.oferente_id
    where a.estado in ('pendiente', 'error') and a.intentos < 5
      and (a.reservado_hasta is null or a.reservado_hasta < now())
      and ofe.avisos_por_correo
      and exists (
        select 1
        from public.v_mejor_oferta mo
        join public.obras ob on ob.id = mo.obra_id and ob.publicada
        where mo.obra_id = a.obra_id and mo.oferente_id <> a.oferente_id
      )
    order by a.creado_at, a.id
    limit p_limite
    -- Solo se bloquean filas de avisos_correo (las vistas no admiten bloqueo).
    for update of a skip locked
  ),
  reservados as (
    update public.avisos_correo a
    set reservado_hasta = now() + interval '5 minutes',
        intentos = a.intentos + 1
    from elegidos e
    where a.id = e.id
    returning a.id, a.oferente_id, a.obra_id, a.creado_at
  )
  select
    r.id,
    ofe.email,
    ofe.nombre,
    op.numero,
    op.titulo,
    op.artista_nombre,
    op.oferta_actual,
    op.minimo_siguiente,
    est.cierre_virtual,
    est.fase,
    to_char(est.fecha_presencial, 'YYYY-MM-DD'),
    est.detalle_presencial,
    ofe.bloqueado
  from reservados r
  join public.oferentes ofe on ofe.id = r.oferente_id
  join public.v_obras_publicas op on op.id = r.obra_id
  cross join public.v_estado_subasta est
  order by r.creado_at, r.id
$$;
revoke execute on function public.avisos_para_enviar(integer) from public, anon, authenticated;

-- Misma firma: create or replace conserva los permisos (ninguno para anon ni authenticated).
create or replace function public.marcar_aviso(p_aviso_id bigint, p_enviado boolean, p_error text default null)
returns void
language sql volatile set search_path = '' as $$
  update public.avisos_correo
  set estado = case when p_enviado then 'enviado' else 'error' end,
      ultimo_error = left(p_error, 500),
      enviado_at = case when p_enviado then now() end,
      reservado_hasta = null
  where id = p_aviso_id and estado in ('pendiente', 'error')
$$;
-- Ya estaba así; se repite para que quede explícito (solo el servidor, como dueño).
revoke execute on function public.marcar_aviso(bigint, boolean, text) from public, anon, authenticated;

-- Igual que en 20261019120100_reglas.sql salvo el bloque del aviso (marcado más abajo).
-- Si otra migración vuelve a definir ofertar(), tiene que conservar ese bloque.
create or replace function public.ofertar(p_obra_id uuid, p_monto integer)
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

  -- [Aviso] A quien quedó superado, un solo aviso vivo por obra y oferente: pendiente, o en
  -- error con reintentos (hasta 5). Si ya hay uno, se reutiliza y se devuelve su id para que
  -- el servidor lo intente enviar en el momento. El bloqueo de la obra evita la carrera.
  if v_mejor_oferente is not null
     and exists (
       select 1 from public.oferentes where id = v_mejor_oferente and avisos_por_correo
     ) then
    select a.id into v_aviso
    from public.avisos_correo a
    where a.oferente_id = v_mejor_oferente and a.obra_id = p_obra_id
      and a.estado in ('pendiente', 'error') and a.intentos < 5
    order by a.creado_at desc
    limit 1;
    if v_aviso is null then
      insert into public.avisos_correo (tipo, oferente_id, obra_id, oferta_id)
      values ('oferta_superada', v_mejor_oferente, p_obra_id, v_id)
      returning id into v_aviso;
    end if;
  end if;
  -- [Fin del aviso]

  return jsonb_build_object(
    'ok', true,
    'oferta_id', v_id,
    'monto', p_monto,
    'minimo_siguiente', p_monto + v_cfg.incremento_minimo,
    'aviso_id', v_aviso
  );
end $$;
-- create or replace conserva los permisos de 20261019120200_permisos.sql; se repiten para que
-- queden explícitos: solo con sesión iniciada, nunca anon.
revoke execute on function public.ofertar(uuid, integer) from public, anon;
grant execute on function public.ofertar(uuid, integer) to authenticated;
