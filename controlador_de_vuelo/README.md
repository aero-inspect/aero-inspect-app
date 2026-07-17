# Módulo de Control de Vuelo

Daemon en Python que corre en la Raspberry Pi del dron. Se conecta al Pixhawk 6C (PX4) por
MAVLink usando **MAVSDK-Python**, y a un broker **MQTT** para recibir comandos y publicar
telemetría. Ver `documentacion/hardware/componentes_hardware.md` (§2.8) para el rol de este
componente en la arquitectura general.

Alcance de esta primera versión: arm/despegue/aterrizaje/RTL, subir e iniciar una misión de
waypoints, pausar/reanudar/abortar, y streaming de telemetría. Control de cámara/gimbal (SIYI
A8 mini) y sincronización de imágenes a S3 quedan fuera de alcance.

## Instalación

```bash
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements-dev.txt
copy .env.example .env
```

## Configuración

Ver `.env.example`. Las variables clave:

- `MQTT_BROKER_HOST`/`MQTT_BROKER_PORT`: broker MQTT (Mosquitto local en dev, AWS IoT Core en producción).
- `DRONE_ID`: identifica al dron y sirve de namespace para los tópicos MQTT (equivale a `Dron.mqttClientId` del modelo de dominio).
- `MAVLINK_CONNECTION`: `udp://:14540` contra el simulador SITL, `serial:///dev/ttyAMA0:<baud>` en la Raspberry Pi real conectada al Pixhawk.
- `MAVSDK_SERVER_MODE`: `embedded` (por defecto, `mavsdk.System()` levanta su propio binario `mavsdk_server`) o `external` (se asume un `mavsdk_server` corriendo aparte, necesario si no hay wheel de MAVSDK con binario para la arquitectura ARM de la Pi — ver nota abajo).

## Correr contra el simulador (dev)

1. Levantar un broker Mosquitto local, por ejemplo: `docker run --rm -it -p 1883:1883 eclipse-mosquitto`.
2. Levantar el simulador PX4 SITL siguiendo `simulador/instalacion.md`.
3. Verificar que los paquetes MAVLink lleguen al host en el puerto UDP 14540 (no solo 14550,
   que ya usa QGroundControl) — si el `docker run` del simulador no expone ese puerto, agregar
   `-p 14540:14540/udp -p 14550:14550/udp` al comando.
4. Con el `.env` apuntando a `MQTT_BROKER_HOST=localhost` y `MAVLINK_CONNECTION=udp://:14540`:

   ```bash
   python main.py
   ```

5. Desde otra terminal, observar los tópicos y enviar comandos de prueba:

   ```bash
   mosquitto_sub -t 'aeroinspect/dron/dron-x500-01/#' -v
   mosquitto_pub -t 'aeroinspect/dron/dron-x500-01/comandos' -m '{"comandoId":"1","tipo":"ARMAR","timestamp":"2026-07-17T00:00:00Z","payload":null}'
   ```

## Tests

```bash
pytest
```

Los tests son unitarios y no requieren hardware ni simulador: mockean `mavsdk.System` y
validan el parseo de comandos, la traducción de waypoints y el dispatcher.

## Riesgo conocido: `mavsdk_server` en Raspberry Pi

El paquete `mavsdk` de PyPI incluye un binario `mavsdk_server` que `mavsdk.System()` levanta
automáticamente. Existen wheels con ese binario para x86_64 (por eso el modo `embedded`
funciona sin problema en una PC de desarrollo contra el simulador), pero no siempre hay wheels
para arquitecturas ARM de Raspberry Pi (más aún si el SO es de 32 bits, `armv7l`, en vez de 64
bits, `aarch64`). Si al correr esto en la Pi real no hay wheel compatible, hay que compilar
`mavsdk_server` desde el código fuente de MAVSDK para esa arquitectura y correrlo como proceso
aparte (`MAVSDK_SERVER_MODE=external`). Se recomienda validar esto con una prueba mínima en la
Raspberry Pi real antes de depender del resto de este módulo.
