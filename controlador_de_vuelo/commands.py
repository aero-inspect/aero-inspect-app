from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from typing import Any


class TipoComando(str, Enum):
    ARMAR = "ARMAR"
    DESPEGAR = "DESPEGAR"
    ATERRIZAR = "ATERRIZAR"
    RTL = "RTL"
    INICIAR_MISION = "INICIAR_MISION"
    PAUSAR_MISION = "PAUSAR_MISION"
    REANUDAR_MISION = "REANUDAR_MISION"
    ABORTAR_MISION = "ABORTAR_MISION"


class CommandParseError(Exception):
    def __init__(self, reason: str, comando_id: str | None = None):
        super().__init__(reason)
        self.reason = reason
        self.comando_id = comando_id


@dataclass(frozen=True)
class Command:
    comando_id: str
    tipo: TipoComando
    timestamp: str
    payload: dict[str, Any] | None


def parse_command(raw: bytes | str) -> Command:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise CommandParseError(f"JSON inválido: {exc}") from exc

    if not isinstance(data, dict):
        raise CommandParseError("El comando debe ser un objeto JSON")

    comando_id = data.get("comandoId")
    if not isinstance(comando_id, str) or not comando_id:
        raise CommandParseError("Falta 'comandoId' (string no vacío)")

    tipo_raw = data.get("tipo")
    try:
        tipo = TipoComando(tipo_raw)
    except ValueError as exc:
        raise CommandParseError(
            f"'tipo' desconocido: {tipo_raw!r}", comando_id=comando_id
        ) from exc

    timestamp = data.get("timestamp")
    if not isinstance(timestamp, str) or not timestamp:
        raise CommandParseError("Falta 'timestamp' (string no vacío)", comando_id=comando_id)

    payload = data.get("payload")
    if payload is not None and not isinstance(payload, dict):
        raise CommandParseError("'payload' debe ser un objeto o null", comando_id=comando_id)

    return Command(comando_id=comando_id, tipo=tipo, timestamp=timestamp, payload=payload)
