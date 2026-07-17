import json

import pytest

from commands import CommandParseError, TipoComando, parse_command


def _envelope(**overrides):
    base = {
        "comandoId": "abc-123",
        "tipo": "ARMAR",
        "timestamp": "2026-07-17T00:00:00Z",
        "payload": None,
    }
    base.update(overrides)
    return json.dumps(base)


def test_parse_valid_command():
    command = parse_command(_envelope())
    assert command.comando_id == "abc-123"
    assert command.tipo is TipoComando.ARMAR
    assert command.payload is None


def test_parse_command_with_payload():
    command = parse_command(_envelope(tipo="DESPEGAR", payload={"altitudDespegue": 10.0}))
    assert command.tipo is TipoComando.DESPEGAR
    assert command.payload == {"altitudDespegue": 10.0}


def test_parse_invalid_json_raises():
    with pytest.raises(CommandParseError):
        parse_command("not json")


def test_parse_non_object_json_raises():
    with pytest.raises(CommandParseError):
        parse_command(json.dumps([1, 2, 3]))


def test_parse_missing_comando_id_raises():
    with pytest.raises(CommandParseError):
        parse_command(_envelope(comandoId=None))


def test_parse_missing_timestamp_raises():
    with pytest.raises(CommandParseError):
        parse_command(_envelope(timestamp=None))


def test_parse_unknown_tipo_raises_with_comando_id():
    with pytest.raises(CommandParseError) as exc_info:
        parse_command(_envelope(tipo="DESPEGAR_Y_VOLVER"))
    assert exc_info.value.comando_id == "abc-123"


def test_parse_malformed_payload_raises():
    with pytest.raises(CommandParseError):
        parse_command(_envelope(payload="not-an-object"))
