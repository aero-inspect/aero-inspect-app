from __future__ import annotations

_NAMESPACE = "aeroinspect/dron"


def _base(drone_id: str) -> str:
    return f"{_NAMESPACE}/{drone_id}"


def comandos(drone_id: str) -> str:
    return f"{_base(drone_id)}/comandos"


def comandos_ack(drone_id: str) -> str:
    return f"{_base(drone_id)}/comandos/ack"


def mision_estado(drone_id: str) -> str:
    return f"{_base(drone_id)}/mision/estado"


def telemetria(drone_id: str) -> str:
    return f"{_base(drone_id)}/telemetria"


def estado_conexion(drone_id: str) -> str:
    return f"{_base(drone_id)}/estado_conexion"
