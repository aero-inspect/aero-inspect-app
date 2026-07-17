import topics


def test_topic_builders_use_drone_id_namespace():
    drone_id = "dron-x500-01"
    assert topics.comandos(drone_id) == "aeroinspect/dron/dron-x500-01/comandos"
    assert topics.comandos_ack(drone_id) == "aeroinspect/dron/dron-x500-01/comandos/ack"
    assert topics.mision_estado(drone_id) == "aeroinspect/dron/dron-x500-01/mision/estado"
    assert topics.telemetria(drone_id) == "aeroinspect/dron/dron-x500-01/telemetria"
    assert topics.estado_conexion(drone_id) == "aeroinspect/dron/dron-x500-01/estado_conexion"


def test_topic_builders_change_with_drone_id():
    assert topics.comandos("dron-a") != topics.comandos("dron-b")
