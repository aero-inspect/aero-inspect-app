# Deploy en AWS (una EC2 + docker compose)

Todo AeroInspect en una sola instancia **t3.small** (2 vCPU, 2 GB de RAM + 4 GB de swap) en
`us-east-2`, la región del proyecto de AWS. Está pensado para entrar en los créditos del
plan gratuito: unos **USD 21/mes** con la instancia prendida todo el día.

```
Internet ──443──► Caddy (HTTPS con Let's Encrypt)
                   ├── <DOMAIN>          frontend + /api/** → general-monolith
                   ├── s3.<DOMAIN>       MinIO (fotos y overlays, lectura anónima)
                   └── mqtt.<DOMAIN>     solo para sacar el certificado de Mosquitto
Dron (RPi) ─8883─► Mosquitto (TLS + usuario/contraseña + ACL)
Red interna:  Postgres+PostGIS · RabbitMQ · MinIO · ia-module (worker)
```

`DOMAIN` es la IP elástica en formato [sslip.io](https://sslip.io): `3.14.15.92` →
`3-14-15-92.sslip.io`. No hace falta comprar un dominio.

## Archivos

| Archivo | Qué hace |
|---|---|
| `compose.yml` | El stack completo, con límites de memoria por servicio |
| `Caddyfile` | HTTPS y ruteo de los tres nombres |
| `mosquitto/` | Config del broker, ACL y script de arranque con TLS |
| `rabbitmq/rabbitmq.conf` | Umbral de memoria acorde al contenedor |
| `scripts/bootstrap-ec2.sh` | *User data* de la instancia: Docker, swap y cron |
| `scripts/generate-secrets.sh` | Genera `.env`, `mosquitto/passwd` y las credenciales del dron |
| `scripts/package.ps1` | Arma el `.tar.gz` que se sube a la instancia |

Los Dockerfiles viven en cada repo: `general-monolith/Dockerfile` (empaqueta el JAR ya
compilado) e `ia-module/Dockerfile` (worker con torch CPU y los cuatro modelos).

## 1. Compilar y empaquetar (en la compu)

```powershell
# general-monolith
.\mvnw.cmd -DskipTests package

# ia-module: los modelos de Git LFS tienen que estar bajados
git lfs pull

# aero-inspect-app (VITE_AUTH_MODE no puede ser "no-auth")
npm run build --workspace frontend

# aero-inspect-app/deploy/aws
.\scripts\package.ps1
```

## 2. Probar en la compu (opcional)

Con Docker Desktop, parado en `deploy/aws` y desde Git Bash:

```bash
MSYS_NO_PATHCONV=1 bash scripts/generate-secrets.sh localhost
docker compose up -d --build
docker compose ps
```

La app queda en `https://localhost` (certificado de la CA interna de Caddy: el navegador
avisa). Con `localhost` las URLs de las fotos (`https://s3.localhost/...`) dependen de que
el navegador resuelva `*.localhost`; Chrome y Firefox lo hacen.

Para bajar todo: `docker compose down` (conserva los datos) o `docker compose down -v`
(borra los volúmenes).

## 3. Subir a la instancia

```powershell
scp -i aeroinspect.pem .\out\aeroinspect-deploy.tar.gz ubuntu@<IP>:/opt/aeroinspect/
ssh -i aeroinspect.pem ubuntu@<IP>
```

En la instancia:

```bash
cd /opt/aeroinspect
tar -xzf aeroinspect-deploy.tar.gz
cd aero-inspect-app/deploy/aws
bash scripts/generate-secrets.sh <IP-con-guiones>.sslip.io   # solo la primera vez
docker compose up -d --build
docker compose logs -f general-monolith
```

Para actualizar: volver a subir el paquete, extraerlo encima y repetir `docker compose up -d
--build`. El `.env`, `mosquitto/passwd` y `secrets/` no vienen en el paquete, así que no se
pisan.

## 4. Conectar el dron

`secrets/dron-mqtt.env` (en la instancia) tiene las variables MQTT para el `.env` del
flight-controller. La subida de fotos a S3 desde el dron queda para otro paso: hay que crear
en MinIO un usuario con permiso de escritura solo sobre el bucket.

## Memoria

Los `mem_limit` del compose suman ~1.9 GB. El worker de IA puede usar además hasta ~2 GB de
swap cuando analiza una foto: anda, pero lento. Si no alcanza:

- **Apagar la IA cuando no se usa:** `docker compose stop ia-module`. Las fotos quedan en la
  cola de RabbitMQ y se analizan al volver a prenderla.
- **Más memoria para una demo:** apagar la instancia, cambiarle el tipo a `c7i-flex.large`
  (4 GB, también entra en el plan gratuito, ~USD 0,085/hora) y prenderla. La IP elástica
  no cambia. Al terminar, volver a `t3.small`.

## Costos y cuidados

- La instancia va en modo de CPU **standard**, no "unlimited": si se queda sin créditos de
  CPU se pone lenta en lugar de cobrar extra.
- Apagada, la instancia solo cuesta el disco y la IP (~USD 6/mes).
- Mosquitto lee el certificado solo al arrancar; el cron de `bootstrap-ec2.sh` lo reinicia
  todos los domingos para que tome el que renueva Caddy.
- Solo 80, 443 y 8883 quedan abiertos a internet; el 22 (SSH), solo para tu IP.
