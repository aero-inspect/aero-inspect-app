import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flight_controller import FlightController  # noqa: E402
from telemetry_state import TelemetrySnapshot  # noqa: E402


@pytest.fixture
def telemetry_state() -> TelemetrySnapshot:
    return TelemetrySnapshot()


@pytest.fixture
def flight_controller() -> AsyncMock:
    return AsyncMock(spec=FlightController)
