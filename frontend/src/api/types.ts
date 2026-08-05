// Tipos que reflejan 1:1 los DTOs del backend real (general-monolith).
// No confundir con los tipos de src/types/index.ts, que son del modelo mock/local
// que todavía usan RegistrarActivo/MisActivos/ConfigurarMision.

export type BackendAssetType = "SILO" | "NORIA" | "CINTA_TRANSPORTADORA" | "SECADORA" | "TUBERIA";
export type BackendAssetStatus = "ACTIVE" | "MAINTENANCE" | "OUT_OF_SERVICE";

export type BackendAsset = {
  idAsset: number;
  name: string;
  description: string | null;
  type: BackendAssetType;
  status: BackendAssetStatus;
  createdAt: string | null;
  locationDetail: string | null;
  latitude: number;
  longitude: number;
};

export type WaypointAction = "TAKEOFF" | "NAVIGATE" | "STOP" | "LAND";

export type BackendPlanWaypoint = {
  idPlanWaypoint: number;
  latitude: number;
  longitude: number;
  altitude: number;
  sequence: number;
  stopSeconds: number;
  pointOfInterest: boolean;
  action: WaypointAction;
  droneDegree: number;
  idAsset: number | null;
  name: string | null;
  description: string | null;
  cameraAngles: number[] | null;
};

export type BackendFlightPlan = {
  idFlightPlan: number;
  name: string;
  objective: string;
  cruiseSpeedMs: number;
  minBatteryPct: number;
  assetIds: number[];
  route: BackendPlanWaypoint[];
};

export type BackendMissionStatus = "PLANNED" | "UPLOADING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "FAILED";

export type BackendMissionWaypoint = {
  idMissionWaypoint: number;
  sequence: number;
  latitude: number;
  longitude: number;
  altitude: number;
  stopSeconds: number;
  pointOfInterest: boolean;
  action: WaypointAction;
  droneDegree: number;
  idAsset: number | null;
  name: string | null;
  cameraAngles: number[] | null;
};

export type BackendMission = {
  idMission: string;
  idFlightPlan: number;
  name: string;
  objective: string;
  droneId: string;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  status: BackendMissionStatus;
  completionPercentage: number;
  notes: string | null;
  selectedPlanWaypointIds: number[] | null;
  missionWaypoints: BackendMissionWaypoint[] | null;
};

export type CreateMissionPayload = {
  idFlightPlan: number;
  name: string;
  objective: string;
  droneId: string;
  scheduledAt: string;
  selectedPlanWaypointIds: number[];
};

export type SeedResult = {
  assets: BackendAsset[];
  flightPlan: BackendFlightPlan;
};

export type AiCorrosionReport = {
  status: "corrosion_candidate_detected" | "no_corrosion_detected";
  warning: string;
  detected_area_percent: number;
};

export type AiEncodedImage = {
  media_type: string;
  encoding: "base64";
  data: string;
};

export type AiCorrosionPrediction = {
  report: AiCorrosionReport;
  mask: AiEncodedImage;
  overlay: AiEncodedImage;
};
