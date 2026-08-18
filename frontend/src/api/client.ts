import type {
  BackendAsset,
  BackendDrone,
  BackendDroneStatus,
  BackendFlightPlan,
  BackendInspectionPhoto,
  BackendMission,
  CreateAssetPayload,
  CreateDronePayload,
  CreateMissionPayload,
  SeedResult,
  UpdateDronePayload
} from "./types";

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

export function getAssets() {
  return request<BackendAsset[]>("/api/v1/assets");
}

export function getAsset(idAsset: number) {
  return request<BackendAsset>(`/api/v1/assets/${idAsset}`);
}

export function createAsset(payload: CreateAssetPayload) {
  return request<BackendAsset>("/api/v1/assets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteAsset(idAsset: number) {
  return request<void>(`/api/v1/assets/${idAsset}`, {
    method: "DELETE"
  });
}

export function getFlightPlans() {
  return request<BackendFlightPlan[]>("/api/v1/flight-plans");
}

export function getFlightPlan(idFlightPlan: number) {
  return request<BackendFlightPlan>(`/api/v1/flight-plans/${idFlightPlan}`);
}

export function getMissions() {
  return request<BackendMission[]>("/api/v1/missions");
}

export function getMission(idMission: string) {
  return request<BackendMission>(`/api/v1/missions/${idMission}`);
}

export function createMission(payload: CreateMissionPayload) {
  return request<BackendMission>("/api/v1/missions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function startMission(idMission: string) {
  return request<BackendMission>(`/api/v1/missions/${idMission}/start`, {
    method: "POST"
  });
}

export function getDrones() {
  return request<BackendDrone[]>("/api/v1/drones");
}

export function createDrone(payload: CreateDronePayload) {
  return request<BackendDrone>("/api/v1/drones", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateDrone(idDrone: string, payload: UpdateDronePayload) {
  return request<BackendDrone>(`/api/v1/drones/${idDrone}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteDrone(idDrone: string) {
  return request<void>(`/api/v1/drones/${idDrone}`, {
    method: "DELETE"
  });
}

// El heartbeat llega continuamente por MQTT, con o sin misión activa, así que sirve para
// mostrar el estado de un dron idle antes de mandarlo a volar.
export function getDroneStatuses() {
  return request<BackendDroneStatus[]>("/api/v1/drones/status");
}

// POC: crea datos de prueba (Asset + FlightPlan) en general-monolith. Útil mientras no
// existe todavía una pantalla real de administración de activos/planes.
export function seedDemoData() {
  return request<SeedResult>("/api/v1/seed/demo-data", { method: "POST" });
}

export async function uploadInspectionPhoto(file: File, idMission: string, idMissionWaypoint: string) {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({ idMission, idMissionWaypoint });

  const response = await fetch(`/api/v1/inspection-photos?${params.toString()}`, {
    method: "POST",
    body: formData
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.detail ?? body?.message ?? "No se pudo enviar la imagen al monolito");
  }

  return body as BackendInspectionPhoto;
}

export function getInspectionPhoto(idInspectionPhoto: string) {
  return request<BackendInspectionPhoto>(`/api/v1/inspection-photos/${idInspectionPhoto}`);
}
