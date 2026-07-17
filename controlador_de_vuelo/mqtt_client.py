from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Awaitable, Callable

import paho.mqtt.client as paho

import topics
from config import Config

logger = logging.getLogger(__name__)

_RECONNECT_MIN_S = 1
_RECONNECT_MAX_S = 30

OnMessage = Callable[[bytes], Awaitable[None]]


class MqttClient:
    """Envoltorio sobre paho-mqtt en modo threaded (loop_start()): un hilo de red propio de
    paho maneja el socket, y los mensajes entrantes se puentean al event loop de asyncio vía
    una asyncio.Queue thread-safe.

    Se eligió este modelo en vez de un cliente asyncio-nativo (aiomqtt) porque aiomqtt tiene
    un bug confirmado en Windows nativo: conecta y suscribe sin error, pero nunca entrega
    mensajes después del handshake inicial, incluso aplicando el workaround documentado de
    WindowsSelectorEventLoopPolicy (asyncio.add_reader()/add_writer() sobre un socket handle
    de Windows). El mismo broker, con paho-mqtt en modo threaded (sin pasar por asyncio en
    absoluto para el I/O de red), funciona sin problemas. Este modelo es además el más usado
    y probado de la librería, en cualquier SO — por eso se adoptó también para Linux/Raspberry
    Pi, no sólo como parche para Windows."""

    def __init__(self, config: Config):
        self._config = config
        self._comandos_topic = topics.comandos(config.drone_id)
        self._estado_conexion_topic = topics.estado_conexion(config.drone_id)
        self._incoming: asyncio.Queue[bytes] = asyncio.Queue()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._client = self._build_client()

    def _build_client(self) -> paho.Client:
        config = self._config
        client = paho.Client(
            paho.CallbackAPIVersion.VERSION2,
            client_id=config.drone_id,
            reconnect_on_failure=True,
        )
        if config.mqtt_username:
            client.username_pw_set(config.mqtt_username, config.mqtt_password)
        if config.mqtt_use_tls:
            client.tls_set(
                ca_certs=config.mqtt_tls_ca_cert,
                certfile=config.mqtt_tls_client_cert,
                keyfile=config.mqtt_tls_client_key,
            )
        client.will_set(
            self._estado_conexion_topic,
            json.dumps({"conectado": False}),
            qos=1,
            retain=True,
        )
        client.reconnect_delay_set(min_delay=_RECONNECT_MIN_S, max_delay=_RECONNECT_MAX_S)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        return client

    # -- callbacks de paho-mqtt: corren en el hilo de red interno de loop_start(), nunca en
    # el event loop de asyncio. Sólo tocan estado thread-safe (logging, o el puente hacia la
    # asyncio.Queue vía call_soon_threadsafe). --

    def _on_connect(self, client, userdata, flags, reason_code, properties=None) -> None:
        if reason_code != 0:
            logger.warning("Conexión MQTT rechazada por el broker: %s", reason_code)
            return
        logger.info(
            "Conectado a MQTT %s:%s, suscripto a %s",
            self._config.mqtt_broker_host,
            self._config.mqtt_broker_port,
            self._comandos_topic,
        )
        client.publish(
            self._estado_conexion_topic, json.dumps({"conectado": True}), qos=1, retain=True
        )
        client.subscribe(self._comandos_topic)

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None) -> None:
        logger.warning(
            "Desconectado de MQTT (%s); paho-mqtt reintentará automáticamente", reason_code
        )

    def _on_message(self, client, userdata, message) -> None:
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._incoming.put_nowait, message.payload)

    async def run(self, on_message: OnMessage) -> None:
        """Conecta y despacha cada mensaje entrante a on_message. La reconexión tras la
        conexión inicial la maneja paho-mqtt internamente (loop_start() + reconnect_on_failure);
        acá sólo se reintenta con backoff el intento de conexión inicial. No retorna salvo
        cancelación."""
        self._loop = asyncio.get_running_loop()

        backoff = _RECONNECT_MIN_S
        while True:
            try:
                await self._loop.run_in_executor(
                    None,
                    self._client.connect,
                    self._config.mqtt_broker_host,
                    self._config.mqtt_broker_port,
                )
                break
            except OSError as exc:
                logger.warning(
                    "No se pudo conectar a MQTT (%s), reintentando en %ss", exc, backoff
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, _RECONNECT_MAX_S)

        self._client.loop_start()
        try:
            while True:
                payload = await self._incoming.get()
                await on_message(payload)
        finally:
            self._client.loop_stop()
            self._client.disconnect()

    async def publish(self, topic: str, payload: dict[str, Any]) -> None:
        if not self._client.is_connected():
            logger.warning("publish() sin conexión MQTT activa, se descarta: %s", topic)
            return
        self._client.publish(topic, json.dumps(payload), qos=0)
