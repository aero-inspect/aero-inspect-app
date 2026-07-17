from __future__ import annotations

import asyncio
import logging
import signal

from config import Config
from dispatcher import CommandDispatcher
from flight_controller import FlightController
from logging_setup import configure_logging
from mqtt_client import MqttClient
from telemetry_publisher import run as run_telemetry_publisher
from telemetry_state import TelemetrySnapshot

logger = logging.getLogger(__name__)


async def main() -> None:
    config = Config.from_env()
    configure_logging(config.log_level)

    telemetry_state = TelemetrySnapshot()
    flight_controller = FlightController(config, telemetry_state)
    mqtt_client = MqttClient(config)
    dispatcher = CommandDispatcher(config.drone_id, flight_controller, telemetry_state)

    logger.info("Conectando a MAVLink en %s...", config.mavlink_connection)
    await flight_controller.connect()

    async def on_message(raw_payload: bytes) -> None:
        for topic, payload in await dispatcher.handle(raw_payload):
            await mqtt_client.publish(topic, payload)

    tasks = [
        asyncio.create_task(mqtt_client.run(on_message), name="mqtt_client"),
        asyncio.create_task(
            run_telemetry_publisher(
                config.drone_id,
                telemetry_state,
                mqtt_client,
                config.telemetry_publish_rate_hz,
            ),
            name="telemetry_publisher",
        ),
    ]

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is None:
            continue
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            # Windows: add_signal_handler no está soportado; Ctrl+C llega como
            # KeyboardInterrupt y cancela la tarea principal, cubierto por el finally.
            pass

    try:
        await stop_event.wait()
        logger.info("Señal de apagado recibida, cerrando...")
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await flight_controller.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
