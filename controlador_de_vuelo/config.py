from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


class ConfigError(Exception):
    pass


def _get_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _get_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} debe ser un número, se recibió: {raw!r}") from exc


def _get_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} debe ser un entero, se recibió: {raw!r}") from exc


def _get_required(name: str) -> str:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        raise ConfigError(f"Falta la variable de entorno requerida: {name}")
    return raw


@dataclass(frozen=True)
class Config:
    mqtt_broker_host: str
    mqtt_broker_port: int
    mqtt_use_tls: bool
    mqtt_tls_ca_cert: str | None
    mqtt_tls_client_cert: str | None
    mqtt_tls_client_key: str | None
    mqtt_username: str | None
    mqtt_password: str | None

    drone_id: str
    mavlink_connection: str
    mavsdk_server_mode: str
    mavsdk_server_host: str
    mavsdk_server_port: int

    telemetry_publish_rate_hz: float
    log_level: str

    @classmethod
    def from_env(cls) -> "Config":
        load_dotenv()

        mavsdk_server_mode = os.environ.get("MAVSDK_SERVER_MODE", "embedded").strip().lower()
        if mavsdk_server_mode not in ("embedded", "external"):
            raise ConfigError(
                f"MAVSDK_SERVER_MODE debe ser 'embedded' o 'external', se recibió: {mavsdk_server_mode!r}"
            )

        return cls(
            mqtt_broker_host=_get_required("MQTT_BROKER_HOST"),
            mqtt_broker_port=_get_int("MQTT_BROKER_PORT", 1883),
            mqtt_use_tls=_get_bool("MQTT_USE_TLS", False),
            mqtt_tls_ca_cert=os.environ.get("MQTT_TLS_CA_CERT") or None,
            mqtt_tls_client_cert=os.environ.get("MQTT_TLS_CLIENT_CERT") or None,
            mqtt_tls_client_key=os.environ.get("MQTT_TLS_CLIENT_KEY") or None,
            mqtt_username=os.environ.get("MQTT_USERNAME") or None,
            mqtt_password=os.environ.get("MQTT_PASSWORD") or None,
            drone_id=_get_required("DRONE_ID"),
            mavlink_connection=_get_required("MAVLINK_CONNECTION"),
            mavsdk_server_mode=mavsdk_server_mode,
            mavsdk_server_host=os.environ.get("MAVSDK_SERVER_HOST", "localhost"),
            mavsdk_server_port=_get_int("MAVSDK_SERVER_PORT", 50051),
            telemetry_publish_rate_hz=_get_float("TELEMETRY_PUBLISH_RATE_HZ", 1.0),
            log_level=os.environ.get("LOG_LEVEL", "INFO").strip().upper(),
        )
