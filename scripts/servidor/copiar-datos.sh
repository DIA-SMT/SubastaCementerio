#!/usr/bin/env bash
# Copia los datos de Supabase a la base del servidor propio. Correr como root en el servidor,
# con la base ya preparada (scripts/servidor/preparar-base.mjs). Vacía las tablas y copia todo de
# nuevo: se puede correr otra vez el día del cambio para traer los datos más recientes.
#
# Lee DIRECT_URL (la conexión directa de Supabase, puerto 5432) de /root/.subasta-origen, un
# archivo que solo lee root. La cadena nunca va en la línea de comandos.
#
#   bash scripts/servidor/copiar-datos.sh
set -euo pipefail

BASE=${BASE:-subasta}
ORIGEN=/root/.subasta-origen
PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump   # Supabase es PostgreSQL 17: hace falta el cliente 17
PSQL_ORIGEN=/usr/lib/postgresql/17/bin/psql

[[ -r $ORIGEN ]] || { echo "Falta $ORIGEN con DIRECT_URL=..."; exit 1; }
set -a; . "$ORIGEN"; set +a
[[ -n ${DIRECT_URL:-} ]] || { echo "DIRECT_URL vacío en $ORIGEN"; exit 1; }

mkdir -p /root/respaldos
SELLO=$(date +%Y%m%d-%H%M%S)

# 1. Respaldo completo de los datos de Supabase (esquema public), tal cual: no se edita nunca.
DATOS=/root/respaldos/$BASE-datos-$SELLO.sql
"$PG_DUMP" --data-only --schema=public --disable-triggers --no-owner --no-privileges \
  -d "$DIRECT_URL" -f "$DATOS"
# PostgreSQL 16 no conoce este parámetro del 17: se filtra en una copia.
grep -vE '^SET transaction_timeout' "$DATOS" > "${DATOS%.sql}-apto16.sql"

# 2. Cuentas del panel (auth.users): solo las columnas que usa la app. Las contraseñas son
#    bcrypt y se comprueban igual en el servidor propio.
USUARIOS=/root/respaldos/$BASE-usuarios-$SELLO.csv
"$PSQL_ORIGEN" "$DIRECT_URL" -v ON_ERROR_STOP=1 -c \
  "\copy (select id, email, email_confirmed_at, encrypted_password, created_at from auth.users) to '$USUARIOS' with csv"
chmod 600 "$DATOS" "${DATOS%.sql}-apto16.sql" "$USUARIOS"

# 3. Restaurar: primero las cuentas (las referencian admins y oferentes), después los datos,
#    todo en una transacción. Como postgres, para poder apagar los disparadores durante la
#    copia (la auditoría no registra la mudanza como si fueran cambios nuevos).
#    psql corre como postgres y no puede leer /root: los archivos pasan por una carpeta
#    temporal que solo lee postgres y se borra al terminar.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
install -o postgres -m 600 "$USUARIOS" "$TMP/usuarios.csv"
install -o postgres -m 600 "${DATOS%.sql}-apto16.sql" "$TMP/datos.sql"
chown postgres "$TMP" && chmod 700 "$TMP"
# Las migraciones dejan filas iniciales (configuración, textos y su auditoría): se vacían todas
# las tablas antes de copiar, así quedan exactamente los datos de Supabase.
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$BASE" <<SQL
begin;
set session_replication_role = replica;
truncate public.configuracion, public.paginas, public.auditoria, public.artistas, public.obras,
  public.obra_fotos, public.admins, public.oferentes, public.personas, public.ofertas,
  public.avisos_correo, public.intentos_ingreso, public.consultas_migue, public.consumo_migue,
  auth.users restart identity cascade;
set session_replication_role = origin;
\copy auth.users (id, email, email_confirmed_at, encrypted_password, created_at) from '$TMP/usuarios.csv' with csv
\i $TMP/datos.sql
commit;
SQL

echo "Datos copiados. Respaldo en $DATOS"
sudo -u postgres psql -d "$BASE" -tA -c \
  "select 'obras: ' || count(*) from public.obras union all
   select 'fotos: ' || count(*) from public.obra_fotos union all
   select 'ofertas: ' || count(*) from public.ofertas union all
   select 'oferentes: ' || count(*) from public.oferentes union all
   select 'cuentas del panel: ' || count(*) from public.admins"
