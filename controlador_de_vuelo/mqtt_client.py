from __future__ import annotations

import asyncio
import json
import logging
import ssl
from typing import Any, Awaitable, Callable

import aiomqtt

import topics
from config import Config

logger = logging.getLogger(__name__)

_RECONNECT_MIN_S = 1
_RECONNECT_MAX_S = 30

OnMessage = Callable[[bytes], Awaitable[None]]


class MqttClient:
    """Envoltorio sobre aiomqtt: conexión con Last Will, publish/subscribe y reconexión
    con backoff exponencial. Todo corre en el mismo event loop que MAVSDK (aiomqtt es
    asyncio-nativo, no hace falta puentear hilos)."""

    def __init__(self, config: Config):
        self._config = config
        self._client: aiomqtt.Client | None = None

    def _build_tls_context(self) -> ssl.SSLContext | None:
        if not self._config.mqtt_use_tls:
            return None
        context = ssl.create_default_context(cafile=self._config.mqtt_tls_ca_cert or None)
        if self._config.mqtt_tls_client_cert and self._config.mqtt_tls_client_key:
            context.load_cert_chain(
                self._config.mqtt_tls_client_cert, self._config.mqtt_tls_client_key
            )
        return context

    async def run(self, on_message: OnMessage) -> None:
        """Se conecta, se suscribe al tópico de comandos y despacha cada mensaje entrante a
        on_message. No retorna salvo cancelación; ante errores de MQTT reintenta con backoff
        exponencial (1s -> 30s)."""
        backoff = _RECONNECT_MIN_S
        comandos_topic = topics.comandos(self._config.drone_id)
        estado_conexion_topic = topics.estado_conexion(self._config.drone_id)
        will = aiomqtt.Will(
            topic=estado_conexion_topic,
            payload=json.dumps({"conectado": False}),
            qos=1,
            retain=True,
        )

        while True:
            try:
                async with aiomqtt.Client(
                    hostname=self._config.mqtt_broker_host,
                    port=self._config.mqtt_broker_port,
                    username=self._config.mqtt_username,
                    password=self._config.mqtt_password,
                    tls_context=self._build_tls_context(),
                    will=will,
                    identifier=self._config.drone_id,
                ) as client:
                    self._client = client
                    backoff = _RECONNECT_MIN_S

                    await client.publish(
                        estado_conexion_topic,
                        json.dumps({"conectado": True}),
                        qos=1,
                        retain=True,
                    )
                    await client.subscribe(comandos_topic)
                    logger.info(
                        "Conectado a MQTT %s:%s, suscripto a %s",
                        self._config.mqtt_broker_host,
                        self._config.mqtt_broker_port,
                        comandos_topic,
                    )

                    async for message in client.messages:
                        await on_message(message.payload)
            except aiomqtt.MqttError as exc:
                logger.warning(
                    "Error de conexión MQTT (%s), reintentando en %ss", exc, backoff
                )
                self._client = None
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, _RECONNECT_MAX_S)

    async def publish(self, topic: str, payload: dict[str, Any]) -> None:
        if self._client is None:
            logger.warning("publish() sin conexión MQTT activa, se descarta: %s", topic)
            return
        try:
            await self._client.publish(topic, json.dumps(payload), qos=0)
        except aiomqtt.MqttError:
            logger.warning("Fallo al publicar en %s, se descarta el mensaje", topic, exc_info=True)
