import type { Plant } from "../types";
import type { ActivityFeed } from "../data/ActivityContext";
import { loadSelectedPlant } from "../data/plants";
import { assetBelongsToPlant, planBelongsToPlant, locationPlantId } from "../data/plantScope";
let apiPlant = loadSelectedPlant();
export function setApiPlant(plant: Plant) { apiPlant = plant; }

import type {
  BackendAsset,
  BackendDrone,
  BackendDroneStatus,
  BackendFlightPlan,
  BackendInspectionPhoto,
  ManagedUser,
  BackendMission,
  BackendMissionSchedule,
  BackendReport,
  BackendWeather,
  CreateAssetPayload,
  CreateDronePayload,
  CreateFlightPlanPayload,
  CreateMissionPayload,
  CreateMissionSchedulePayload,
  UpdateDronePayload
} from "./types";

const DEFAULT_ERROR_MESSAGE = "Error de red inesperado";

let authToken = "";

export function setApiAuthToken(token: string) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? DEFAULT_ERROR_MESSAGE);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();
  return body.trim() ? JSON.parse(body) as T : undefined as T;
}

export type ActivityUpdate={activity:ActivityFeed['activity'][number]|null;notification:ActivityFeed['notifications'][number]|null};
export function subscribeActivityUpdates(token: string, onChange:(update:ActivityUpdate)=>void) {
  const stream=new EventSource(`/api/v1/users/me/activity/stream?token=${encodeURIComponent(token)}`);
  stream.addEventListener('changed',(event)=>{
    try {onChange(JSON.parse((event as MessageEvent<string>).data) as ActivityUpdate);}
    catch {/* Ignore malformed transient events; the stream remains connected. */}
  });
  return ()=>stream.close();
}

export async function getAssets(plant: Plant = apiPlant) {
  const assets = await request<BackendAsset[]>("/api/v1/assets");
  return assets.filter(asset => assetBelongsToPlant(asset,plant));
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

export async function getFlightPlans(plant: Plant = apiPlant) {
  const plans = await request<BackendFlightPlan[]>("/api/v1/flight-plans");
  const needsAssets = plans.some(plan => !plan.route.length && plan.assetIds.length);
  const assets = needsAssets ? await request<BackendAsset[]>("/api/v1/assets") : [];
  return plans.filter(plan => planBelongsToPlant(plan,assets,plant));
}

export function getFlightPlan(idFlightPlan: number) {
  return request<BackendFlightPlan>(`/api/v1/flight-plans/${idFlightPlan}`);
}

export function updateAsset(idAsset: number, payload: CreateAssetPayload) {
  return request<BackendAsset>(`/api/v1/assets/${idAsset}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function createFlightPlan(payload: CreateFlightPlanPayload) {
  return request<BackendFlightPlan>("/api/v1/flight-plans", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getMissions(plant: Plant = apiPlant) {
  const [missions, plans] = await Promise.all([
    request<BackendMission[]>("/api/v1/missions"), getFlightPlans(plant)
  ]);
  const ids = new Set(plans.map(plan => plan.idFlightPlan));
  return missions.filter(mission => mission.missionWaypoints?.length
    ? mission.missionWaypoints.some(point => locationPlantId(point.latitude,point.longitude) === plant.id)
    : ids.has(mission.idFlightPlan));
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

export async function getMissionSchedules(plant: Plant = apiPlant) {
  const [schedules, plans] = await Promise.all([
    request<BackendMissionSchedule[]>("/api/v1/mission-schedules"), getFlightPlans(plant)
  ]);
  const ids = new Set(plans.map(plan => plan.idFlightPlan));
  return schedules.filter(schedule => ids.has(schedule.idFlightPlan));
}

export function createMissionSchedule(payload: CreateMissionSchedulePayload) {
  return request<BackendMissionSchedule>("/api/v1/mission-schedules", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteMissionSchedule(idMissionSchedule: string) {
  return request<void>(`/api/v1/mission-schedules/${idMissionSchedule}`, {
    method: "DELETE"
  });
}

export function startMission(idMission: string) {
  return request<BackendMission>(`/api/v1/missions/${idMission}/start`, {
    method: "POST"
  });
}

export function cancelMission(idMission: string) {
  return request<BackendMission>(`/api/v1/missions/${idMission}/cancel`, {method: "POST"});
}

export function updateMissionPilot(idMission: string, assignedPilotUsername: string | null) {
  return request<BackendMission>(`/api/v1/missions/${idMission}/pilot`, {
    method: "PATCH",
    body: JSON.stringify({ assignedPilotUsername })
  });
}

export function updateMissionSchedule(idMission: string, scheduledAt: string) {
  return request<BackendMission>(`/api/v1/missions/${idMission}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ scheduledAt })
  });
}

export function deleteMission(idMission: string) {
  return request<void>(`/api/v1/missions/${idMission}`, {
    method: "DELETE"
  });
}

export function getManagedUsers() {
  return request<ManagedUser[]>("/api/v1/users");
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

export async function getReports(plant: Plant = apiPlant) {
  const [reports, assets] = await Promise.all([request<BackendReport[]>("/api/v1/reports"),getAssets(plant)]);
  const ids = new Set(assets.map(asset => asset.idAsset));
  return reports.filter(report => ids.has(report.idAsset));
}
export function getReport(code: string) { return request<BackendReport>(`/api/v1/reports/${code}`); }
export function deleteReport(code: string) { return request<void>(`/api/v1/reports/${code}`, { method: "DELETE" }); }
export function createReport(idMission: string, idAsset: number, title?: string) {
  return request<BackendReport>("/api/v1/reports", { method: "POST", body: JSON.stringify({ idMission, idAsset, title }) });
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
