from __future__ import annotations

import asyncio
import logging
from typing import Any

from mavsdk import System
from mavsdk.mission import MissionPlan

from config import Config
from mission_translator import plan_de_vuelo_to_mission_items
from telemetry_state import TelemetrySnapshot

logger = logging.getLogger(__name__)


class FlightController:
    """Envoltorio sobre mavsdk.System: conexión, acciones, misión y tareas de telemetría
    en background que actualizan un TelemetrySnapshot compartido."""

    def __init__(self, config: Config, telemetry_state: TelemetrySnapshot):
        self._config = config
        self._telemetry_state = telemetry_state
        self._drone: System | None = None
        self._telemetry_tasks: list[asyncio.Task] = []

    async def connect(self) -> None:
        if self._config.mavsdk_server_mode == "external":
            self._drone = System(
                mavsdk_server_address=self._config.mavsdk_server_host,
                port=self._config.mavsdk_server_port,
            )
        else:
            self._drone = System()

        await self._drone.connect(system_address=self._config.mavlink_connection)

        logger.info("Esperando conexión MAVLink en %s...", self._config.mavlink_connection)
        async for state in self._drone.core.connection_state():
            if state.is_connected:
                logger.info("Conectado al vehículo")
                break

        self._telemetry_tasks = [
            asyncio.create_task(self._watch_connection_state(), name="watch_connection_state"),
            asyncio.create_task(self._watch_armed(), name="watch_armed"),
            asyncio.create_task(self._watch_in_air(), name="watch_in_air"),
            asyncio.create_task(self._watch_flight_mode(), name="watch_flight_mode"),
            asyncio.create_task(self._watch_position(), name="watch_position"),
            asyncio.create_task(self._watch_velocity(), name="watch_velocity"),
            asyncio.create_task(self._watch_heading(), name="watch_heading"),
            asyncio.create_task(self._watch_battery(), name="watch_battery"),
            asyncio.create_task(self._watch_gps(), name="watch_gps"),
            asyncio.create_task(self._watch_mission_progress(), name="watch_mission_progress"),
        ]

    async def shutdown(self) -> None:
        for task in self._telemetry_tasks:
            task.cancel()
        await asyncio.gather(*self._telemetry_tasks, return_exceptions=True)
        self._telemetry_tasks = []

    # -- tareas de telemetría (background, un asyncio.Task por stream de MAVSDK) --

    async def _watch_connection_state(self) -> None:
        async for state in self._drone.core.connection_state():
            self._telemetry_state.conectado = state.is_connected

    async def _watch_armed(self) -> None:
        async for armed in self._drone.telemetry.armed():
            self._telemetry_state.armado = armed

    async def _watch_in_air(self) -> None:
        async for in_air in self._drone.telemetry.in_air():
            self._telemetry_state.en_vuelo = in_air

    async def _watch_flight_mode(self) -> None:
        async for mode in self._drone.telemetry.flight_mode():
            self._telemetry_state.modo_vuelo = mode

    async def _watch_position(self) -> None:
        async for position in self._drone.telemetry.position():
            self._telemetry_state.posicion = position

    async def _watch_velocity(self) -> None:
        async for velocity in self._drone.telemetry.velocity_ned():
            self._telemetry_state.velocidad = velocity

    async def _watch_heading(self) -> None:
        async for heading in self._drone.telemetry.heading():
            self._telemetry_state.rumbo_deg = heading.heading_deg

    async def _watch_battery(self) -> None:
        async for battery in self._drone.telemetry.battery():
            self._telemetry_state.bateria = battery

    async def _watch_gps(self) -> None:
        async for gps in self._drone.telemetry.gps_info():
            self._telemetry_state.gps = gps

    async def _watch_mission_progress(self) -> None:
        async for progress in self._drone.mission.mission_progress():
            self._telemetry_state.mission_progress = progress
            # progress.total==0 durante los primeros mensajes tras el upload; sólo se
            # considera "completada" una misión que ya estaba en curso.
            if (
                progress.total > 0
                and progress.current == progress.total
                and self._telemetry_state.mision_estado == "EN_CURSO"
            ):
                self._telemetry_state.mision_estado = "COMPLETADA"
                self._telemetry_state.mision_en_pausa = False

    # -- acciones --
    # Los errores de PX4 (arme ilegal, sin GPS, etc.) se propagan como ActionError/MissionError
    # de MAVSDK; el dispatcher los captura y los traduce en un ack RECHAZADO. Este wrapper no
    # reimplementa la lógica de preflight/legalidad de PX4.

    async def arm(self) -> None:
        await self._drone.action.arm()

    async def takeoff(self, altitud_despegue_m: float | None = None) -> None:
        if altitud_despegue_m is not None:
            await self._drone.action.set_takeoff_altitude(altitud_despegue_m)
        await self._drone.action.takeoff()

    async def land(self) -> None:
        await self._drone.action.land()

    async def return_to_launch(self) -> None:
        await self._drone.action.return_to_launch()

    # -- misión --

    async def upload_and_start_mission(self, plan_de_vuelo: dict[str, Any]) -> None:
        mission_items = plan_de_vuelo_to_mission_items(plan_de_vuelo)
        await self._drone.mission.upload_mission(MissionPlan(mission_items))
        await self._drone.mission.start_mission()

    async def pause_mission(self) -> None:
        await self._drone.mission.pause_mission()

    async def resume_mission(self) -> None:
        # MAVSDK no tiene un "resume" propio: reinvocar start_mission() continúa desde el
        # mission item actual en vez de reiniciar la misión.
        await self._drone.mission.start_mission()

    async def abort_mission(self) -> None:
        # Decisión de política: RTL en vez de land() inmediato. A confirmar con quien defina
        # los procedimientos de operación de vuelo.
        try:
            await self._drone.mission.pause_mission()
        except Exception:
            logger.warning(
                "No se pudo pausar la misión antes de abortar, se continúa con RTL",
                exc_info=True,
            )
        await self._drone.action.return_to_launch()
