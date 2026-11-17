#!/usr/bin/env bash
# Reintenta los avisos por correo pendientes (lo que en Vercel hacía el cron de vercel.json).
# Lo corre cron cada 10 minutos como el usuario de la app:
#   */10 * * * * subasta /srv/subasta/actual/scripts/servidor/avisos.sh
# Habla con la app directo en el puerto local: no pasa por nginx ni por internet.
set -euo pipefail
CRON_SECRET=$(grep -E '^CRON_SECRET=' /srv/subasta/compartido/.env | cut -d= -f2- | tr -d '"')
curl -fsS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3005/api/avisos
