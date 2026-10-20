-- Reemplazo mínimo de lo que Supabase ya trae de fábrica.
-- SOLO se usa en el modo local (PGlite) y en las pruebas. En Supabase no se ejecuta:
-- los roles, el esquema auth, auth.uid() y storage ya existen.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

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

-- Códigos de ingreso del modo local (en Supabase los maneja Auth).
create schema local;
create table local.codigos (
  email text primary key,
  codigo text not null,
  vence_at timestamptz not null,
  intentos integer not null default 0
);
