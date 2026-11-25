#!/usr/bin/env bash
# Reintenta los avisos por correo pendientes y,
# de paso, limpia el registro viejo de Migue. Lo corre cron cada 10 minutos como el usuario de la
# app:
#   */10 * * * * subasta /srv/subasta/actual/scripts/servidor/avisos.sh
# Habla con la app directo en el puerto local: no pasa por nginx ni por internet.
set -euo pipefail
ENV=/srv/subasta/compartido/.env
valor() { grep -E "^$1=" "$ENV" | tail -1 | cut -d= -f2- | tr -d '"'; }
CRON_SECRET=$(valor CRON_SECRET)
PUERTO=$(valor PUERTO)
curl -fsS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PUERTO:-3008}/api/avisos"
