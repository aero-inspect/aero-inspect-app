import type {
  BackendAsset,
  BackendDrone,
  BackendDroneStatus,
  BackendFlightPlan,
  BackendInspectionPhoto,
  BackendMission,
  BackendReport,
  BackendWeather,
  CreateAssetPayload,
  CreateDronePayload,
  CreateMissionPayload,
  SeedResult,
  UpdateDronePayload
} from "./types";

const DEFAULT_ERROR_MESSAGE = "Error de red inesperado";

let authToken = "";

export function setApiAuthToken(token: string) {
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

export function getWeather(city: string) {
  return request<BackendWeather>(`/api/v1/weather?city=${encodeURIComponent(city)}`);
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

export async function uploadInspectionPhoto(file: File, idMission: string, idMissionWaypoint: string, reportCode?: string) {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({ idMission, idMissionWaypoint });
  if (reportCode) params.set("reportCode", reportCode);

  const response = await fetch(`/api/v1/inspection-photos?${params.toString()}`, {
    method: "POST",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
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

export function getReports() { return request<BackendReport[]>("/api/v1/reports"); }
export function getReport(code: string) { return request<BackendReport>(`/api/v1/reports/${code}`); }
export function deleteReport(code: string) { return request<void>(`/api/v1/reports/${code}`, { method: "DELETE" }); }
export function createReport(idMission: string, title?: string) {
  return request<BackendReport>("/api/v1/reports", { method: "POST", body: JSON.stringify({ idMission, title }) });
}
export function validateReport(code: string, signature: string, comments: string, approved: boolean) {
  return request<BackendReport>(`/api/v1/reports/${code}/validation`, { method: "PUT", body: JSON.stringify({ signature, comments, approved }) });
}
export async function downloadReportPdf(code: string, inline = false) {
  const response = await fetch(`/api/v1/reports/${code}/pdf?v=${Date.now()}`, {
    cache: "no-store",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
  });
  if (!response.ok) throw new Error("No se pudo generar el PDF");
  const url = URL.createObjectURL(await response.blob());
  if (inline) window.open(url, "_blank", "noopener,noreferrer");
  else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${code}.pdf`; anchor.click(); }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
