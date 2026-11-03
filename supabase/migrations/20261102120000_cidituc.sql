-- Ingreso de oferentes con Cidituc (Ciudadano Digital), en lugar del código por correo.
--
-- Cidituc dice quién es la persona (nombre, apellido, CUIL) y la app guarda ese dato en
-- public.personas. El id de la persona es el uid de la sesión de la subasta: llega a
-- request.jwt.claims como antes, así que auth.uid() y las políticas RLS no cambian. Los
-- oferentes pasan a colgar de public.personas en lugar de auth.users, que queda solo para las
-- cuentas del equipo (panel).
--
-- "Correo verificado" deja de ser la condición para registrarse y ofertar: la identidad la
-- validó Cidituc y el correo es solo el de contacto para los avisos.

-- ---------------------------------------------------------------------------
-- Personas validadas por Cidituc
-- ---------------------------------------------------------------------------

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  -- id_persona de Cidituc. Null solo en quienes se registraron con el correo antes de este
  -- cambio (ver más abajo): no pasaron por Cidituc.
  cidituc_id text unique,
  -- CUIL tal como lo devuelve Cidituc (11 dígitos); el DNI sale de ahí.
  cuil text check (cuil ~ '^[0-9]{11}$'),
  dni text not null check (dni ~ '^[0-9]{6,8}$'),
  nombre text not null default '' check (length(nombre) <= 80),
  apellido text not null default '' check (length(apellido) <= 80),
  -- El que figura en Cidituc. Se propone al registrarse; el de los avisos es oferentes.email.
  email text,
  creada_at timestamptz not null default now(),
  ultimo_ingreso_at timestamptz not null default now(),
  constraint cidituc_con_cuil check ((cidituc_id is null) = (cuil is null))
);

comment on table public.personas is
  'Personas que ingresaron con Cidituc. Datos personales: no se exponen en el sitio público.';

-- Solo el servidor la escribe (al validar el token de Cidituc). Cada persona lee su fila.
alter table public.personas enable row level security;
revoke all on public.personas from anon, authenticated;
grant select on public.personas to authenticated;
create policy personas_propia on public.personas
  for select to authenticated using (id = auth.uid());

-- Quienes ya se habían registrado con el correo (en producción no hay ninguno; en el modo
-- local, los de ejemplo) conservan su id: sus ofertas y su alias siguen siendo suyos.
insert into public.personas (id, dni, nombre, apellido, email, creada_at, ultimo_ingreso_at)
select o.id, o.dni, left(o.nombre, 80), left(o.apellido, 80), o.email, o.creado_at, o.creado_at
from public.oferentes o;

alter table public.oferentes drop constraint oferentes_id_fkey;
alter table public.oferentes
  add constraint oferentes_id_fkey foreign key (id) references public.personas (id) on delete restrict;

-- El DNI sale del CUIL sin los ceros de adelante: los documentos más viejos tienen 6 dígitos.
alter table public.oferentes drop constraint oferentes_dni_check;
alter table public.oferentes add constraint oferentes_dni_check check (dni ~ '^[0-9]{6,8}$');

-- El correo es de contacto: dos personas pueden compartirlo (por ejemplo, en una familia).
-- Lo que no se repite es el DNI (decisión 6).
drop index public.oferentes_email_unico;

-- ---------------------------------------------------------------------------
-- Vistas y funciones que miraban auth.users
-- ---------------------------------------------------------------------------

-- Todas las ofertas son de oferentes registrados, y registrarse exige pasar por Cidituc.
create or replace view public.v_ofertas_vigentes as
select o.*
from public.ofertas o
where o.estado = 'valida';

-- Registro de oferente: nombre, apellido y DNI salen de Cidituc (public.personas). La persona
-- carga teléfono y correo de contacto y acepta bases y privacidad.
drop function public.registrar_oferente(text, text, text, text, boolean, boolean);
create function public.registrar_oferente(
  p_telefono text,
  p_email text,
  p_acepta_bases boolean,
  p_acepta_privacidad boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_persona public.personas%rowtype;
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_version integer;
  v_alias integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;

  select * into v_persona from public.personas where id = v_uid and cidituc_id is not null;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'sin_identidad');
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
  if length(btrim(v_persona.nombre)) not between 1 and 80
     or length(btrim(v_persona.apellido)) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'codigo', 'datos_incompletos');
  end if;
  if v_tel !~ '^\+?[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'codigo', 'telefono_invalido');
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'codigo', 'correo_invalido');
  end if;
  if exists (select 1 from public.oferentes where dni = v_persona.dni) then
    perform public.auditar_dni_duplicado(v_uid, v_persona.dni);
    return jsonb_build_object('ok', false, 'codigo', 'dni_registrado');
  end if;

  select p.version into v_version from public.paginas p where p.slug = 'bases-y-condiciones';

  insert into public.oferentes (
    id, nombre, apellido, dni, telefono, email,
    bases_version, bases_aceptadas_at, privacidad_aceptada_at
  ) values (
    v_uid, btrim(v_persona.nombre), btrim(v_persona.apellido), v_persona.dni, v_tel, v_email,
    coalesce(v_version, 1), now(), now()
  )
  returning alias_numero into v_alias;

  return jsonb_build_object('ok', true, 'alias_numero', v_alias);
