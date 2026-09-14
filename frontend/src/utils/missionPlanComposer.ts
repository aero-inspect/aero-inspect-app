import type { BackendFlightPlan, BackendPlanWaypoint, CreateFlightPlanPayload } from "../api/types";

function orderedRoute(plan: BackendFlightPlan) {
  return [...plan.route].sort((a, b) => a.sequence - b.sequence);
}

function asNavigate(point: BackendPlanWaypoint, altitude = point.altitude): BackendPlanWaypoint {
  return {
    ...point,
    altitude,
    action: "NAVIGATE",
    pointOfInterest: false,
    stopSeconds: 0,
    idAsset: null,
    name: null,
    description: null,
    cameraAngles: null
  };
}

export function composeInspectionRoute(plans: BackendFlightPlan[]): BackendPlanWaypoint[] {
  if (plans.length === 0) return [];

  const combined: BackendPlanWaypoint[] = [];
  plans.forEach((plan, planIndex) => {
    const route = orderedRoute(plan);
    if (route.length < 3) return;

    if (planIndex === 0) {
      combined.push(...route.slice(0, -1));
      return;
    }

    const takeoff = route[0];
    const previous = combined[combined.length - 1];
    if (previous && Math.abs(previous.altitude - takeoff.altitude) > 0.05) {
      combined.push(asNavigate(takeoff, takeoff.altitude));
    }

    // Cada plan vuelve al mismo nodo principal sobre la base. Desde allí se toma
    // el ramal del siguiente activo sin aterrizar ni repetir el despegue.
    combined.push(...route.slice(1, -1));
  });

  const finalRoute = orderedRoute(plans[plans.length - 1]);
  combined.push(finalRoute[finalRoute.length - 1]);
  return combined.map((point, sequence) => ({ ...point, sequence }));
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
