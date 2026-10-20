-- Esquema de la subasta solidaria.
-- Montos en pesos enteros. Horas en timestamptz; se muestran en America/Argentina/Tucuman.

create type public.estado_oferta as enum ('valida', 'anulada');

-- Configuración general: una sola fila (id = 1).
create table public.configuracion (
  id smallint primary key default 1 check (id = 1),
  inicio_virtual timestamptz not null,
  cierre_virtual timestamptz not null,
  -- Mientras sea false, el sitio muestra "Fechas a confirmar" y no acepta ofertas.
  fechas_confirmadas boolean not null default false,
  fecha_presencial date,
  detalle_presencial text,
  incremento_minimo integer not null check (incremento_minimo > 0),
  -- Monto mínimo de la primera oferta de cada obra (cada obra puede tener el suyo).
  precio_salida integer not null check (precio_salida > 0),
  -- Muestra la franja "Datos de ejemplo" en todo el sitio.
  modo_ejemplo boolean not null default false,
  actualizada_at timestamptz not null default now(),
  constraint cierre_posterior_al_inicio check (cierre_virtual > inicio_virtual)
);

create table public.artistas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  resena text not null default '',
  foto_ruta text,
  enlace text,
  es_ejemplo boolean not null default false,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  numero smallint not null unique check (numero between 1 and 999),
  -- Vacío: el sitio muestra "Sin título".
  titulo text check (titulo is null or length(btrim(titulo)) > 0),
  artista_id uuid not null references public.artistas (id) on delete restrict,
  resena text not null default '',
  tecnica text,
  -- Vacío: se usa configuracion.precio_salida.
  precio_salida integer check (precio_salida is null or precio_salida > 0),
  publicada boolean not null default false,
  es_ejemplo boolean not null default false,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index obras_artista on public.obras (artista_id);

-- La foto con menor orden es la portada.
create table public.obra_fotos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  ruta text not null,
  texto_alternativo text not null default '',
  orden smallint not null default 0,
  ancho integer,
  alto integer,
  creado_at timestamptz not null default now()
);
create index obra_fotos_obra on public.obra_fotos (obra_id, orden);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

-- Datos personales: nunca se exponen en el sitio público (Ley 25.326).
create sequence public.oferentes_alias_seq;
create table public.oferentes (
  id uuid primary key references auth.users (id) on delete restrict,
  -- Se muestra en público como "Oferente N".
  alias_numero integer not null unique default nextval('public.oferentes_alias_seq'),
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  apellido text not null check (length(btrim(apellido)) between 1 and 80),
  dni text not null unique check (dni ~ '^[0-9]{7,8}$'),
  telefono text not null check (telefono ~ '^\+?[0-9]{8,15}$'),
  email text not null,
  bases_version integer not null,
  bases_aceptadas_at timestamptz not null,
  privacidad_aceptada_at timestamptz not null,
  avisos_por_correo boolean not null default true,
  bloqueado boolean not null default false,
  bloqueo_motivo text,
  es_ejemplo boolean not null default false,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  constraint bloqueo_con_motivo check (
    not bloqueado or length(btrim(coalesce(bloqueo_motivo, ''))) >= 5
  )
);
alter sequence public.oferentes_alias_seq owned by public.oferentes.alias_numero;
create unique index oferentes_email_unico on public.oferentes (lower(email));

-- Las ofertas no se borran ni se editan: solo pueden pasar a "anulada" con motivo.
create table public.ofertas (
  id bigint generated always as identity primary key,
  obra_id uuid not null references public.obras (id) on delete restrict,
  oferente_id uuid not null references public.oferentes (id) on delete restrict,
  monto integer not null check (monto > 0),
  creada_at timestamptz not null default now(),
  estado public.estado_oferta not null default 'valida',
  anulada_at timestamptz,
  anulada_por uuid references auth.users (id),
  motivo_anulacion text,
  constraint anulacion_completa check (
    (estado = 'valida' and anulada_at is null and anulada_por is null and motivo_anulacion is null)
    or (
      estado = 'anulada' and anulada_at is not null and anulada_por is not null
      and length(btrim(coalesce(motivo_anulacion, ''))) >= 5
    )
  )
);
create index ofertas_vigentes on public.ofertas (obra_id, monto desc, creada_at)
  where estado = 'valida';
create index ofertas_oferente on public.ofertas (oferente_id, creada_at desc);

-- Textos editables desde el panel.
create table public.paginas (
  slug text primary key check (
    slug in ('portada', 'como-participar', 'bases-y-condiciones', 'destino', 'privacidad')
  ),
  titulo text not null,
  contenido text not null default '',
  provisorio boolean not null default true,
  version integer not null default 1,
  actualizada_at timestamptz not null default now(),
  actualizada_por uuid references auth.users (id)
);

-- Cola de avisos por correo ("te superaron").
create table public.avisos_correo (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('oferta_superada')),
  oferente_id uuid not null references public.oferentes (id),
  obra_id uuid not null references public.obras (id),
  oferta_id bigint not null references public.ofertas (id),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'error', 'descartado')),
  intentos integer not null default 0,
  ultimo_error text,
  creado_at timestamptz not null default now(),
  enviado_at timestamptz
);
create index avisos_por_enviar on public.avisos_correo (creado_at)
  where estado in ('pendiente', 'error');

-- Registro de auditoría: solo se agregan filas.
create table public.auditoria (
  id bigint generated always as identity primary key,
  ocurrido_at timestamptz not null default now(),
  actor_id uuid,
  actor_tipo text not null check (actor_tipo in ('admin', 'oferente', 'sistema')),
  accion text not null,
  tabla text,
  registro_id text,
  antes jsonb,
  despues jsonb,
  detalle jsonb
);
create index auditoria_fecha on public.auditoria (ocurrido_at desc);
create index auditoria_registro on public.auditoria (tabla, registro_id);
