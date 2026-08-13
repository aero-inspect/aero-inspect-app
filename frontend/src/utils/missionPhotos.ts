import type { BackendPlanWaypoint } from "../api/types";

// Cuántas fotos dispara un punto de interés al ser seleccionado como stop de una misión.
// Coincide con la expansión que hace el backend (MissionService): cada CameraAngle del
// waypoint se manda como su propio waypoint STOP (una foto con ese apuntado de gimbal cada
// uno); si no tiene ningún CameraAngle, igual saca una foto sin apuntado al llegar al stop.
export function photoCountForWaypoint(waypoint: BackendPlanWaypoint): number {
  return waypoint.cameraAngles && waypoint.cameraAngles.length > 0 ? waypoint.cameraAngles.length : 1;
}
