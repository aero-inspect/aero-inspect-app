import type { BackendFlightPlan, BackendPlanWaypoint, CreateFlightPlanPayload } from "../api/types";
import catalog from "../data/bragado-assets.json";
import { plantGeoreference, toPlantPosition } from "../components/bragado/georeference";

// One level spine follows the long axis of the plant, above its structures.
const spineStart = catalog.find(asset => asset.type === "CELDA")!;
const spineEnd = catalog.find(asset => asset.id === "silo-9")!;
const dx = spineEnd.x - spineStart.x, dz = spineEnd.z - spineStart.z;
const minimumCruiseAltitude = Math.ceil(Math.max(...catalog.map(asset => asset.h + asset.r * .3)) + 6);

function spineProgress(point: BackendPlanWaypoint) {
  const position = toPlantPosition(point);
  if (!position) throw new Error("Coordenadas de inspección inválidas");
  return ((position.x - spineStart.x) * dx + (position.z - spineStart.z) * dz) / (dx * dx + dz * dz);
}

function onSpine(point: BackendPlanWaypoint, altitude: number) {
  const position = toPlantPosition(point);
  if (!position) throw new Error("Coordenadas de inspección inválidas");
  const t = spineProgress(point);
  const g = plantGeoreference, angle = g.northRotationDegrees * Math.PI / 180;
  const x = (spineStart.x + t * dx - g.x) / g.metresToUnits;
  const z = (spineStart.z + t * dz - g.z) / g.metresToUnits;
  return asNavigate(point, {
    latitude: g.latitude - (-x * Math.sin(angle) + z * Math.cos(angle)) / (111320 * g.southSign),
    longitude: g.longitude + (x * Math.cos(angle) + z * Math.sin(angle)) / (111320 * Math.cos(g.latitude * Math.PI / 180) * g.eastSign),
    altitude
  });
}

function orderedRoute(plan: BackendFlightPlan) {
  return [...plan.route].sort((a, b) => a.sequence - b.sequence);
}

function asNavigate(
  point: BackendPlanWaypoint,
  overrides: Partial<Pick<BackendPlanWaypoint, "latitude" | "longitude" | "altitude">> = {}
): BackendPlanWaypoint {
  return {
    ...point,
    ...overrides,
    action: "NAVIGATE",
    pointOfInterest: false,
    stopSeconds: 0,
    idAsset: null,
    name: null,
    description: null,
    cameraAngles: null
  };
}

function appendDistinct(route: BackendPlanWaypoint[], point: BackendPlanWaypoint) {
  const previous = route[route.length - 1];
  if (
    previous &&
    Math.abs(previous.latitude - point.latitude) < 1e-10 &&
    Math.abs(previous.longitude - point.longitude) < 1e-10 &&
    Math.abs(previous.altitude - point.altitude) < 0.05
  ) return;
  route.push(point);
}

export function composeInspectionRoute(plans: BackendFlightPlan[]): BackendPlanWaypoint[] {
  if (plans.length === 0) return [];
  if (plans.length === 1) return orderedRoute(plans[0]);

  const combined: BackendPlanWaypoint[] = [];
  const routes = plans.map(orderedRoute).sort((a, b) => spineProgress(a[1]) - spineProgress(b[1]));
  if (routes.some(route => route.length < 5 || route[0].action !== "TAKEOFF" || route[route.length - 1].action !== "LAND")) {
    throw new Error("El plan no tiene una entrada y una salida de inspección válidas");
  }
  if (routes.length === 0) return [];
  const homeProgress = spineProgress(routes[0][0]);
  if (Math.abs(homeProgress - spineProgress(routes[routes.length - 1][1])) < Math.abs(homeProgress - spineProgress(routes[0][1]))) {
    routes.reverse();
  }
  const cruiseAltitude = Math.max(minimumCruiseAltitude, ...routes.flatMap(route => route.map(point => point.altitude)));
  const takeoff = { ...routes[0][0], altitude: cruiseAltitude };
  combined.push(takeoff);
  appendDistinct(combined, onSpine(takeoff, cruiseAltitude));

  routes.forEach((route) => {
    const entry = route[1];
    const corridorPoint = onSpine(entry, cruiseAltitude);
    const targetAtCruise = asNavigate(entry, { altitude: cruiseAltitude });

    appendDistinct(combined, corridorPoint);
    appendDistinct(combined, targetAtCruise);
    if (Math.abs(entry.altitude - cruiseAltitude) > 0.05) {
      appendDistinct(combined, asNavigate(entry));
    }

    // Omite el despegue, el regreso particular a la base y el aterrizaje. El
    // tramo central conserva las vueltas y el descenso propios de cada activo.
    combined.push(...route.slice(2, -2));

    const inspectionExit = combined[combined.length - 1];
    if (Math.abs(inspectionExit.altitude - cruiseAltitude) > 0.05) {
      appendDistinct(combined, asNavigate(inspectionExit, { altitude: cruiseAltitude }));
    }
    appendDistinct(combined, onSpine(inspectionExit, cruiseAltitude));
  });

  const finalRoute = routes[routes.length - 1];
  const landing = finalRoute[finalRoute.length - 1];
  appendDistinct(combined, asNavigate(landing, { altitude: cruiseAltitude }));
  combined.push(landing);
  return combined.map((point, sequence) => {
    const next = combined[sequence + 1];
    if (point.action !== "NAVIGATE" || !next) return { ...point, sequence };
    const east = (next.longitude - point.longitude) * Math.cos(point.latitude * Math.PI / 180);
    const north = next.latitude - point.latitude;
    return { ...point, sequence, droneDegree: Math.hypot(east, north) > 1e-10 ? (Math.atan2(east, north) * 180 / Math.PI + 360) % 360 : point.droneDegree };
  });
}

export function buildCombinedFlightPlan(
  plans: BackendFlightPlan[],
  missionName: string
): CreateFlightPlanPayload {
  return {
    name: `Recorrido multi-activo - ${missionName}`,
    objective: `Inspección de ${plans.length} activos mediante corredor principal`,
    cruiseSpeedMs: Math.min(...plans.map((plan) => plan.cruiseSpeedMs || 2)),
    minBatteryPct: Math.max(...plans.map((plan) => plan.minBatteryPct || 30)),
    assetIds: [...new Set(plans.flatMap((plan) => plan.assetIds))],
    route: composeInspectionRoute(plans)
  };
}
