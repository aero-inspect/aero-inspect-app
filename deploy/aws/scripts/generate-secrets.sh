#!/bin/bash
# Genera .env y mosquitto/passwd con contraseñas aleatorias. Se corre UNA vez, en la
# instancia (o en la compu para probar), parado en deploy/aws:
#
#   ./scripts/generate-secrets.sh 3-14-15-92.sslip.io
#
# No muestra ninguna contraseña. Las credenciales MQTT del dron quedan en secrets/dron-mqtt.env
# para copiarlas a la Raspberry Pi. Nada de esto se versiona (ver .gitignore).
#
# En Git Bash de Windows, correrlo con MSYS_NO_PATHCONV=1 para que Docker reciba bien la ruta.
set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN="${1:?Uso: $0 <dominio>   (p.ej. 3-14-15-92.sslip.io, o localhost para probar)}"

if [ -f .env ]; then
    echo ".env ya existe: no lo piso. Borralo a mano si querés regenerar todo." >&2
    exit 1
fi

rand() { openssl rand -hex 24; }

MQTT_MONOLITH_PASSWORD="$(rand)"
MQTT_DRON_PASSWORD="$(rand)"

umask 077
cat > .env <<EOF
DOMAIN=${DOMAIN}
POSTGRES_PASSWORD=$(rand)
RABBITMQ_PASSWORD=$(rand)
MINIO_PASSWORD=$(rand)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
MQTT_MONOLITH_PASSWORD=${MQTT_MONOLITH_PASSWORD}
# API key gratuita de https://openweathermap.org/api. Vacía: /api/v1/weather responde 502.
OPENWEATHER_API_KEY=
WEATHER_MOCK_ENABLED=false
EOF

mkdir -p secrets
cat > secrets/dron-mqtt.env <<EOF
# Para el .env del flight-controller en la Raspberry Pi.
MQTT_BROKER_HOST=mqtt.${DOMAIN}
MQTT_BROKER_PORT=8883
MQTT_USE_TLS=true
MQTT_USERNAME=dron
MQTT_PASSWORD=${MQTT_DRON_PASSWORD}
EOF

# mosquitto_passwd guarda solo el hash de cada contraseña.
rm -f mosquitto/passwd
touch mosquitto/passwd
docker run --rm \
    -e MQTT_MONOLITH_PASSWORD -e MQTT_DRON_PASSWORD \
    -v "$(pwd)/mosquitto:/work" \
    eclipse-mosquitto:2 sh -c '
        mosquitto_passwd -b /work/passwd monolith "$MQTT_MONOLITH_PASSWORD" &&
        mosquitto_passwd -b /work/passwd dron "$MQTT_DRON_PASSWORD"
    '

echo "Listo: .env, mosquitto/passwd y secrets/dron-mqtt.env (dominio ${DOMAIN})."
