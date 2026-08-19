// Tipo compartido que refleja 1:1 el evento SSE "telemetry" emitido por
// TelemetryUpdateDto (general-monolith). Centralizado aca para no duplicarlo
// en cada pantalla que consume el stream.
export type TelemetryUpdate = {
  missionId: string;
  timestamp: string;
  position: { latitude: number; longitude: number; relativeAltitude: number; absoluteAltitude: number } | null;
  velocity: { groundHorizontalSpeedMs: number; groundVerticalSpeedMs: number; headingDegree: number } | null;
  battery: { percentage: number; voltageV: number } | null;
  gps: { fixType: string; satellites: number; hdop: number; vdop: number } | null;
  flightMode: string | null;
  currentWaypoint: number | null;
};

export type StatusEvent = {
  missionId: string;
  event: string;
  timestamp: string;
  batteryPercentage: number;
  action: string;
};
