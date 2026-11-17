-- Migue, el asistente con IA del sitio público (17/11/2026; núcleo de Migue de CementerIA).
-- Esta migración no le abre ninguna puerta a los datos de la subasta: Migue lee lo mismo que
-- ya muestran las páginas (con el rol anon). Lo único suyo es qué le preguntaron y cuánto se
-- le preguntó, y solo lo toca el servidor (rol de servicio): RLS prendida y sin políticas,
-- sin permisos para anon ni authenticated.
--
-- 1. consultas_migue: cada consulta, con el canal, el resultado, la duración, los tokens y el
--    modelo si los hubo, y la pregunta y la respuesta recortadas a 500 caracteres. Nada que
--    identifique a la persona: ni la IP ni el usuario.
-- 2. consultas_migue_proteger: solo inserción. Nada de UPDATE, y una consulta de menos de 90
--    días no se borra.
-- 3. consumo_migue: el contador de consultas AL MODELO por persona (HMAC de la IP, nunca en
--    claro) y por hora, para los topes. Solo sube; una hora se borra recién al día siguiente.
-- 4. f_purgar_migue(): la retención (consultas de más de 90 días y horas de más de un día). La
--    llama /api/avisos, que ya corre por cron (Vercel o el servidor propio).

create table public.consultas_migue (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  canal text not null check (canal in ('publico')),
  resultado text not null
    check (resultado in ('respondida', 'sin_respuesta', 'fallback', 'tope', 'rechazada', 'error')),
  duracion_ms integer not null check (duracion_ms >= 0),
  tokens_entrada integer check (tokens_entrada >= 0),
  tokens_salida integer check (tokens_salida >= 0),
  modelo text check (length(modelo) <= 100),
  pregunta text not null check (length(pregunta) <= 500),
  respuesta text not null check (length(respuesta) <= 500)
);
create index consultas_migue_en on public.consultas_migue (en);
create index consultas_migue_resultado_en on public.consultas_migue (resultado, en);

create function public.consultas_migue_proteger() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'consultas_migue es de solo inserción';
  end if;
  if tg_op = 'DELETE' and old.en > now() - interval '90 days' then
    raise exception 'una consulta de Migue se borra recién a los 90 días';
  end if;
  return old;
end $$;
create trigger consultas_migue_proteger before update or delete on public.consultas_migue
  for each row execute function public.consultas_migue_proteger();

create table public.consumo_migue (
  clave text not null check (clave ~ '^[A-Za-z0-9_-]{32}$'),
  ventana timestamptz not null,
  consultas integer not null default 0 check (consultas >= 0),
  primary key (clave, ventana)
);
create index consumo_migue_ventana on public.consumo_migue (ventana);

create function public.consumo_migue_proteger() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.clave <> old.clave or new.ventana <> old.ventana or new.consultas < old.consultas) then
    raise exception 'el contador de Migue solo sube';
  end if;
  if tg_op = 'DELETE' and old.ventana > now() - interval '1 day' then
    raise exception 'una hora del contador de Migue se borra recién al día siguiente';
  end if;
  return coalesce(new, old);
end $$;
create trigger consumo_migue_proteger before update or delete on public.consumo_migue
  for each row execute function public.consumo_migue_proteger();

create function public.f_purgar_migue() returns table (consultas integer, ventanas integer)
language plpgsql as $$
declare
  c integer;
  v integer;
begin
  delete from public.consultas_migue where en <= now() - interval '90 days';
  get diagnostics c = row_count;
  delete from public.consumo_migue where ventana <= now() - interval '1 day';
  get diagnostics v = row_count;
  return query select c, v;
end $$;

-- Solo el servidor (rol de servicio). El sitio y el panel no las leen.
alter table public.consultas_migue enable row level security;
alter table public.consumo_migue enable row level security;
revoke all on public.consultas_migue, public.consumo_migue from anon, authenticated;
revoke execute on function public.f_purgar_migue(), public.consultas_migue_proteger(),
  public.consumo_migue_proteger() from public, anon, authenticated;
revoke all on sequence public.consultas_migue_id_seq from anon, authenticated;
