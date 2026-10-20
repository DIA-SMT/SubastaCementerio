-- DATOS DE EJEMPLO. No cargar en producción.
-- Todo lo que se crea acá lleva es_ejemplo = true y el sitio muestra la franja
-- "Datos de ejemplo" mientras configuracion.modo_ejemplo sea true.

update public.configuracion set
  inicio_virtual = now() - interval '2 days',
  -- Cierre de ejemplo: 14/11 a las 20 h (dos semanas desde la Noche de los Museos). La apertura
  -- queda en el pasado para que en local se pueda ofertar con los datos de ejemplo.
  cierre_virtual = greatest('2026-11-14 20:00:00-03'::timestamptz, now() + interval '12 days'),
  fechas_confirmadas = true,
  fecha_presencial = greatest('2026-11-28'::date, (now() + interval '19 days')::date),
  detalle_presencial = 'Lugar y hora a confirmar (dato de ejemplo).',
  incremento_minimo = 5000,
  precio_salida = 10000,
  modo_ejemplo = true
where id = 1;

insert into public.artistas (id, nombre, resena, es_ejemplo)
select
  ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
  'Artista de ejemplo ' || n,
  'Reseña de ejemplo. Acá va una breve presentación de quien intervino la obra: '
    || 'formación, trayectoria y su vínculo con el proyecto.',
  true
from generate_series(1, 25) n;

insert into public.obras (id, numero, titulo, artista_id, resena, tecnica, publicada, es_ejemplo)
select
  ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
  n,
  case when n % 4 = 0 then null else 'Título de ejemplo ' || n end,
  ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
  'Reseña de ejemplo de la obra. Acá va la descripción de la intervención: '
    || 'la idea, los materiales y el proceso.',
  'Técnica de ejemplo',
  true,
  true
from generate_series(1, 25) n;

insert into public.obra_fotos (obra_id, ruta, texto_alternativo, orden, ancho, alto)
select
  ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
  '/ejemplo/obra-' || lpad(n::text, 2, '0') || '.svg',
  'Imagen de ejemplo de la obra ' || n,
  0,
  800,
  1000
from generate_series(1, 25) n;

insert into public.obra_fotos (obra_id, ruta, texto_alternativo, orden, ancho, alto)
select
  ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
  '/ejemplo/obra-' || lpad(n::text, 2, '0') || '-detalle.svg',
  'Detalle de ejemplo de la obra ' || n,
  1,
  800,
  1000
from generate_series(1, 5) n;

-- Oferentes de ejemplo con el correo verificado.
insert into auth.users (id, email, email_confirmed_at)
select
  ('00000000-0000-4000-c000-' || lpad(n::text, 12, '0'))::uuid,
  'oferente' || n || '@ejemplo.test',
  now() - interval '3 days'
from generate_series(1, 14) n;

insert into public.oferentes (
  id, nombre, apellido, dni, telefono, email,
  bases_version, bases_aceptadas_at, privacidad_aceptada_at, es_ejemplo
)
select
  ('00000000-0000-4000-c000-' || lpad(n::text, 12, '0'))::uuid,
  'Persona',
  'De Ejemplo ' || n,
  (30000000 + n)::text,
  '381400' || lpad(n::text, 4, '0'),
  'oferente' || n || '@ejemplo.test',
  1,
  now() - interval '3 days',
  now() - interval '3 days',
  true
from generate_series(1, 14) n;

-- Ofertas de ejemplo: de 0 a 5 por obra, crecientes y de oferentes alternados.
do $$
declare
  n integer;
  i integer;
  k integer;
  v_monto integer;
begin
  for n in 1..25 loop
    k := (n * 7) % 6;
    v_monto := 10000;
    for i in 1..k loop
      if i > 1 then
        v_monto := v_monto + 5000 + ((n * i) % 3) * 5000;
      end if;
      insert into public.ofertas (obra_id, oferente_id, monto, creada_at)
      values (
        ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
        ('00000000-0000-4000-c000-' || lpad((((n + i * 5) % 14) + 1)::text, 12, '0'))::uuid,
        v_monto,
        now() - interval '47 hours' + make_interval(mins => i * 400 + n * 7)
      );
    end loop;
  end loop;
end $$;
