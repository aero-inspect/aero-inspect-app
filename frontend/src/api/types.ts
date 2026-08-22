// Tipos que reflejan 1:1 los DTOs del backend real (general-monolith).
// No confundir con los tipos de src/types/index.ts, que son del modelo mock/local
// que todavía usan RegistrarActivo/MisActivos/ConfigurarMision.

export type BackendAssetType = "SILO" | "NORIA" | "CINTA_TRANSPORTADORA" | "TUBERIA" | "TECHO";
export type BackendAssetStatus = "ACTIVE" | "MAINTENANCE" | "OUT_OF_SERVICE";

export type BackendAsset = {
  idAsset: number;
  name: string;
  code: string;
  description: string | null;
  type: BackendAssetType;
  status: BackendAssetStatus;
  createdAt: string | null;
  lastMaintenanceAt: string | null;
  locationDetail: string | null;
  imageName: string | null;
  imageData: string | null;
  latitude: number;
  longitude: number;
};

// DTO esperado del endpoint de clima del backend (proxy hacia OpenWeather:
// la API key vive del lado del servidor, nunca en el bundle del frontend).
export type BackendWeather = {
  temp: number;
  description: string;
  icon: string;
  windKmh: number;
  humidity: number;
  visibilityKm: number;
};

export type CreateAssetPayload = {
  name: string;
  code: string;
  type: BackendAssetType;
  status: BackendAssetStatus;
  locationDetail: string;
  latitude: number;
  longitude: number;
  lastMaintenanceAt?: string | null;
  imageName?: string | null;
  imageData?: string | null;
  description?: string | null;
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
  idDrone: string;
  scheduledAt: string;
  selectedPlanWaypointIds: number[];
};

export type SeedResult = {
  assets: BackendAsset[];
  flightPlan: BackendFlightPlan;
};

export type BackendDrone = {
  idDrone: string;
  droneId: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  createdAt: string;
};

export type CreateDronePayload = {
  droneId: string;
  name: string;
  model?: string | null;
  serialNumber?: string | null;
};

export type UpdateDronePayload = {
  droneId: string;
  name: string;
  model?: string | null;
  serialNumber?: string | null;
};

export type BackendDronePosition = {
  latitude: number;
  longitude: number;
};

export type BackendDroneGps = {
  fixType: string;
  satellites: number;
};

export type BackendDroneBattery = {
  percentage: number;
  voltageV: number;
};

// Refleja DroneStatusDto: el último heartbeat conocido de un dron (llega por MQTT sin
// necesidad de una misión activa, por eso sirve para ver el estado de un dron idle).
export type BackendDroneStatus = {
  droneId: string;
  lastSeen: string;
  timestamp: string | null;
  uptimeSec: number | null;
  missionId: string | null;
  mavlinkLinkOk: boolean | null;
  armed: boolean | null;
  flightMode: string | null;
  status: string | null;
  position: BackendDronePosition | null;
  signalStrengthDbm: number | null;
  cpuTempC: number | null;
  cpuLoadPct: number | null;
  battery: BackendDroneBattery | null;
  gps: BackendDroneGps | null;
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

export type AiSeverityReport = {
  status: "provisional_human_review_required" | "not_applicable_no_corrosion_detected";
  predicted_severity: "baja" | "media" | "alta" | "sin_corrosion";
  corroded_area_percent?: number;
  warning?: string;
};

export type AiAnalysisFindings = {
  schema_version?: "2.0";
  corrosion: AiCorrosionReport;
  severity: AiSeverityReport | null;
};

export type InspectionPhotoStatus =
  | "PENDING_ANALYSIS"
  | "ANALYZED"
  | "ANALYSIS_FAILED";

export type BackendInspectionPhoto = {
  idInspectionPhoto: string;
  idMission: string;
  idMissionWaypoint: string;
  reportCode: string | null;
  idAsset: number | null;
  capturedAt: string;
  rawImageUrl: string;
  analyzedImageUrl: string | null;
  status: InspectionPhotoStatus;
  findings: string | null;
  analyzedAt: string | null;
};

export type BackendReportStatus = "PROCESSING" | "PENDING_VALIDATION" | "VALIDATED" | "REJECTED";

export type BackendReport = {
  idReport: string;
  code: string;
  title: string;
  idMission: string;
  missionName: string;
  idAsset: number;
  assetName: string;
  createdAt: string;
  updatedAt: string;
  status: BackendReportStatus;
  validatorSignature: string | null;
  validatorComments: string | null;
  validatedAt: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "NOT_REPORTED";
  findingsCount: number;
  photos: BackendInspectionPhoto[];
};
