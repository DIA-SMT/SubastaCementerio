-- Extensión del cierre por obra (apagada por defecto; se habilita desde Configuración).
--
-- Si está activa, una oferta registrada en los últimos N minutos antes del cierre de una obra
-- lo corre hasta N minutos después de esa oferta. Cada obra puede cerrar a una hora distinta.
--
-- El cierre de cada obra no se guarda: se calcula a partir de sus ofertas.
--   cierre de la obra = el más tardío entre el cierre general y (última oferta + N minutos)
-- Una oferta anterior a la ventana suma una hora previa al cierre general y no cambia nada; una
-- oferta dentro de la ventana lo corre. Cuentan todas las ofertas registradas, también las
-- anuladas después: la extensión ya ocurrió y otras personas pudieron ofertar en ese tiempo.
--
-- Para que nada cambie hacia atrás, la extensión no se puede activar, desactivar ni cambiar de
-- minutos una vez pasada la hora de cierre general (salvo que el mismo cambio reabra la etapa).
-- El panel aplica la misma regla antes de guardar, con un mensaje para el equipo.

alter table public.configuracion
  add column extension_activa boolean not null default false,
  add column extension_minutos smallint not null default 3
    constraint extension_minutos_rango check (extension_minutos between 1 and 30);

create index ofertas_obra_creada on public.ofertas (obra_id, creada_at desc);

-- Cierre de una obra a partir del cierre general y de su última oferta registrada.
create function public.cierre_con_extension(
  p_cierre timestamptz,
  p_activa boolean,
  p_minutos smallint,
  p_ultima_oferta timestamptz
) returns timestamptz
language sql immutable set search_path = '' as $$
  select case
    when p_activa and p_ultima_oferta is not null
      then greatest(p_cierre, p_ultima_oferta + make_interval(mins => p_minutos))
    else p_cierre
  end
$$;
-- Las vistas públicas la usan: quien consulta la vista tiene que poder ejecutarla.
grant execute on function public.cierre_con_extension(timestamptz, boolean, smallint, timestamptz)
  to anon, authenticated;

create function public.validar_extension() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Con la extensión apagada antes y después, cambiar los minutos no cambia ningún cierre.
  if (
       new.extension_activa is distinct from old.extension_activa
       or (new.extension_minutos is distinct from old.extension_minutos
           and (old.extension_activa or new.extension_activa))
     )
     and old.fechas_confirmadas
     and now() >= old.cierre_virtual
     and now() >= new.cierre_virtual then
    raise exception 'La extensión del cierre no se puede cambiar después de la hora de cierre.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.validar_extension() from public, anon, authenticated;

create trigger validar_extension before update on public.configuracion
  for each row execute function public.validar_extension();

-- ---------------------------------------------------------------------------
-- Vistas (create or replace view solo permite agregar columnas al final y conserva los permisos)
-- ---------------------------------------------------------------------------

-- Estado general: la etapa sigue "abierta" mientras alguna obra publicada siga abierta.
--   cierre_final: hora en que cierra la última obra (igual al cierre general sin extensión).
--   en_extension: pasó la hora de cierre general, pero alguna obra sigue abierta.
create or replace view public.v_estado_subasta as
with base as (
  select
    c.*,
    public.cierre_con_extension(
      c.cierre_virtual, c.extension_activa, c.extension_minutos,
      (
        select max(o.creada_at)
        from public.ofertas o
        join public.obras ob on ob.id = o.obra_id and ob.publicada
      )
    ) as cierre_final
  from public.configuracion c
  where c.id = 1
)
select
  b.inicio_virtual,
  b.cierre_virtual,
  b.fechas_confirmadas,
  b.fecha_presencial,
  b.detalle_presencial,
  b.incremento_minimo,
  b.precio_salida,
  b.modo_ejemplo,
  case
    when not b.fechas_confirmadas then 'por_confirmar'
    when now() < b.inicio_virtual then 'antes'
    when now() < b.cierre_final then 'abierta'
    else 'cerrada'
  end as fase,
  now() as ahora,
  b.extension_activa,
  b.extension_minutos,
  b.cierre_final,
  (b.fechas_confirmadas and now() >= b.inicio_virtual
    and now() >= b.cierre_virtual and now() < b.cierre_final) as en_extension
from base b;

-- Obras: cierre y fase de cada una.
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
  end as fase
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

-- Mis ofertas: fase de cada obra (puede seguir abierta aunque haya pasado el cierre general).
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
  ob.publicada,
  case
    when not c.fechas_confirmadas then 'por_confirmar'
    when now() < c.inicio_virtual then 'antes'
    when now() < public.cierre_con_extension(
      c.cierre_virtual, c.extension_activa, c.extension_minutos,
      (select max(x.creada_at) from public.ofertas x where x.obra_id = o.obra_id)
    ) then 'abierta'
    else 'cerrada'
  end as fase
