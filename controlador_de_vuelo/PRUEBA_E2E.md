# Prueba End-to-End — Módulo de Control de Vuelo

Esta guía tiene dos partes:

1. **Cómo correr la prueba E2E en Windows** contra el simulador PX4 SITL — para desarrollo,
   sin necesidad del dron real.
2. **Qué cambia para probarlo en la Raspberry Pi**, conectada al Pixhawk 6C real.

---

## 1. Prueba E2E en Windows (simulador)

### 1.1 Prerrequisitos

- Docker Desktop instalado, con el engine corriendo (icono en la bandeja del sistema debe
  decir "Engine running").
- Python 3.11+ instalado.

### 1.2 Antes de arrancar: chequear que el puerto 1883 esté libre

**Este paso evita horas de debugging.** Si ya tenés un broker MQTT corriendo nativamente en
Windows (por ejemplo, un servicio "Mosquitto Broker" instalado por otro proyecto), va a
quedar escuchando en `127.0.0.1:1883` en paralelo al contenedor Docker. Cualquier cliente que
se conecte a `localhost:1883` va a terminar hablando con ese broker en vez del contenedor,
**sin ningún error visible** — `connect()`/`publish()` van a reportar éxito pero nada va a
llegar a destino.

Chequealo así:

```powershell
Get-Service | Where-Object { $_.Name -like '*mosquitto*' }
netstat -ano | findstr ":1883"
```

Si aparece algo, ya sea un servicio de Windows o un proceso escuchando en `127.0.0.1:1883`
que no sea el `docker-proxy`/`com.docker.backend.exe` del contenedor que vas a levantar en el
paso siguiente, usá un puerto distinto para el contenedor (por ejemplo `11883`) y ajustá
`MQTT_BROKER_PORT` en el `.env` más abajo. Si no aparece nada, seguí con el 1883 normal.

### 1.3 Levantar un broker Mosquitto local

El repo ya trae un config listo en `controlador_de_vuelo/mosquitto-config/mosquitto.conf`
(habilita conexiones anónimas — la imagen oficial de `eclipse-mosquitto` las rechaza por
defecto). Desde `controlador_de_vuelo/`:

```powershell
# Puerto 1883 libre:
docker run -d --name mosquitto -p 1883:1883 -v "$PWD\mosquitto-config:/mosquitto/config" eclipse-mosquitto

# Si el 1883 está ocupado (ver 1.2), usar otro puerto de host:
docker run -d --name mosquitto -p 11883:1883 -v "$PWD\mosquitto-config:/mosquitto/config" eclipse-mosquitto
```

Verificar que arrancó bien (no debe decir "Error: Unable to open config file"):

```powershell
docker logs mosquitto
```

### 1.4 Levantar el simulador PX4 SITL

Ver `simulador/instalacion.md`. Versión detached para no ocupar la terminal:

```powershell
docker run -d --name px4-sitl -e PX4_SIM_HOST_ADDR=host-gateway jonasvautherin/px4-gazebo-headless:latest
docker logs -f px4-sitl   # esperar a que esté listo, Ctrl+C para dejar de seguir el log
```

No hizo falta agregar `-p 14540:14540/udp` en las pruebas hechas hasta ahora (PX4 manda los
paquetes MAVLink hacia afuera del contenedor, no hace falta publicar el puerto para ese
sentido del tráfico) — pero si el módulo se queda colgado en "Esperando conexión MAVLink..."
en el paso 1.8, esto es lo primero para probar:

```powershell
docker rm -f px4-sitl
docker run -d --name px4-sitl -e PX4_SIM_HOST_ADDR=host-gateway -p 14540:14540/udp -p 14550:14550/udp jonasvautherin/px4-gazebo-headless:latest
```

### 1.5 Entorno Python

```powershell
cd controlador_de_vuelo
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
```

### 1.6 `mavsdk_server` en Windows (paso obligatorio, no es opcional)

El `pip install mavsdk` en Windows **no** trae el binario `mavsdk_server` embebido (bug de
nomenclatura entre MAVSDK-Python y las releases de MAVSDK: busca `mavsdk_server_win_x64.exe`,
que no existe; el asset real se llama `mavsdk_server_win32.exe`). Si corrés el módulo sin
este paso vas a ver un error explícito pidiendo exactamente esto:

