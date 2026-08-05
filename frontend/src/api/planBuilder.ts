// Tipos y llamadas al backend real (general-monolith) para el Flujo 0: generar un FlightPlan
// borrador a partir de un FlightRecording (recorrido manual telemetrado) y confirmarlo.
// Deliberadamente separado de api/types.ts y api/client.ts: esos modelan el flujo de misiones
// ya armado (activos, puntos de interes) que no aplica a este flujo de generacion de planes.

const DEFAULT_ERROR_MESSAGE = "Error de red inesperado";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? DEFAULT_ERROR_MESSAGE);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type SensitivityLevel = "LOW" | "MEDIUM" | "HIGH";

export type WaypointAction = "TAKEOFF" | "NAVIGATE" | "STOP" | "LAND";

export type FlightRecordingSummary = {
  idFlightRecording: number;
  droneId: string;
  recordedFrom: string;
  recordedTo: string;
  pointCount: number;
};

export type TrackPoint = {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  headingDegree: number;
};

export type FlightRecordingDetail = {
  idFlightRecording: number;
  droneId: string;
  recordedFrom: string;
  recordedTo: string;
  points: TrackPoint[];
};

export type PlanWaypoint = {
  idPlanWaypoint: number;
  idFlightPlan: number;
  idWaypoint: number;
  sequence: number;
  stopSeconds: number;
  pointOfInterest: boolean;
  action: WaypointAction;
  degree: number;
  latitude: number;
  longitude: number;
  altitude: number;
};

export type PlanStatus = "DRAFT" | "CONFIRMED" | "ARCHIVED";

export type GeneratedFlightPlan = {
  idFlightPlan: number;
  name: string;
  objective: string;
  cruiseSpeedMs: number;
  minBatteryPct: number;
  route: PlanWaypoint[];
  status: PlanStatus;
  sourceRecordingId: number;
  sensitivity: SensitivityLevel;
};

export type GenerateFlightPlanPayload = {
  sourceRecordingId: number;
  sensitivity: SensitivityLevel;
  name: string;
  objective: string;
};

export function getFlightRecordings() {
  return request<FlightRecordingSummary[]>("/api/v1/flight-recordings");
}

export function getFlightRecording(idFlightRecording: number) {
  return request<FlightRecordingDetail>(`/api/v1/flight-recordings/${idFlightRecording}`);
}

export function generateFlightPlanDraft(payload: GenerateFlightPlanPayload) {
  return request<GeneratedFlightPlan>("/api/v1/flight-plans/draft", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deletePlanWaypoint(idFlightPlan: number, sequence: number) {
  return request<GeneratedFlightPlan>(`/api/v1/flight-plans/${idFlightPlan}/waypoints/${sequence}`, {
    method: "DELETE"
  });
}

export function confirmFlightPlan(idFlightPlan: number) {
  return request<GeneratedFlightPlan>(`/api/v1/flight-plans/${idFlightPlan}/confirm`, {
    method: "POST"
  });
}
