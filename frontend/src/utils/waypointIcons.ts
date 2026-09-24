import { PlaneTakeoff, PlaneLanding, CircleDot, ArrowRight, ArrowUp, ArrowDown } from "lucide-react";
import type { WaypointAction } from "../api/planBuilder";
import type { NavigateMovementKind } from "./waypointMovement";

// Ícono y color por tipo de waypoint, usado por el mapa del plan generado (PlanDraftMap).
export const ACTION_ICONS: Record<Exclude<WaypointAction, "NAVIGATE">, typeof PlaneTakeoff> = {
  TAKEOFF: PlaneTakeoff,
  LAND: PlaneLanding,
  STOP: CircleDot
};

export const ACTION_COLORS: Record<Exclude<WaypointAction, "NAVIGATE">, string> = {
  TAKEOFF: "#0ca75b",
  LAND: "#d94b4b",
  STOP: "#e7b416"
};

export const NAVIGATE_MOVEMENT_ICONS: Record<NavigateMovementKind, typeof PlaneTakeoff> = {
  CLIMB: ArrowUp,
  DESCEND: ArrowDown,
  HORIZONTAL: ArrowRight
};
