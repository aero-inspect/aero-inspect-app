from __future__ import annotations

import math
from dataclasses import dataclass

from mavsdk.mission import MissionProgress
from mavsdk.telemetry import Battery, FlightMode, GpsInfo, Position, VelocityNed


@dataclass
class TelemetrySnapshot:
    """Estado compartido, actualizado por las tareas de telemetría de MAVSDK y por el
    dispatcher (para el estado de misión). Vive en un único event loop / hilo, no necesita
    locks."""

    conectado: bool = False
    armado: bool = False
    en_vuelo: bool = False
    modo_vuelo: FlightMode | None = None
    posicion: Position | None = None
    velocidad: VelocityNed | None = None
    rumbo_deg: float | None = None
    bateria: Battery | None = None
    gps: GpsInfo | None = None
    mission_progress: MissionProgress | None = None

    mision_estado: str = "PLANEADA"
    mision_en_pausa: bool = False

    def to_payload(self, timestamp: str) -> dict:
        payload: dict = {
            "timestamp": timestamp,
            "conectado": self.conectado,
            "armado": self.armado,
            "enVuelo": self.en_vuelo,
            "modoVuelo": self.modo_vuelo.name if self.modo_vuelo is not None else None,
        }

        if self.posicion is not None:
            payload["posicion"] = {
                "lat": self.posicion.latitude_deg,
                "lon": self.posicion.longitude_deg,
                "altitudRelativa_m": self.posicion.relative_altitude_m,
                "altitudAbsoluta_m": self.posicion.absolute_altitude_m,
            }

        if self.velocidad is not None:
            horizontal = math.hypot(self.velocidad.north_m_s, self.velocidad.east_m_s)
            payload["velocidad"] = {
                "horizontal_m_s": horizontal,
                "vertical_m_s": -self.velocidad.down_m_s,
            }

        if self.rumbo_deg is not None:
            payload["rumbo_deg"] = self.rumbo_deg

        if self.bateria is not None:
            payload["bateria"] = {
                "porcentaje": self.bateria.remaining_percent,
                "voltaje_v": self.bateria.voltage_v,
            }

        if self.gps is not None:
            payload["gps"] = {
                "fixType": self.gps.fix_type.name,
                "satelitesVisibles": self.gps.num_satellites,
            }

        mision: dict = {"estado": self.mision_estado, "enPausa": self.mision_en_pausa}
        if self.mission_progress is not None:
            mision["secuenciaActual"] = self.mission_progress.current
            mision["totalWaypoints"] = self.mission_progress.total
        payload["mision"] = mision

        return payload
