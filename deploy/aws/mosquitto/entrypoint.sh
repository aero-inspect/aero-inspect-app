#!/bin/sh
# Arranque de Mosquitto: copia config, ACL y contraseñas a /mosquitto/config con los permisos
# que exige Mosquitto 2, y si Caddy ya sacó el certificado de mqtt.$DOMAIN, lo copia y
# habilita el listener TLS en el 8883.
#
# Caddy renueva el certificado solo, pero Mosquitto lo lee únicamente al arrancar: por eso
# scripts/bootstrap-ec2.sh programa un reinicio semanal de este contenedor.
set -eu

CONF_DIR=/mosquitto/config
CERT_DIR=/mosquitto/certs
SRC=/mosquitto/bootstrap
HOST="mqtt.${DOMAIN}"

mkdir -p "$CONF_DIR" "$CERT_DIR"
cp "$SRC/mosquitto.conf" "$CONF_DIR/mosquitto.conf"
cp "$SRC/acl" "$CONF_DIR/acl"
cp "$SRC/passwd" "$CONF_DIR/passwd"

find_cert() {
    find /caddy-data/caddy/certificates -type f -path "*/$HOST/$HOST.crt" 2>/dev/null | head -n 1
}

# En el primer arranque Caddy puede tardar en emitir el certificado.
cert=""
i=0
while [ $i -lt 24 ]; do
    cert="$(find_cert)"
    [ -n "$cert" ] && break
    echo "Esperando el certificado de $HOST que emite Caddy ($i/24)..."
    sleep 5
    i=$((i + 1))
done

if [ -n "$cert" ]; then
    cp "$cert" "$CERT_DIR/server.crt"
    cp "${cert%.crt}.key" "$CERT_DIR/server.key"
    cat >> "$CONF_DIR/mosquitto.conf" <<EOF

# Para el dron, desde internet. Agregado por entrypoint.sh con el certificado de $HOST.
listener 8883
certfile $CERT_DIR/server.crt
keyfile $CERT_DIR/server.key
EOF
    echo "TLS habilitado en 8883 con el certificado de $HOST"
else
    echo "AVISO: no hay certificado para $HOST; arranca sin el listener 8883." >&2
    echo "Reiniciar este contenedor cuando Caddy lo haya emitido." >&2
fi

chown -R mosquitto:mosquitto "$CONF_DIR" "$CERT_DIR" /mosquitto/data
chmod 0700 "$CONF_DIR/passwd" "$CONF_DIR/acl" "$CERT_DIR/server.key" 2>/dev/null || true

exec /usr/sbin/mosquitto -c "$CONF_DIR/mosquitto.conf"
