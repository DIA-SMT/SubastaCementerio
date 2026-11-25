-- Alta (o reactivación) de una cuenta del panel en el servidor propio. Uso (como root; la clave
-- se pasa por el entorno, no como argumento, para que no quede a la vista en la lista de procesos):
--
--   read -s -p "Clave nueva: " C && echo && CLAVE="$C" sudo --preserve-env=CLAVE -u postgres \
--     psql -d subasta -v correo="nombre@smt.gob.ar" -v nombre="Nombre y apellido" \
--     -f /srv/subasta/actual/scripts/servidor/alta-admin.sql; unset C
--
-- Si la cuenta ya existe, le cambia la clave y la vuelve a habilitar.
\set ON_ERROR_STOP on
\getenv clave CLAVE
\if :{?clave}
\else
  \echo 'Falta la clave (variable de entorno CLAVE).'
  \quit
\endif

begin;
insert into auth.users (email, email_confirmed_at, encrypted_password)
values (lower(:'correo'), now(), extensions.crypt(:'clave', extensions.gen_salt('bf')))
on conflict (email) do update set encrypted_password = excluded.encrypted_password;

insert into public.admins (user_id, nombre)
select id, :'nombre' from auth.users where email = lower(:'correo')
on conflict (user_id) do update set activo = true, nombre = excluded.nombre;
commit;

select 'Listo: ' || lower(:'correo') || ' puede entrar al panel.' as resultado;
