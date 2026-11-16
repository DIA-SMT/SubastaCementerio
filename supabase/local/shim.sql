-- Reemplazo mínimo de lo que Supabase ya trae de fábrica.
-- Se usa en el modo local (PGlite), en las pruebas y en el servidor propio (scripts/servidor/).
-- En Supabase no se ejecuta: los roles, el esquema auth, auth.uid() y storage ya existen.

-- Los roles son de todo el servidor de PostgreSQL, no de una base: en el servidor propio los
-- crea el administrador (pueden existir ya, de otro proyecto) y acá solo se crean si faltan.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  encrypted_password text,
  created_at timestamptz not null default now()
);

-- Igual que en Supabase: el usuario sale de request.jwt.claims.
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Esquema propio del modo local (registro de migraciones aplicadas).
create schema local;
