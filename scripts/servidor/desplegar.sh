#!/usr/bin/env bash
# Despliega en el servidor propio la última versión de main (o la rama indicada). Correr como
# root. Cada despliegue es una carpeta nueva en versiones/ y "actual" apunta a la que está viva:
# volver atrás es mover el enlace "actual" a la versión anterior y hacer pm2 reload.
#
#   bash /srv/subasta/actual/scripts/servidor/desplegar.sh [rama]
set -euo pipefail

APP=subasta
RAIZ=/srv/$APP
REPO=https://github.com/DIA-SMT/SubastaCementerio.git
RAMA=${1:-main}

cd "$RAIZ"
SHA=$(git ls-remote "$REPO" "refs/heads/$RAMA" | cut -c1-7)
[[ -n $SHA ]] || { echo "No existe la rama $RAMA"; exit 1; }
VER=versiones/$(date +%Y%m%d-%H%M%S)-$SHA
sudo -u $APP git clone --quiet --depth 1 --branch "$RAMA" "$REPO" "$VER"
cd "$VER"
# Las variables viven en compartido/ y se enlazan antes de compilar: las NEXT_PUBLIC_* quedan
# fijas en la compilación.
sudo -u $APP ln -s ../../compartido/.env .env
sudo -u $APP npm ci --no-audit --no-fund
sudo -u $APP npm run build
# Migraciones nuevas, si las hay (solo aplica lo que falta).
sudo -u $APP node --env-file=.env scripts/servidor/preparar-base.mjs

cd "$RAIZ"
ln -sfn "$PWD/$VER" actual
sudo -u $APP pm2 reload $APP --update-env
echo "Desplegado $VER"

# Deja las 3 últimas versiones (la anterior sirve para volver atrás).
ls -t versiones | tail -n +4 | xargs -r -I{} rm -rf "versiones/{}"