exception
  when unique_violation then
    -- Otro registro con el mismo DNI entró al mismo tiempo.
    if exists (select 1 from public.oferentes where dni = v_persona.dni) then
      perform public.auditar_dni_duplicado(v_uid, v_persona.dni);
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'dni_registrado');
end $$;
revoke execute on function public.registrar_oferente(text, text, boolean, boolean) from public, anon;
grant execute on function public.registrar_oferente(text, text, boolean, boolean) to authenticated;

-- "Mis datos": el correo ya no es el de ingreso, así que también se puede corregir.
drop function public.actualizar_mis_datos(text, boolean);
create function public.actualizar_mis_datos(p_telefono text, p_email text, p_avisos_por_correo boolean)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;
  if v_tel !~ '^\+?[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'codigo', 'telefono_invalido');
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'codigo', 'correo_invalido');
  end if;
  update public.oferentes
  set telefono = v_tel, email = v_email, avisos_por_correo = coalesce(p_avisos_por_correo, true)
  where id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'sin_registro');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.actualizar_mis_datos(text, text, boolean) from public, anon;
grant execute on function public.actualizar_mis_datos(text, text, boolean) to authenticated;

-- Igual que en 20261021120000_extension_cierre.sql salvo el control del correo verificado,
-- que se va: el registro ya exige la identidad validada por Cidituc. Conserva los bloques
-- [Cierre] y [Aviso].
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

-- Tablero: "ingresos sin registro" son las personas que entraron con Cidituc y no completaron
-- el registro de oferente.
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
      select count(*) from public.personas p
      where not exists (select 1 from public.oferentes o where o.id = p.id)
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

-- Los límites del código por correo ya no se usan (los de la contraseña del panel siguen).
drop function public.ingreso_pedir_codigo(text, text);
drop function public.ingreso_probar_codigo(text);

-- ---------------------------------------------------------------------------
-- Cómo participar (texto provisorio): el paso 2 habla del ingreso. Como en
-- 20261019140400_textos.sql, se cambia solo si el texto sigue igual al que dejó esa migración
-- (si el equipo lo editó desde el panel, se respeta su versión), y solo ese párrafo. Los saltos
-- de línea se comparan sin \r, de los dos lados.
-- ---------------------------------------------------------------------------

update public.paginas
set contenido = replace(
  replace(contenido, E'\r', ''),
  replace($txt$## 2. Ingresá con tu correo
Te mandamos un código de 6 números para confirmar que el correo es tuyo. La primera vez también te pedimos nombre, apellido, DNI y teléfono, y que aceptes las bases y condiciones.$txt$, E'\r', ''),
  replace($txt$## 2. Ingresá con Ciudadano Digital
Usá tu cuenta de Ciudadano Digital (Cidituc), la de los trámites de la Municipalidad. Tu nombre, apellido y DNI los trae Ciudadano Digital; la primera vez te pedimos además un teléfono y un correo de contacto, y que aceptes las bases y condiciones.$txt$, E'\r', '')
)
where slug = 'como-participar'
  and replace(contenido, E'\r', '') = replace($txt$## 1. Elegí una obra
Recorré el catálogo o escaneá el código QR que está junto a cada obra.

## 2. Ingresá con tu correo
Te mandamos un código de 6 números para confirmar que el correo es tuyo. La primera vez también te pedimos nombre, apellido, DNI y teléfono, y que aceptes las bases y condiciones.

## 3. Ofertá
Tu oferta tiene que superar la oferta actual por lo menos en el incremento mínimo que indica cada obra. Antes de registrarla te pedimos que la confirmes. Una vez confirmada, la oferta queda registrada y no se puede editar ni borrar desde el sitio. Las condiciones de la subasta están en las [bases y condiciones](/bases-y-condiciones).

## 4. Seguí la subasta
Si alguien supera tu oferta, te avisamos por correo. En "Mis ofertas" ves en qué obras tenés la oferta más alta.

## Al cierre de la etapa virtual
La oferta más alta de cada obra pasa a ser el precio base de la subasta presencial, con martillero.

## Pagos
La plataforma no cobra ni procesa pagos. **Pendiente:** cómo y cuándo se paga, a definir por la Dirección de Cementerios.$txt$, E'\r', '');
