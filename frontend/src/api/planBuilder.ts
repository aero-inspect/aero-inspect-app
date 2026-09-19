// Tipos y llamadas al backend real (general-monolith) para el Flujo 0: generar un FlightPlan
// borrador a partir de un FlightRecording (recorrido manual telemetrado) y confirmarlo.
// Deliberadamente separado de api/types.ts y api/client.ts: esos modelan el flujo de misiones
// ya armado (activos, puntos de interes) que no aplica a este flujo de generacion de planes.

const DEFAULT_ERROR_MESSAGE = "Error de red inesperado";

let authToken = "";

export function setPlanBuilderAuthToken(token: string) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers
    },
    ...options
  });

  const raw = await response.text();

  if (!response.ok) {
    let message: string | undefined;
    try {
      message = raw ? (JSON.parse(raw) as { message?: string }).message : undefined;
    } catch {
      // Un error sin cuerpo JSON (un 502 del proxy, por ejemplo) no tiene mensaje que mostrar.
    }
    throw new Error(message ?? DEFAULT_ERROR_MESSAGE);
  }

  // Hay respuestas sin cuerpo: el 202 de arrancar/cortar una inspección manual es una de ellas.
  // Pasarlas por JSON.parse revienta con "Unexpected end of JSON input" — un error que parece de
  // red y en realidad es de la llamada que sí funcionó.
  if (!raw) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
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
  // El piloto apretó el botón del radiocontrol sobre este punto: la generación lo respeta
  // como waypoint aunque la simplificación lo hubiera descartado.
  marked?: boolean;
};

export type FlightRecordingDetail = {
  idFlightRecording: number;
  droneId: string;
  recordedFrom: string;
  recordedTo: string;
  points: TrackPoint[];
};

// Una foto planificada para un punto marcado: pitch (inclinación vertical del gimbal, -135 a 45) +
// yaw (rotación horizontal relativa al heading del dron, -160 a 160).
export type PlannedPhoto = {
  pitch: number;
  yaw: number;
};

export const PITCH_RANGE = { min: -135, max: 45 };
export const YAW_RANGE = { min: -160, max: 160 };

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
  // Sólo en una parada a la que se le asignó un activo al generar el plan.
  idAsset?: number | null;
  name?: string | null;
  cameraAngles?: PlannedPhoto[] | null;
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
  // El activo de cada punto marcado, en orden (posición 0 = punto 1). null deja la parada sin activo.
  markedPointAssetIds: Array<number | null>;
  // Las fotos planificadas para cada punto marcado, en el mismo orden posicional. Una posición
  // vacía deja esa parada sin fotos.
  markedPointPhotos: Array<PlannedPhoto[]>;
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

// Inspección manual: el backend le publica la orden al dron por MQTT y responde 202. No hay
// recorrido que devolver todavía — el dron lo sube recién cuando aterriza, y aparece en
// getFlightRecordings().
export function startManualRecording(idDrone: string) {
  return request<void>("/api/v1/flight-recordings/start", {
    method: "POST",
    body: JSON.stringify({ idDrone })
  });
}

export function stopManualRecording(idDrone: string) {
  return request<void>("/api/v1/flight-recordings/stop", {
    method: "POST",
    body: JSON.stringify({ idDrone })
  });
}
