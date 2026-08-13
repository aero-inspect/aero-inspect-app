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

// Un ángulo de cámara deseado en un waypoint punto de interés: pitch (inclinación vertical del
// gimbal, -135 a 45) + yaw (rotación horizontal relativa al heading del dron, -160 a 160). Cada
// uno se traduce en su propia foto: el flight-controller apunta el gimbal y saca una foto por
// cada waypoint STOP que recibe, así que un PlanWaypoint con N cameraAngles se manda como N
// waypoints STOP consecutivos al iniciar la misión (ver MissionService en general-monolith).
export type CameraAngle = {
  pitch: number;
  yaw: number;
};

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
  cameraAngles: CameraAngle[] | null;
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
  idMissionWaypoint: string;
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
  // Ya expandido en el backend (un MissionWaypoint = a lo sumo una foto): null si este stop
  // no tiene apuntado de gimbal asociado.
  gimbalPitchDeg: number | null;
  gimbalYawDeg: number | null;
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
