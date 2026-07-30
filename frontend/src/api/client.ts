import type {
  BackendAsset,
  BackendFlightPlan,
  BackendMission,
  CreateMissionPayload,
  SeedResult
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

// POC: crea datos de prueba (Asset + FlightPlan) en general-monolith. Útil mientras no
// existe todavía una pantalla real de administración de activos/planes.
export function seedDemoData() {
  return request<SeedResult>("/api/v1/seed/demo-data", { method: "POST" });
}
