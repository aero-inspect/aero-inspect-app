from __future__ import annotations

import datetime
import logging
from typing import Any

from mavsdk.action import ActionError
from mavsdk.mission import MissionError

import topics
from commands import Command, CommandParseError, TipoComando, parse_command
from flight_controller import FlightController
from mission_translator import MissionValidationError
from telemetry_state import TelemetrySnapshot

logger = logging.getLogger(__name__)

Message = tuple[str, dict[str, Any]]

# tipo de comando de misión -> (estadoMision resultante, enPausa, detalle)
# EstadoMision (documentacion/diagramas/diagrama_de_clases.mdj) no tiene un literal "PAUSADA";
# como estrategia provisoria, pausar/reanudar mantienen estado EN_CURSO y usan el booleano
# 'enPausa' para distinguir. Ver README para el detalle de esta decisión.
_TRANSICIONES_MISION: dict[TipoComando, tuple[str, bool, str]] = {
    TipoComando.INICIAR_MISION: ("EN_CURSO", False, "Misión iniciada"),
    TipoComando.PAUSAR_MISION: ("EN_CURSO", True, "Misión pausada"),
    TipoComando.REANUDAR_MISION: ("EN_CURSO", False, "Misión reanudada"),
    TipoComando.ABORTAR_MISION: ("ABORTADA", False, "Misión abortada, RTL en curso"),
}


class CommandDispatcher:
    """Traduce comandos MQTT en llamadas a FlightController y arma los mensajes de
    ack/estado de misión a publicar. No conoce el transporte MQTT: sólo devuelve pares
    (tópico, payload) para que el llamador los publique."""

    def __init__(
        self,
        drone_id: str,
        flight_controller: FlightController,
        telemetry_state: TelemetrySnapshot,
    ):
        self._drone_id = drone_id
        self._flight_controller = flight_controller
        self._telemetry_state = telemetry_state

    async def handle(self, raw_message: bytes | str) -> list[Message]:
        try:
            command = parse_command(raw_message)
        except CommandParseError as exc:
            logger.warning("Comando malformado: %s", exc.reason)
            return [self._ack(exc.comando_id or "desconocido", None, "RECHAZADO", exc.reason)]

        try:
            await self._ejecutar(command)
        except (ActionError, MissionError, MissionValidationError) as exc:
            motivo = str(exc)
            logger.warning(
                "Comando %s (%s) rechazado: %s", command.comando_id, command.tipo.value, motivo
            )
            return [self._ack(command.comando_id, command.tipo, "RECHAZADO", motivo)]

        mensajes = [self._ack(command.comando_id, command.tipo, "ACEPTADO")]

        transicion = _TRANSICIONES_MISION.get(command.tipo)
        if transicion is not None:
            estado, en_pausa, detalle = transicion
            self._telemetry_state.mision_estado = estado
            self._telemetry_state.mision_en_pausa = en_pausa
            mensajes.append(self._mision_estado(command.comando_id, estado, en_pausa, detalle))

        return mensajes

    async def _ejecutar(self, command: Command) -> None:
        fc = self._flight_controller
        tipo = command.tipo
        payload = command.payload or {}

        if tipo is TipoComando.ARMAR:
            await fc.arm()
        elif tipo is TipoComando.DESPEGAR:
            await fc.takeoff(payload.get("altitudDespegue"))
        elif tipo is TipoComando.ATERRIZAR:
            await fc.land()
        elif tipo is TipoComando.RTL:
            await fc.return_to_launch()
        elif tipo is TipoComando.INICIAR_MISION:
            plan_de_vuelo = payload.get("planDeVuelo")
            if plan_de_vuelo is None:
                raise MissionValidationError("Falta 'payload.planDeVuelo' para INICIAR_MISION")
            await fc.upload_and_start_mission(plan_de_vuelo)
        elif tipo is TipoComando.PAUSAR_MISION:
            await fc.pause_mission()
        elif tipo is TipoComando.REANUDAR_MISION:
            await fc.resume_mission()
        elif tipo is TipoComando.ABORTAR_MISION:
            await fc.abort_mission()
        else:  # pragma: no cover - exhaustivo por TipoComando
            raise AssertionError(f"tipo de comando sin manejar: {tipo}")

    def _ack(
        self,
        comando_id: str,
        tipo: TipoComando | None,
        resultado: str,
        motivo: str | None = None,
    ) -> Message:
        message: dict[str, Any] = {
            "comandoId": comando_id,
            "tipo": tipo.value if tipo is not None else None,
            "resultado": resultado,
            "timestamp": _now_iso(),
        }
        if motivo is not None:
            message["motivo"] = motivo
        return topics.comandos_ack(self._drone_id), message

    def _mision_estado(
        self, comando_id: str, estado: str, en_pausa: bool, detalle: str
    ) -> Message:
        message = {
            "comandoId": comando_id,
            "estadoMision": estado,
            "enPausa": en_pausa,
            "detalle": detalle,
            "timestamp": _now_iso(),
        }
        return topics.mision_estado(self._drone_id), message


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
