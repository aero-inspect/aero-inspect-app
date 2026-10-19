#!/bin/bash
# Crea (o rota) en MinIO el usuario "dron", que solo puede SUBIR objetos al bucket de
# evidencia: no lee, no lista, no borra. Lo usa el flight-controller para subir las fotos al
# aterrizar. Correr una vez en la instancia, parado en deploy/aws:
#
#   bash scripts/create-drone-s3-user.sh
#
# La clave queda en secrets/dron-s3.env (no se muestra ni se versiona).
set -euo pipefail
cd "$(dirname "$0")/.."

MC_IMAGE="$(grep -oE 'pgsty/mc:[^ ]+' compose.yml | head -n 1)"
NETWORK="$(docker compose ps -q minio | xargs docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
export MINIO_PASSWORD="$(grep '^MINIO_PASSWORD=' .env | cut -d= -f2-)"
export DRON_S3_SECRET="$(openssl rand -hex 24)"

umask 077
mkdir -p secrets
cat > secrets/dron-s3.env <<EOF
# Para el .env del flight-controller: subida de fotos al MinIO de AWS.
S3_BUCKET=aeroinspect-evidence
S3_ENDPOINT_URL=https://s3.$(grep '^DOMAIN=' .env | cut -d= -f2-)
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=dron
AWS_SECRET_ACCESS_KEY=${DRON_S3_SECRET}
EOF

# PutObject cubre también la subida multiparte (fotos de más de 8 MB con boto3).
docker run --rm --network "$NETWORK" -e MINIO_PASSWORD -e DRON_S3_SECRET --entrypoint sh "$MC_IMAGE" -c '
  mc alias set local http://minio:9000 aeroinspect "$MINIO_PASSWORD" >/dev/null &&
  cat > /tmp/dron-upload.json <<POLICY
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject","s3:AbortMultipartUpload","s3:ListMultipartUploadParts"],"Resource":["arn:aws:s3:::aeroinspect-evidence/*"]}]}
POLICY
  mc admin policy create local dron-upload /tmp/dron-upload.json >/dev/null 2>&1 || true &&
  mc admin user add local dron "$DRON_S3_SECRET" >/dev/null &&
  mc admin policy attach local dron-upload --user dron >/dev/null 2>&1 || true &&
  mc admin user info local dron
'
echo "Listo: credenciales en secrets/dron-s3.env"
