import type { PlanWaypoint } from "../api/planBuilder";

// Umbral por debajo del cual un cambio de altitud entre dos waypoints consecutivos se considera
// "sin cambio" (ruido de generación) en vez de una subida o bajada real. Coincide con el epsilon
// vertical mas chico que usa el backend (SensitivityLevel.HIGH).
const LEVEL_EPSILON_METERS = 0.5;

export type NavigateMovementKind = "CLIMB" | "DESCEND" | "HORIZONTAL";

export function getNavigateMovementKind(
  current: PlanWaypoint,
  previous: PlanWaypoint | undefined
): NavigateMovementKind {
  if (!previous) {
    return "HORIZONTAL";
  }

  const altitudeDelta = current.altitude - previous.altitude;
  if (altitudeDelta > LEVEL_EPSILON_METERS) {
    return "CLIMB";
  }
  if (altitudeDelta < -LEVEL_EPSILON_METERS) {
    return "DESCEND";
  }
  return "HORIZONTAL";
}

export const NAVIGATE_MOVEMENT_LABELS: Record<NavigateMovementKind, string> = {
  CLIMB: "Navegación (subida)",
  DESCEND: "Navegación (bajada)",
  HORIZONTAL: "Navegación (horizontal)"
};

export const NAVIGATE_MOVEMENT_COLORS: Record<NavigateMovementKind, string> = {
  CLIMB: "#0f9488",
  DESCEND: "#a25b1f",
  HORIZONTAL: "#295b87"
};
