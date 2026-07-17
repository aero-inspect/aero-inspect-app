from __future__ import annotations

from typing import Any

from mavsdk.mission import MissionItem


class MissionValidationError(Exception):
    pass


def _require_number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MissionValidationError(f"'{field}' debe ser numérico, se recibió: {value!r}")
    return float(value)


def _validate_waypoint(waypoint: dict[str, Any]) -> tuple[int, float, float]:
    if not isinstance(waypoint, dict):
        raise MissionValidationError("Cada waypoint debe ser un objeto")

    secuencia = waypoint.get("secuencia")
    if not isinstance(secuencia, int) or isinstance(secuencia, bool):
        raise MissionValidationError(f"'secuencia' debe ser un entero, se recibió: {secuencia!r}")

    lat = _require_number(waypoint.get("lat"), "lat")
    lon = _require_number(waypoint.get("lon"), "lon")

    if not (-90.0 <= lat <= 90.0):
        raise MissionValidationError(f"'lat' fuera de rango [-90, 90]: {lat}")
    if not (-180.0 <= lon <= 180.0):
        raise MissionValidationError(f"'lon' fuera de rango [-180, 180]: {lon}")

    return secuencia, lat, lon


def plan_de_vuelo_to_mission_items(plan: dict[str, Any]) -> list[MissionItem]:
    if not isinstance(plan, dict):
        raise MissionValidationError("planDeVuelo debe ser un objeto")

    waypoints = plan.get("waypoints")
    if not isinstance(waypoints, list) or not waypoints:
        raise MissionValidationError("planDeVuelo.waypoints debe ser una lista no vacía")

    altitud_m = _require_number(plan.get("metrosAltitud"), "metrosAltitud")
    velocidad_m_s = _require_number(plan.get("metrosVelocidad"), "metrosVelocidad")

    if altitud_m <= 0:
        raise MissionValidationError(f"'metrosAltitud' debe ser positivo: {altitud_m}")
    if velocidad_m_s <= 0:
        raise MissionValidationError(f"'metrosVelocidad' debe ser positivo: {velocidad_m_s}")

    validados = [_validate_waypoint(wp) for wp in waypoints]

    secuencias = [secuencia for secuencia, _, _ in validados]
    if len(set(secuencias)) != len(secuencias):
        raise MissionValidationError(f"'secuencia' duplicada entre waypoints: {secuencias}")

    validados.sort(key=lambda item: item[0])

    return [
        MissionItem(
            lat,
            lon,
            altitud_m,
            velocidad_m_s,
            True,  # is_fly_through
            float("nan"),  # gimbal_pitch_deg: sin control de gimbal en este alcance
            float("nan"),  # gimbal_yaw_deg
            MissionItem.CameraAction.NONE,
            float("nan"),  # loiter_time_s
            float("nan"),  # camera_photo_interval_s
            float("nan"),  # acceptance_radius_m: usa el default de PX4
            float("nan"),  # yaw_deg
            float("nan"),  # camera_photo_distance_m
        )
        for _secuencia, lat, lon in validados
    ]
