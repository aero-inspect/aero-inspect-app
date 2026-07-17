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
- `MAVSDK_SERVER_MODE`: `embedded` (por defecto, `mavsdk.System()` levanta su propio binario `mavsdk_server`) o `external` (se asume un `mavsdk_server` corriendo aparte). Ver "Riesgo conocido" abajo — en la práctica, hoy hace falta `external` tanto en Windows como en la Raspberry Pi.

## Correr contra el simulador (dev) / en la Raspberry Pi real

Guía paso a paso completa, con troubleshooting, en **[PRUEBA_E2E.md](PRUEBA_E2E.md)**:
levantar Mosquitto + PX4 SITL en Windows, correr el módulo, mandar comandos de prueba, y qué
cambia (cableado UART, `mavsdk_server` para ARM, broker remoto) para probarlo en la Raspberry
Pi conectada al Pixhawk 6C real.

## Tests

```bash
pytest
```

Los tests son unitarios y no requieren hardware ni simulador: mockean `mavsdk.System` y
validan el parseo de comandos, la traducción de waypoints y el dispatcher.

## Por qué paho-mqtt en modo threaded y no un cliente asyncio-nativo

`mqtt_client.py` usa `paho-mqtt` con su modelo threaded (`loop_start()`, un hilo de red propio)
en vez de un cliente 100% asyncio-nativo como `aiomqtt`. Ambos fueron probados y **ambos
funcionan correctamente** una vez resuelto el problema de puerto descripto arriba — la elección
final es por robustez/simplicidad (el modelo threaded de paho-mqtt es el más usado y probado de
la librería, y no depende de que `asyncio.add_reader()`/`add_writer()` funcionen bien sobre un
socket handle nativo de Windows, que es una fuente conocida de dolores de cabeza multiplataforma),
no porque `aiomqtt` esté roto. Los mensajes entrantes se puentean al event loop de asyncio vía una
`asyncio.Queue` con `loop.call_soon_threadsafe()`.

## Riesgo conocido: `mavsdk_server` no viene embebido (Windows y Raspberry Pi)

El paquete `mavsdk` de PyPI debería incluir un binario `mavsdk_server` que `mavsdk.System()`
levanta automáticamente (modo `embedded`), pero en la práctica **esto falló tanto en Windows
como se esperaba que fallara en Raspberry Pi/ARM** — en Windows, el instalador busca un archivo
llamado `mavsdk_server_win_x64.exe` que no existe en los releases de MAVSDK (el asset real se
llama `mavsdk_server_win32.exe`, un bug de nomenclatura entre MAVSDK-Python y las releases de
MAVSDK), así que `mavsdk/bin/` queda vacío tras el `pip install`.

**Solución usada (modo `external`):**

1. Descargar el binario que corresponda a la versión de `mavsdk` instalada. Para
   `mavsdk==1.4.8` (revisar `pip show mavsdk`), el server pineado es `v1.4.16`
   (`MAVSDK_SERVER_VERSION` en el repo de MAVSDK-Python):

   ```
   https://github.com/mavlink/MAVSDK/releases/download/v1.4.16/mavsdk_server_win32.exe
   ```

   (En Linux/Raspberry Pi, los assets equivalentes son `mavsdk_server_linux-armv7l-musl` /
   `mavsdk_server_linux-arm64-musl` según la arquitectura del SO — no verificado aún en
   hardware real, ver nota abajo.)

2. Guardarlo como `mavsdk_server.exe` en `controlador_de_vuelo/` (gitignored — no se commitea
   el binario) y correrlo aparte:

   ```bash
   ./mavsdk_server.exe -p 50051
   ```

3. En `.env`: `MAVSDK_SERVER_MODE=external`, `MAVSDK_SERVER_HOST=localhost`, `MAVSDK_SERVER_PORT=50051`.

Sigue pendiente confirmar esto en la Raspberry Pi 3B real (arquitectura ARM, posiblemente
32 bits `armv7l`): puede hacer falta compilar `mavsdk_server` desde el código fuente de MAVSDK
si tampoco hay un asset prebuilt para esa combinación exacta de arquitectura/libc. Se recomienda
una prueba mínima de "conectar + armar contra el Pixhawk real" en la Pi antes de depender del
resto de este módulo.