from public.ofertas o
join public.obras ob on ob.id = o.obra_id
join public.artistas ar on ar.id = ob.artista_id
join public.configuracion c on c.id = 1
left join public.v_mejor_oferta mo on mo.obra_id = o.obra_id
where o.oferente_id = auth.uid();

-- Listado final: hora de cierre de cada obra.
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
  coalesce(ofe.bloqueado, false) as bloqueado,
  public.cierre_con_extension(
    c.cierre_virtual, c.extension_activa, c.extension_minutos,
    (select max(o.creada_at) from public.ofertas o where o.obra_id = ob.id)
  ) as cierre
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
-- Avisos: la hora de cierre y la fase son las de la obra (misma firma y permisos).
-- ---------------------------------------------------------------------------

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
    op.cierre,
    op.fase,
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

-- ---------------------------------------------------------------------------
-- Ofertas
-- ---------------------------------------------------------------------------

-- Igual que en 20261019140000_avisos.sql salvo el cierre, que ahora es el de la obra
-- (marcado [Cierre]). Devuelve además el cierre de la obra después de la oferta y si la
-- oferta lo extendió. Si otra migración vuelve a definir ofertar(), tiene que conservar los
-- bloques [Cierre] y [Aviso].
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
  v_cierre timestamptz;
  v_cierre_nuevo timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;

  -- Bloquea la obra: dos ofertas simultáneas se procesan de a una (y ven el cierre que dejó la otra).
  select * into v_obra from public.obras where id = p_obra_id and publicada for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'obra_inexistente');
  end if;

  select * into v_cfg from public.configuracion where id = 1;
  if not v_cfg.fechas_confirmadas or now() < v_cfg.inicio_virtual then
    return jsonb_build_object('ok', false, 'codigo', 'no_empezo');
  end if;
  -- [Cierre] El de esta obra: el general, o más tarde si una oferta de último momento lo extendió.
  v_cierre := public.cierre_con_extension(
    v_cfg.cierre_virtual, v_cfg.extension_activa, v_cfg.extension_minutos,
    (select max(o.creada_at) from public.ofertas o where o.obra_id = p_obra_id)
  );
  if now() >= v_cierre then
    return jsonb_build_object('ok', false, 'codigo', 'cerrada');
  end if;
  -- [Fin del cierre]

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

  -- [Cierre] La oferta recién registrada (creada_at = now()) puede correr el cierre de la obra.
  v_cierre_nuevo := public.cierre_con_extension(
    v_cfg.cierre_virtual, v_cfg.extension_activa, v_cfg.extension_minutos, now()
  );
  v_cierre_nuevo := greatest(v_cierre, v_cierre_nuevo);

  return jsonb_build_object(
    'ok', true,
    'oferta_id', v_id,
    'monto', p_monto,
    'minimo_siguiente', p_monto + v_cfg.incremento_minimo,
    'aviso_id', v_aviso,
    'cierre', v_cierre_nuevo,
    'extendio', v_cierre_nuevo > v_cierre
  );
end $$;
revoke execute on function public.ofertar(uuid, integer) from public, anon;
grant execute on function public.ofertar(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Bases y condiciones: texto PROVISORIO sobre la extensión (se cambia solo si sigue igual al
-- de 20261020120000_muestra.sql; si el equipo ya lo editó desde el panel, se respeta).
-- ---------------------------------------------------------------------------

update public.paginas
set titulo = $tit$Bases y condiciones$tit$,
    contenido = replace($txt$> **Texto pendiente.** Las bases y condiciones las redactan y aprueban la Dirección de Cementerios y el área legal de la Municipalidad. Este sitio no define condiciones legales.

## Puntos a definir
- Encuadre legal de la subasta.
- Si la oferta virtual es vinculante.
- Quién cobra, cómo y en qué plazo.
- Requisitos para participar en la subasta presencial.
- Si se aplica la extensión del cierre por ofertas de último momento.

## Cómo funciona la plataforma
- Registra ofertas entre la fecha de inicio y la de cierre publicadas en el sitio. La hora de cierre la controla el servidor.
- Cada oferta tiene que superar la anterior por lo menos en el incremento mínimo.
- **Extensión del cierre (provisorio, a confirmar):** si la Dirección la habilita, una oferta registrada en los últimos minutos antes del cierre de una obra extiende el cierre de esa obra hasta esa misma cantidad de minutos después de la oferta (por ejemplo, 3 minutos). Así, cada obra puede cerrar a una hora distinta. La ficha de cada obra muestra su hora de cierre.
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

## Cómo funciona la plataforma
- Registra ofertas entre la fecha de inicio y la de cierre publicadas en el sitio. La hora de cierre la controla el servidor.
- Cada oferta tiene que superar la anterior por lo menos en el incremento mínimo.
- Las ofertas no se pueden editar ni borrar. La Dirección puede anular una oferta indicando el motivo, y la anulación queda registrada.
- La plataforma no cobra ni procesa pagos.$txt$, E'\r', '');
