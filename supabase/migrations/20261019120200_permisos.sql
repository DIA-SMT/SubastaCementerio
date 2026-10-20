-- Permisos y seguridad por fila (RLS).
-- Supabase otorga permisos amplios por defecto a anon y authenticated: los quitamos y
-- otorgamos solo lo necesario. El público lee únicamente las vistas públicas.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.configuracion enable row level security;
alter table public.artistas enable row level security;
alter table public.obras enable row level security;
alter table public.obra_fotos enable row level security;
alter table public.admins enable row level security;
alter table public.oferentes enable row level security;
alter table public.ofertas enable row level security;
alter table public.paginas enable row level security;
alter table public.avisos_correo enable row level security;
alter table public.auditoria enable row level security;

-- Funciones usadas dentro de políticas y vistas.
grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.tipo_actor() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Público (con o sin sesión)
-- ---------------------------------------------------------------------------

grant select on
  public.v_estado_subasta,
  public.v_obras_publicas,
  public.v_fotos_publicas,
  public.v_historial_publico
to anon, authenticated;

grant select on public.paginas to anon, authenticated;
create policy paginas_lectura on public.paginas
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Oferente con sesión
-- ---------------------------------------------------------------------------

grant select on public.v_mis_ofertas to authenticated;

grant select on public.oferentes to authenticated;
create policy oferentes_lectura on public.oferentes
  for select to authenticated using (id = auth.uid() or public.es_admin());

grant execute on function public.registrar_oferente(text, text, text, text, boolean, boolean)
  to authenticated;
grant execute on function public.actualizar_mis_datos(text, boolean) to authenticated;
grant execute on function public.ofertar(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Equipo de la Dirección (admins)
-- ---------------------------------------------------------------------------

grant select on public.admins to authenticated;
create policy admins_lectura on public.admins
  for select to authenticated using (user_id = auth.uid() or public.es_admin());

grant select, update on public.configuracion to authenticated;
create policy configuracion_admin_lectura on public.configuracion
  for select to authenticated using (public.es_admin());
create policy configuracion_admin_edicion on public.configuracion
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

grant select, insert, update, delete on public.artistas, public.obras, public.obra_fotos
  to authenticated;

create policy artistas_admin on public.artistas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy obras_admin on public.obras
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy obra_fotos_admin on public.obra_fotos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant update on public.paginas to authenticated;
create policy paginas_admin_edicion on public.paginas
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- El equipo solo puede bloquear o desbloquear oferentes; los datos los carga cada persona.
grant update (bloqueado, bloqueo_motivo) on public.oferentes to authenticated;
create policy oferentes_admin_bloqueo on public.oferentes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

grant select on public.ofertas, public.avisos_correo, public.auditoria to authenticated;
create policy ofertas_admin_lectura on public.ofertas
  for select to authenticated using (public.es_admin());
create policy avisos_admin_lectura on public.avisos_correo
  for select to authenticated using (public.es_admin());
create policy auditoria_admin_lectura on public.auditoria
  for select to authenticated using (public.es_admin());

grant select on public.v_ofertas_admin, public.v_listado_final to authenticated;

grant execute on function public.anular_oferta(bigint, text) to authenticated;
grant execute on function public.indicadores() to authenticated;
grant execute on function public.registrar_evento(text, jsonb) to authenticated;

-- avisos_para_enviar y marcar_aviso quedan sin otorgar: solo el servidor (rol de servicio).
