import type { BackendFlightPlan, BackendPlanWaypoint } from "../api/types";
import { haversineDistanceMeters } from "./geo";
import { composeInspectionRoute } from "./missionPlanComposer";
import { photoCountForWaypoint } from "./missionPhotos";

export const DRONE_FULL_BATTERY_RANGE_METERS = 2400;
export const DEFAULT_MISSION_BATTERY_RESERVE_PCT = 30;
const HOVER_EQUIVALENT_SPEED_MS = 4;

export function formatMissionDistance(meters: number) {
  if (!Number.isFinite(meters)) return "--";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function missionReservePct(plans: BackendFlightPlan[]) {
  if (plans.length === 0) return DEFAULT_MISSION_BATTERY_RESERVE_PCT;
  return Math.max(...plans.map((plan) => plan.minBatteryPct || DEFAULT_MISSION_BATTERY_RESERVE_PCT));
}

export function missionRouteForPlans(plans: BackendFlightPlan[]): BackendPlanWaypoint[] {
  if (plans.length === 0) return [];
  return plans.length === 1 ? [...plans[0].route].sort((a, b) => a.sequence - b.sequence) : composeInspectionRoute(plans);
}

export function estimateMissionDistanceMeters(plans: BackendFlightPlan[]) {
  const route = missionRouteForPlans(plans);
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    const horizontal = haversineDistanceMeters(route[i - 1], route[i]);
    const vertical = route[i].altitude - route[i - 1].altitude;
    total += Math.hypot(horizontal, vertical);
  }
  return route.reduce((sum, point) => {
    if (!point.pointOfInterest || point.stopSeconds <= 0) return sum;
    return sum + point.stopSeconds * photoCountForWaypoint(point) * HOVER_EQUIVALENT_SPEED_MS;
  }, total);
}

export function availableMissionDistanceMeters(
  batteryPercentage: number | null | undefined,
  reservePct = DEFAULT_MISSION_BATTERY_RESERVE_PCT
) {
  const battery = batteryPercentage == null ? 100 : Math.max(0, Math.min(100, batteryPercentage));
  const usableBatteryPct = Math.max(0, battery - Math.max(0, Math.min(100, reservePct)));
  return DRONE_FULL_BATTERY_RANGE_METERS * (usableBatteryPct / 100);
}
