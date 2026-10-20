-- Usuario del panel SOLO para el modo local (PGlite). Credenciales de prueba.
-- En Supabase las cuentas del equipo se crean desde el panel de Supabase (ver README).
--   Correo:     admin@ejemplo.test
--   Contraseña: subasta-local-2026

insert into auth.users (id, email, email_confirmed_at, encrypted_password)
values (
  '00000000-0000-4000-d000-000000000001',
  'admin@ejemplo.test',
  now(),
  extensions.crypt('subasta-local-2026', extensions.gen_salt('bf'))
);

insert into public.admins (user_id, nombre)
values ('00000000-0000-4000-d000-000000000001', 'Equipo de ejemplo');
