import pytest

from mission_translator import MissionValidationError, plan_de_vuelo_to_mission_items


def _plan(**overrides):
    base = {
        "metrosAltitud": 30.0,
        "metrosVelocidad": 5.0,
        "waypoints": [
            {"secuencia": 1, "lat": -34.6037, "lon": -58.3816},
            {"secuencia": 2, "lat": -34.6040, "lon": -58.3820},
        ],
    }
    base.update(overrides)
    return base


def test_translates_valid_plan():
    items = plan_de_vuelo_to_mission_items(_plan())
    assert len(items) == 2
    assert items[0].latitude_deg == -34.6037
    assert items[0].relative_altitude_m == 30.0
    assert items[0].speed_m_s == 5.0


def test_sorts_out_of_order_sequence():
    plan = _plan(
        waypoints=[
            {"secuencia": 2, "lat": -34.6040, "lon": -58.3820},
            {"secuencia": 1, "lat": -34.6037, "lon": -58.3816},
        ]
    )
    items = plan_de_vuelo_to_mission_items(plan)
    assert items[0].latitude_deg == -34.6037
    assert items[1].latitude_deg == -34.6040


def test_empty_waypoints_raises():
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(_plan(waypoints=[]))


def test_duplicate_sequence_raises():
    plan = _plan(
        waypoints=[
            {"secuencia": 1, "lat": 0, "lon": 0},
            {"secuencia": 1, "lat": 1, "lon": 1},
        ]
    )
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(plan)


def test_out_of_range_latitude_raises():
    plan = _plan(waypoints=[{"secuencia": 1, "lat": 200.0, "lon": 0}])
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(plan)


def test_out_of_range_longitude_raises():
    plan = _plan(waypoints=[{"secuencia": 1, "lat": 0, "lon": 200.0}])
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(plan)


def test_non_positive_altitude_raises():
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(_plan(metrosAltitud=0))


def test_non_positive_speed_raises():
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(_plan(metrosVelocidad=-1))


def test_non_numeric_lat_raises():
    plan = _plan(waypoints=[{"secuencia": 1, "lat": "not-a-number", "lon": 0}])
    with pytest.raises(MissionValidationError):
        plan_de_vuelo_to_mission_items(plan)
