#!/bin/bash
# Preparación de la instancia EC2 (Ubuntu 24.04). Va como "user data": corre una sola vez,
# como root, en el primer arranque. El log queda en /var/log/cloud-init-output.log.
#
# - Docker Engine + plugin de compose desde el repositorio oficial de Docker.
# - 4 GB de swap: con 2 GB de RAM, el worker de IA lo necesita para cargar los modelos.
# - Carpeta /opt/aeroinspect para el paquete que sube scripts/package.ps1.
# - Reinicio semanal de Mosquitto para que tome el certificado que renueva Caddy.
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

# --- Swap ---
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- Docker (https://docs.docker.com/engine/install/ubuntu/) ---
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu

# Los logs de los contenedores no pueden llenar el disco de 25 GB.
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl restart docker

# --- Carpeta de la app ---
install -d -o ubuntu -g ubuntu /opt/aeroinspect

# --- Reinicio semanal de Mosquitto (domingo 4:00 UTC) ---
cat > /etc/cron.d/aeroinspect-mosquitto <<'EOF'
0 4 * * 0 ubuntu cd /opt/aeroinspect/aero-inspect-app/deploy/aws && docker compose restart mosquitto >/dev/null 2>&1
EOF
