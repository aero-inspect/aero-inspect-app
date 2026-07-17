from __future__ import annotations

import asyncio
import datetime
import logging

import topics
from mqtt_client import MqttClient
from telemetry_state import TelemetrySnapshot

logger = logging.getLogger(__name__)


async def run(
    drone_id: str,
    telemetry_state: TelemetrySnapshot,
    mqtt_client: MqttClient,
    publish_rate_hz: float,
) -> None:
    topic = topics.telemetria(drone_id)
    period_s = 1.0 / publish_rate_hz

    while True:
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        await mqtt_client.publish(topic, telemetry_state.to_payload(timestamp))
        await asyncio.sleep(period_s)
