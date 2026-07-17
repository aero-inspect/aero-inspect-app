import json

import pytest
from mavsdk.action import ActionError, ActionResult

from dispatcher import CommandDispatcher

DRONE_ID = "dron-x500-01"


def _envelope(comando_id="c1", tipo="ARMAR", payload=None):
    return json.dumps(
        {
            "comandoId": comando_id,
            "tipo": tipo,
            "timestamp": "2026-07-17T00:00:00Z",
            "payload": payload,
        }
    )


@pytest.fixture
def dispatcher(flight_controller, telemetry_state):
    return CommandDispatcher(DRONE_ID, flight_controller, telemetry_state)


async def test_armar_calls_flight_controller_and_acks(dispatcher, flight_controller):
    mensajes = await dispatcher.handle(_envelope(tipo="ARMAR"))

    flight_controller.arm.assert_awaited_once()
    assert len(mensajes) == 1
    topic, payload = mensajes[0]
    assert topic == f"aeroinspect/dron/{DRONE_ID}/comandos/ack"
    assert payload == {
        "comandoId": "c1",
        "tipo": "ARMAR",
        "resultado": "ACEPTADO",
        "timestamp": payload["timestamp"],
    }


async def test_despegar_passes_altitude_from_payload(dispatcher, flight_controller):
    await dispatcher.handle(_envelope(tipo="DESPEGAR", payload={"altitudDespegue": 12.0}))
    flight_controller.takeoff.assert_awaited_once_with(12.0)


async def test_aterrizar_rtl_pausar_reanudar_call_expected_methods(dispatcher, flight_controller):
    await dispatcher.handle(_envelope(tipo="ATERRIZAR"))
    flight_controller.land.assert_awaited_once()

    await dispatcher.handle(_envelope(tipo="RTL"))
    flight_controller.return_to_launch.assert_awaited_once()

    await dispatcher.handle(_envelope(tipo="PAUSAR_MISION"))
    flight_controller.pause_mission.assert_awaited_once()

    await dispatcher.handle(_envelope(tipo="REANUDAR_MISION"))
    flight_controller.resume_mission.assert_awaited_once()

    await dispatcher.handle(_envelope(tipo="ABORTAR_MISION"))
    flight_controller.abort_mission.assert_awaited_once()


async def test_iniciar_mision_publishes_state_transition(dispatcher, flight_controller, telemetry_state):
    plan = {
        "metrosAltitud": 30.0,
        "metrosVelocidad": 5.0,
        "waypoints": [{"secuencia": 1, "lat": 0, "lon": 0}],
    }

    mensajes = await dispatcher.handle(
        _envelope(tipo="INICIAR_MISION", payload={"planDeVuelo": plan})
    )

    flight_controller.upload_and_start_mission.assert_awaited_once_with(plan)
    assert telemetry_state.mision_estado == "EN_CURSO"
    assert telemetry_state.mision_en_pausa is False

    assert len(mensajes) == 2
    topic, payload = mensajes[1]
    assert topic == f"aeroinspect/dron/{DRONE_ID}/mision/estado"
    assert payload["estadoMision"] == "EN_CURSO"
    assert payload["enPausa"] is False
    assert payload["comandoId"] == "c1"


async def test_iniciar_mision_sin_plan_es_rechazado(dispatcher, flight_controller):
    mensajes = await dispatcher.handle(_envelope(tipo="INICIAR_MISION", payload=None))

    flight_controller.upload_and_start_mission.assert_not_awaited()
    assert len(mensajes) == 1
    _, payload = mensajes[0]
    assert payload["resultado"] == "RECHAZADO"


async def test_pausar_mision_sets_en_pausa_true(dispatcher, flight_controller, telemetry_state):
    mensajes = await dispatcher.handle(_envelope(tipo="PAUSAR_MISION"))

    assert telemetry_state.mision_en_pausa is True
    assert telemetry_state.mision_estado == "EN_CURSO"
    _, payload = mensajes[1]
    assert payload["enPausa"] is True


async def test_abortar_mision_sets_estado_abortada(dispatcher, flight_controller, telemetry_state):
    mensajes = await dispatcher.handle(_envelope(tipo="ABORTAR_MISION"))

    assert telemetry_state.mision_estado == "ABORTADA"
    assert telemetry_state.mision_en_pausa is False
    _, payload = mensajes[1]
    assert payload["estadoMision"] == "ABORTADA"


async def test_action_error_produces_rechazado_ack(dispatcher, flight_controller):
    resultado = ActionResult(ActionResult.Result.COMMAND_DENIED, "denegado")
    flight_controller.arm.side_effect = ActionError(resultado, "arm()")

    mensajes = await dispatcher.handle(_envelope(tipo="ARMAR"))

    assert len(mensajes) == 1
    _, payload = mensajes[0]
    assert payload["resultado"] == "RECHAZADO"
    assert "motivo" in payload


async def test_malformed_command_never_touches_flight_controller(dispatcher, flight_controller):
    mensajes = await dispatcher.handle("not json")

    flight_controller.arm.assert_not_awaited()
    flight_controller.takeoff.assert_not_awaited()
    flight_controller.upload_and_start_mission.assert_not_awaited()

    assert len(mensajes) == 1
    _, payload = mensajes[0]
    assert payload["resultado"] == "RECHAZADO"
    assert payload["comandoId"] == "desconocido"
