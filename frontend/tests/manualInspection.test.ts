import assert from "node:assert/strict";
import { test } from "node:test";
import { manualAssetOptions } from "../src/utils/manualInspection.ts";
import type { BackendAsset, BackendMission } from "../src/api/types.ts";
const mission = { missionWaypoints: [
  { idMissionWaypoint: "a", idAsset: 1, action: "STOP", pointOfInterest: true, name: "Punto 1" },
  { idMissionWaypoint: "b", idAsset: 1, action: "STOP", pointOfInterest: true, name: "Punto 2" },
  { idMissionWaypoint: "c", idAsset: 2, action: "STOP", pointOfInterest: true, name: "Punto 3" },
  { idMissionWaypoint: "navigation", idAsset: 3, action: "NAVIGATE", pointOfInterest: false },
  { idMissionWaypoint: "unassigned", idAsset: null, action: "STOP", pointOfInterest: true }
] } as BackendMission;
test("ofrece solo activos inspeccionables del recorrido y agrupa puntos repetidos", () => {
  const options = manualAssetOptions(mission, [{ idAsset: 1, name: "Silo norte", code: "S1" }, { idAsset: 2, name: "Silo sur", code: "S2" }, { idAsset: 4, name: "Fuera del recorrido", code: "S4" }] as BackendAsset[]);
  assert.deepEqual(options, [
    { idAsset: 1, waypointId: "a", label: "Silo norte · S1" },
    { idAsset: 2, waypointId: "c", label: "Silo sur · S2" }
  ]);
});
test("una misión sin puntos no habilita asignaciones", () => {
  assert.deepEqual(manualAssetOptions(undefined, []), []);
});

test("excluye activos de otra planta aunque aparezcan en el recorrido", () => {
  const options = manualAssetOptions(mission, [{ idAsset: 1, name: "Silo norte", code: "S1" }] as BackendAsset[]);
  assert.deepEqual(options.map(option => option.idAsset), [1]);
});