1. Confirmar la versión de `mavsdk` instalada y la versión de server que le corresponde:

   ```powershell
   pip show mavsdk
   # ej: Version: 1.4.8
   ```

   Buscar el archivo `MAVSDK_SERVER_VERSION` en el tag correspondiente de
   [MAVSDK-Python](https://github.com/mavlink/MAVSDK-Python) (para `1.4.8` es `v1.4.16`).

2. Descargar el binario Windows de esa versión de [MAVSDK releases](https://github.com/mavlink/MAVSDK/releases):

   ```powershell
   Invoke-WebRequest -Uri "https://github.com/mavlink/MAVSDK/releases/download/v1.4.16/mavsdk_server_win32.exe" -OutFile "mavsdk_server.exe"
   ```

   (Está gitignoreado — no hace falta, ni conviene, commitearlo.)

3. Correrlo en una terminal aparte, apuntando al mismo puerto UDP que usa el simulador:

   ```powershell
   .\mavsdk_server.exe -p 50051
   ```

   Debería loguear algo como `System discovered` una vez que encuentra al PX4 SITL.

### 1.7 Configurar `.env`

Editar `controlador_de_vuelo/.env` (copiado de `.env.example` en el paso 1.5):

```
MQTT_BROKER_PORT=1883        # o 11883 si tuviste que usar otro puerto en 1.3
MAVSDK_SERVER_MODE=external  # obligatorio en Windows, ver 1.6
```

El resto de los valores por defecto (`MAVLINK_CONNECTION=udp://:14540`,
`MQTT_BROKER_HOST=localhost`, etc.) ya están bien para este setup.

### 1.8 Correr el módulo

```powershell
python main.py
```

Logs esperados, en este orden:

```
INFO __main__: Conectando a MAVLink en udp://:14540...
INFO flight_controller: Esperando conexión MAVLink en udp://:14540...
INFO flight_controller: Conectado al vehículo
INFO mqtt_client: Conectado a MQTT localhost:<puerto>, suscripto a aeroinspect/dron/dron-x500-01/comandos
```

Si se cuelga en "Esperando conexión MAVLink...", ver el troubleshooting del paso 1.4.
Si "Conectado a MQTT..." nunca aparece, o aparece pero nada de lo que sigue funciona, ver el
troubleshooting del paso 1.2 (colisión de puerto).

### 1.9 Enviar comandos de prueba

Windows no trae `mosquitto_pub`/`mosquitto_sub` nativos — usar los que vienen dentro del
contenedor de Mosquitto (en otra terminal, dejar corriendo el `sub` mientras se manda el `pub`
desde una tercera):

```powershell
# mirar todo el tráfico del dron
docker exec -it mosquitto mosquitto_sub -t "aeroinspect/dron/dron-x500-01/#" -v
```

```powershell
# mandar comandos
docker exec -it mosquitto mosquitto_pub -t "aeroinspect/dron/dron-x500-01/comandos" -m "{\"comandoId\":\"1\",\"tipo\":\"ARMAR\",\"timestamp\":\"2026-07-17T00:00:00Z\",\"payload\":null}"
docker exec -it mosquitto mosquitto_pub -t "aeroinspect/dron/dron-x500-01/comandos" -m "{\"comandoId\":\"2\",\"tipo\":\"DESPEGAR\",\"timestamp\":\"2026-07-17T00:00:00Z\",\"payload\":null}"
docker exec -it mosquitto mosquitto_pub -t "aeroinspect/dron/dron-x500-01/comandos" -m "{\"comandoId\":\"3\",\"tipo\":\"RTL\",\"timestamp\":\"2026-07-17T00:00:00Z\",\"payload\":null}"
```

Resultado esperado en la terminal del `sub`: un `.../comandos/ack` con `"resultado":"ACEPTADO"`
por cada comando, y `.../telemetria` publicando cada 1 segundo reflejando los cambios
(`"armado": true` después de ARMAR, `"modoVuelo": "RETURN_TO_LAUNCH"` después de RTL, etc.).
Opcionalmente, abrir QGroundControl contra el mismo simulador para ver el dron moverse.

### 1.10 Troubleshooting — resumen rápido

| Síntoma | Causa probable | Solución |
|---|---|---|
| `This installation does not provide an embedded 'mavsdk_server' binary` | Wheel de Windows sin binario embebido | Paso 1.6 |
| Se cuelga en "Esperando conexión MAVLink..." | El contenedor SITL no expone el UDP 14540 al host | Paso 1.4 |
| "Conectado a MQTT..." aparece pero nunca llegan acks/telemetría a `mosquitto_sub` | Colisión de puerto con otro broker local | Paso 1.2 |
| `Exception ... add_reader ... NotImplementedError` | Sólo pasa si se vuelve a aiomqtt en vez de paho-mqtt (ver README) | No debería pasar con el código actual |

### 1.11 Limpieza

```powershell
docker stop mosquitto px4-sitl
docker rm mosquitto px4-sitl
```

Y cerrar la terminal donde quedó corriendo `mavsdk_server.exe`.

---

## 2. Cambios para probar en la Raspberry Pi (hardware real)

Todo lo de la sección 1 corre igual en la Pi (mismo `main.py`, mismo protocolo MQTT, mismo
MAVSDK) — el simulador PX4 SITL corre el mismo firmware que la Pixhawk 6C real (ver
`documentacion/hardware/componentes_hardware.md` §6). Lo que cambia es la configuración y
algunos pasos de sistema operativo específicos de la Pi. **No hace falta Docker Desktop ni
Windows en la Pi** — Python corre directo sobre Raspberry Pi OS.

### 2.1 Resumen de lo que cambia

| Ítem | Windows (SITL) | Raspberry Pi (hardware real) |
|---|---|---|
| `MAVLINK_CONNECTION` | `udp://:14540` | `serial:///dev/ttyAMA0:<baud>` |
| `mavsdk_server` | binario Windows, modo `external` | binario Linux ARM, modo `external` (probablemente) |
| Broker MQTT | Mosquitto local en Docker | El broker real (AWS IoT Core u otro), no local |
| UART | no aplica | hay que habilitarlo y liberarlo de Bluetooth (Pi 3B) |
| Cableado | no aplica | TELEM2 del Pixhawk ↔ GPIO UART de la Pi |

### 2.2 Habilitar el UART en la Raspberry Pi

La Raspberry Pi 3B tiene una sola UART "completa" (PL011), y por defecto **Bluetooth la usa**;
el conector GPIO queda con la mini-UART (`/dev/ttyS0`), que no es confiable a baud rates
altos porque su clock depende de la frecuencia del core. Para MAVLink conviene liberar la
PL011 para el GPIO:

```bash
sudo raspi-config
# Interface Options -> Serial Port
#   "¿Login shell accesible por serial?" -> No
#   "¿Habilitar hardware del puerto serial?" -> Sí
```

Y en `/boot/firmware/config.txt` (o `/boot/config.txt` en versiones más viejas de Raspberry Pi OS):

```
enable_uart=1
dtoverlay=disable-bt
```

```bash
sudo systemctl disable hciuart
sudo reboot
```

Después del reboot, `/dev/ttyAMA0` (o el symlink `/dev/serial0`) es la UART completa
conectada a los pines GPIO14 (TXD)/GPIO15 (RXD).

Agregar el usuario al grupo `dialout` para no necesitar `sudo` al abrir el puerto serie:

```bash
sudo usermod -aG dialout $USER
# cerrar sesión y volver a entrar para que tome efecto
```

### 2.3 Cableado Pixhawk 6C ↔ Raspberry Pi

Usar el puerto `TELEM2` del Pixhawk (JST-GH 6 pines, ver diagrama de cableado en
`documentacion/hardware/componentes_hardware.md` §2.2), conectando sólo TX, RX y GND —
**cruzados**:

- Pixhawk `TELEM2 TX` → Pi `RXD` (GPIO15, pin físico 10)
- Pixhawk `TELEM2 RX` → Pi `TXD` (GPIO14, pin físico 8)
- Pixhawk `TELEM2 GND` → Pi `GND`

**No conectar el pin de 5V del TELEM2 a la Raspberry Pi** — la Pi se alimenta aparte, por su
propio BEC (ver `componentes_hardware.md` §2.6); alimentarla también desde el Pixhawk puede
generar un conflicto de tierras/alimentación entre dos fuentes.

En QGroundControl, configurar los parámetros del Pixhawk para habilitar MAVLink en TELEM2:

- `SER_TEL2_BAUD`: fijar un baud rate y anotarlo (ej. `921600`) — tiene que coincidir
  exactamente con el que se use en `MAVLINK_CONNECTION` más abajo.
- El instance de MAVLink en TELEM2 (`MAV_1_CONFIG` o similar según versión de PX4) tiene que
  estar seteado a `TELEM2`, con modo `Onboard` (compañero de a bordo), no `Normal`/GCS.

### 2.4 Entorno Python en la Pi

Igual que en Windows, pero sin Docker:

```bash
sudo apt update
sudo apt install python3-venv python3-pip
cd controlador_de_vuelo
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

### 2.5 `mavsdk_server` en la Pi (ARM)

Mismo problema potencial que en Windows (paso 1.6), pero para Linux ARM. Primero probar si el
modo `embedded` funciona directamente (en Linux es más común que el wheel sí traiga el
binario, pero no está garantizado para ARM):

```bash
python -c "from mavsdk import System; import asyncio; asyncio.run(System().connect())"
```

Si tira el mismo error de "no provee un binario embebido", bajar el binario Linux ARM
correspondiente:

1. Confirmar arquitectura y versión:

   ```bash
   uname -m           # armv7l (32 bits) o aarch64 (64 bits)
   pip show mavsdk     # ej: Version: 1.4.8 -> server pineado v1.4.16 (ver paso 1.6)
   ```

2. Descargar el asset que corresponda desde [MAVSDK releases](https://github.com/mavlink/MAVSDK/releases):
   - `armv7l` → `mavsdk_server_linux-armv7l-musl`
   - `aarch64` → `mavsdk_server_linux-arm64-musl`

   ```bash
   curl -L -o mavsdk_server "https://github.com/mavlink/MAVSDK/releases/download/v1.4.16/mavsdk_server_linux-armv7l-musl"
   chmod +x mavsdk_server
   ```

3. Correrlo aparte, apuntando al puerto serie real (no UDP):

   ```bash
   ./mavsdk_server -p 50051 serial:///dev/ttyAMA0:921600
   ```

   Si conecta bien debería loguear `System discovered` apenas el Pixhawk esté encendido y con
   el cableado del paso 2.3 correcto.

Si tampoco hay binario prebuilt para esa combinación exacta de arquitectura/libc, hace falta
compilar `mavsdk_server` desde el código fuente de MAVSDK para la Pi (ver
[Building MAVSDK on Linux](https://mavsdk.mavlink.io/) en la documentación oficial) — no
verificado en este proyecto todavía.

### 2.6 Configurar `.env` para hardware real

```
MAVLINK_CONNECTION=serial:///dev/ttyAMA0:921600   # el baud tiene que matchear SER_TEL2_BAUD (paso 2.3)
MAVSDK_SERVER_MODE=external                        # si hizo falta el paso 2.5
MAVSDK_SERVER_HOST=localhost
MAVSDK_SERVER_PORT=50051

MQTT_BROKER_HOST=<endpoint del broker real>         # no localhost — ver 2.9
MQTT_BROKER_PORT=8883
MQTT_USE_TLS=true
MQTT_TLS_CA_CERT=/ruta/a/ca.pem
MQTT_TLS_CLIENT_CERT=/ruta/a/cliente.pem
MQTT_TLS_CLIENT_KEY=/ruta/a/cliente.key
```

### 2.7 Validar la conexión mínima antes de todo lo demás

Antes de asumir que todo el módulo funciona, confirmar por separado:

1. Que el `mavsdk_server` (paso 2.5) loguea `System discovered` con el Pixhawk real conectado
   y armado eléctricamente (batería puesta, **sin hélices** — ver
   `componentes_hardware.md` §5, sección de seguridad).
2. Recién ahí correr `python main.py` y repetir la prueba de comandos del paso 1.9, apuntando
   `docker exec mosquitto_pub/sub` (o el broker real) al `DRONE_ID` configurado.

### 2.8 (Opcional) Correr como servicio systemd

Para que el módulo arranque solo al bootear la Pi, envolver `python main.py` en una unit de
systemd con `Restart=on-failure`. No implementado todavía — queda como tarea futura, fuera del
alcance de esta prueba E2E.

### 2.9 Broker MQTT: local (dev) vs remoto (real)

En Windows probamos contra un Mosquitto local en Docker. En la Pi real, el broker no corre en
la propia Pi — es el "Broker MQTT" en AWS IoT Core del diagrama de arquitectura
(`documentacion/hardware/img/image.png`), al que el backend también se conecta. Eso implica:

- `MQTT_USE_TLS=true` y certificados cliente (AWS IoT Core exige mTLS) en vez de conexión
  anónima.
- No hace falta levantar nada de Docker en la Pi para el broker — sólo la conectividad de red
  (WiFi 2.4 GHz, único soportado por la Raspberry Pi 3B, ver `componentes_hardware.md` §2.8)
  hacia el endpoint de AWS IoT Core.
- Para una primera prueba de humo sin depender de credenciales de AWS todavía, se puede seguir
  usando un Mosquitto local (en la misma Pi o en otra máquina de la red) tal como en Windows,
  sólo cambiando `MQTT_BROKER_HOST` a la IP correspondiente en vez de `localhost`.
