import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Camera, Gauge, Pause, Play, Route, Satellite, X } from "lucide-react";
import type { BackendAsset, BackendFlightPlan, BackendMission, BackendMissionStatus, BackendMissionWaypoint, BackendPlanWaypoint } from "../api/types";
import { getAssets, getFlightPlan, getMission, getMissions, startMission } from "../api/client";
import { MissionDetailRouteMap, type AssetInspectionInfo } from "../components/MissionDetailRouteMap";
import { photoCountForWaypoint } from "../utils/missionPhotos";
import { AppTopActions } from "../components/AppTopActions";
import { Compass } from "../components/Compass";
import { useMissionTelemetry } from "../hooks/useMissionTelemetry";
import { remainingRouteDistanceMeters, totalRouteDistanceMeters } from "../utils/geo";

type MonitorMissionViewProps = {
  missionId: string | null;
  token: string;
  onBack: () => void;
};

type RoutePoint = {
  sequence: number;
  latitude: number;
  longitude: number;
};

const EMPTY_VALUE = "-";

type MissionDisplayStatus = "Pendiente" | "Enviando al dron" | "En progreso" | "Completada" | "Cancelada" | "Fallida";

function statusLabel(status: BackendMissionStatus | undefined): MissionDisplayStatus {
  if (status === "IN_PROGRESS") return "En progreso";
  if (status === "UPLOADING") return "Enviando al dron";
  if (status === "COMPLETED") return "Completada";
  if (status === "CANCELLED") return "Cancelada";
  if (status === "FAILED") return "Fallida";
  return "Pendiente";
}

function statusClass(status: MissionDisplayStatus) {
  if (status === "Enviando al dron") return "uploading";
  if (status === "En progreso") return "progress";
  if (status === "Completada") return "completed";
  if (status === "Cancelada") return "cancelled";
  if (status === "Fallida") return "failed";
  return "pending";
}

function toRoutePoint(point: BackendMissionWaypoint | BackendPlanWaypoint): RoutePoint {
  return {
    sequence: point.sequence,
    latitude: point.latitude,
    longitude: point.longitude
  };
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return EMPTY_VALUE;
  return `${Math.round(value)}%`;
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value == null || Number.isNaN(value)) return EMPTY_VALUE;
  return value.toFixed(decimals);
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

const COMPASS_LABELS = ["Norte", "Noreste", "Este", "Sureste", "Sur", "Suroeste", "Oeste", "Noroeste"];

function headingToCompassLabel(headingDegree: number): string {
  const index = Math.round(headingDegree / 45) % 8;
  return COMPASS_LABELS[index];
}

function pitchDescription(pitch: number): string {
  if (pitch > 10) return "hacia arriba";
  if (pitch < -100) return "cenital (hacia abajo)";
  if (pitch < -10) return "hacia abajo";
  return "horizontal";
}

export function MonitorMissionView({ missionId, token, onBack }: MonitorMissionViewProps) {
  const [mission, setMission] = useState<BackendMission | null>(null);
  const [flightPlan, setFlightPlan] = useState<BackendFlightPlan | null>(null);
  const [assets, setAssets] = useState<BackendAsset[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const statusPollRef = useRef<number | null>(null);

  const { telemetry } = useMissionTelemetry(mission?.idMission, token);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (mission?.status !== "IN_PROGRESS") return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [mission?.status]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setMission(null);
    setFlightPlan(null);
    setAssets([]);
    setStartError(null);

    if (statusPollRef.current) {
      window.clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }

    const loadMission = missionId ? getMission(missionId) : getMissions().then((items) => items[0] ?? null);

    loadMission
      .then((loadedMission) => {
        if (cancelled) return;
        setMission(loadedMission);
        if (!loadedMission) return null;
        return getFlightPlan(loadedMission.idFlightPlan);
      })
      .then((loadedPlan) => {
        if (!cancelled && loadedPlan) setFlightPlan(loadedPlan);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "No se pudo cargar la mision.");
      });

    getAssets()
      .then((loadedAssets) => {
        if (!cancelled) setAssets(loadedAssets);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [missionId]);

  useEffect(() => {
    return () => {
      if (statusPollRef.current) window.clearInterval(statusPollRef.current);
    };
  }, []);

  const routePoints = useMemo(
    () => (mission?.missionWaypoints?.length ? mission.missionWaypoints.map(toRoutePoint) : flightPlan?.route?.map(toRoutePoint) ?? []),
    [mission?.missionWaypoints, flightPlan?.route]
  );

  const currentWaypoint = telemetry?.currentWaypoint ?? null;

  const assetInspectionInfo = useMemo(() => {
    const info = new Map<number, AssetInspectionInfo>();

    const entryFor = (idAsset: number) => {
      let entry = info.get(idAsset);
      if (!entry) {
        entry = { inspected: false, totalPhotos: 0, takenPhotos: 0 };
        info.set(idAsset, entry);
      }
      return entry;
    };

    if (mission?.missionWaypoints?.length) {
      for (const waypoint of mission.missionWaypoints) {
        if (waypoint.idAsset == null || waypoint.gimbalPitchDeg == null) continue;
        const entry = entryFor(waypoint.idAsset);
        entry.inspected = true;
        entry.totalPhotos += 1;
        if (currentWaypoint != null && waypoint.sequence < currentWaypoint) entry.takenPhotos += 1;
      }
    } else if (flightPlan?.route?.length) {
      for (const waypoint of flightPlan.route) {
        if (waypoint.idAsset == null || !waypoint.pointOfInterest) continue;
        const entry = entryFor(waypoint.idAsset);
        entry.inspected = true;
        entry.totalPhotos += photoCountForWaypoint(waypoint);
      }
    }

    return info;
  }, [mission?.missionWaypoints, flightPlan?.route, currentWaypoint]);

  const totalWaypoints = routePoints.length;
  const orderedRoutePoints = useMemo(() => [...routePoints].sort((a, b) => a.sequence - b.sequence), [routePoints]);
  const totalRouteDistanceMetersValue = useMemo(() => totalRouteDistanceMeters(orderedRoutePoints), [orderedRoutePoints]);
  const distanceRemainingMeters = useMemo(
    () => remainingRouteDistanceMeters(orderedRoutePoints, telemetry?.position, currentWaypoint),
    [orderedRoutePoints, telemetry?.position, currentWaypoint]
  );
  const distanceTraveledMeters = Math.max(0, totalRouteDistanceMetersValue - distanceRemainingMeters);
  const progress =
    totalRouteDistanceMetersValue > 0
      ? Math.min(100, (distanceTraveledMeters / totalRouteDistanceMetersValue) * 100)
      : mission?.completionPercentage ?? null;
  const progressWidth = progress == null ? 0 : Math.max(0, Math.min(100, progress));
  const missionStatus = statusLabel(mission?.status);
  const isPendingMission = mission?.status === "PLANNED";

  const dronePosition = telemetry?.position
    ? { lat: telemetry.position.latitude, lng: telemetry.position.longitude, headingDegree: telemetry.velocity?.headingDegree }
    : null;

  const currentGimbal = useMemo(() => {
    if (currentWaypoint == null || !mission?.missionWaypoints) return null;
    const waypoint = mission.missionWaypoints.find((point) => point.sequence === currentWaypoint);
    if (!waypoint || waypoint.gimbalPitchDeg == null) return null;
    const pitch = waypoint.gimbalPitchDeg;
    const yaw = waypoint.gimbalYawDeg ?? 0;
    const droneHeading = telemetry?.velocity?.headingDegree ?? waypoint.droneDegree;
    const absoluteHeading = ((droneHeading + yaw) % 360 + 360) % 360;
    return { pitch, yaw, assetName: waypoint.name, absoluteHeading };
  }, [currentWaypoint, mission?.missionWaypoints, telemetry?.velocity?.headingDegree]);

  const photoCounts = useMemo(() => {
    if (mission?.missionWaypoints?.length) {
      let total = 0;
      let taken = 0;
      for (const waypoint of mission.missionWaypoints) {
        if (waypoint.gimbalPitchDeg == null) continue;
        total += 1;
        if (currentWaypoint != null && waypoint.sequence < currentWaypoint) taken += 1;
      }
      return { total, taken };
    }
    if (flightPlan?.route?.length) {
      let total = 0;
      for (const waypoint of flightPlan.route) {
        if (!waypoint.pointOfInterest) continue;
        total += photoCountForWaypoint(waypoint);
      }
      return { total, taken: 0 };
    }
    return { total: 0, taken: 0 };
  }, [mission?.missionWaypoints, flightPlan?.route, currentWaypoint]);

  const pollMissionStatus = (idMission: string) => {
    if (statusPollRef.current) window.clearInterval(statusPollRef.current);

    let attempts = 0;
    statusPollRef.current = window.setInterval(() => {
      attempts += 1;
      getMission(idMission)
        .then((updated) => {
          setMission(updated);
          if (updated.status !== "UPLOADING" || attempts >= 300) {
            if (statusPollRef.current) window.clearInterval(statusPollRef.current);
            statusPollRef.current = null;
          }
        })
        .catch(() => {
          if (statusPollRef.current) window.clearInterval(statusPollRef.current);
          statusPollRef.current = null;
        });
    }, 2000);
  };

  const handleStartMission = async () => {
    if (!mission) return;
    setStartError(null);
    setIsStarting(true);
    try {
      const updated = await startMission(mission.idMission);
      setMission(updated);
      pollMissionStatus(updated.idMission);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "No se pudo iniciar la mision.");
    } finally {
      setIsStarting(false);
    }
  };

  const activeDurationSeconds = useMemo(() => {
    if (!mission?.startedAt) return null;
    const start = new Date(mission.startedAt).getTime();
    if (Number.isNaN(start)) return null;
    const end = mission.finishedAt ? new Date(mission.finishedAt).getTime() : now;
    return (end - start) / 1000;
  }, [mission?.startedAt, mission?.finishedAt, now]);

  const flightRows = [
    ["Bateria", telemetry?.battery ? `${telemetry.battery.percentage}%` : EMPTY_VALUE],
    ["Altitud relativa", telemetry?.position ? `${formatNumber(telemetry.position.relativeAltitude)} m` : EMPTY_VALUE],
    ["Velocidad horizontal", telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundHorizontalSpeedMs)} m/s` : EMPTY_VALUE],
    ["Velocidad vertical", telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundVerticalSpeedMs)} m/s` : EMPTY_VALUE],
    ["Tiempo activo", activeDurationSeconds != null ? formatDuration(activeDurationSeconds) : EMPTY_VALUE],
    ["Distancia recorrida", formatDistance(distanceTraveledMeters)],
    ["Distancia restante", totalRouteDistanceMetersValue > 0 ? formatDistance(distanceRemainingMeters) : EMPTY_VALUE],
    ["Ultima actualizacion", telemetry?.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString("es-AR") : EMPTY_VALUE]
  ];

  const gpsRows = [
    ["Senal GPS", telemetry?.gps?.fixType ?? EMPTY_VALUE],
    ["Satelites", telemetry?.gps ? String(telemetry.gps.satellites) : EMPTY_VALUE],
    ["Error horizontal (HDOP)", telemetry?.gps ? telemetry.gps.hdop.toFixed(2) : EMPTY_VALUE],
    ["Error vertical (VDOP)", telemetry?.gps ? telemetry.gps.vdop.toFixed(2) : EMPTY_VALUE]
  ];

  return (
    <section className="monitor-mission-dashboard">
      <header className="monitor-topbar">
        <div className="monitor-title-row">
          <button className="monitor-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>Monitorear mision</h1>
            <p>Seguimiento en vivo de las inspecciones a los activos.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      {loadError && <p className="mission-empty">{loadError}</p>}

      {!loadError && !mission && <p className="mission-empty">Cargando mision...</p>}

      {!loadError && mission && (
        <section className="monitor-body-grid">
          <article className="monitor-live-card">
            <div className="monitor-live-title">
              <h2>{mission.name}</h2>
              <span className={`mission-state ${statusClass(missionStatus)}`}>{missionStatus}</span>
            </div>
            <p className="monitor-map-label">MAPA SATELITAL - AREA DE PLANTA</p>

            <div className={`monitor-map-frame${isPendingMission ? " pending" : ""}`}>
              <MissionDetailRouteMap
                points={routePoints}
                assets={assets}
                assetInspectionInfo={assetInspectionInfo}
                dronePosition={dronePosition}
                completedSequence={currentWaypoint}
              />
              {isPendingMission && (
                <div className="monitor-pending-overlay">
                  <div>
                    <h3>La mision aun no comenzo</h3>
                    <p>Presione Iniciar para comenzar el vuelo.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="monitor-main-actions">
              {isPendingMission && (
                <button className="monitor-start" type="button" onClick={handleStartMission} disabled={isStarting}>
                  <Play size={17} />
                  {isStarting ? "Iniciando..." : "Iniciar"}
                </button>
              )}
              <button className="monitor-pause" type="button">
                <Pause size={17} />
                Pausar
              </button>
              <button className="monitor-cancel" type="button" onClick={onBack}>
                <X size={17} />
                Cancelar
              </button>
            </div>
            {startError && <p className="monitor-start-error">{startError}</p>}
          </article>

          <aside className="monitor-side-column">
            <article className="monitor-side-card monitor-progress-card">
              <CardHeader icon={<Route size={15} />} title="Progreso de mision" />
              <strong>
                Punto {currentWaypoint ?? EMPTY_VALUE} de {totalWaypoints || EMPTY_VALUE}
              </strong>
              <div className="monitor-progress-track"><span style={{ width: `${progressWidth}%` }} /></div>
              <p>{formatPercent(progress)} completado</p>
              <ProgressLine label="Mision" value={mission.idMission} />
              <ProgressLine label="Plan de vuelo" value={flightPlan?.name ?? EMPTY_VALUE} />
            </article>

            <article className="monitor-side-card monitor-telemetry-card">
              <CardHeader icon={<Gauge size={15} />} title="Telemetria" />
              <div className="monitor-telemetry-body">
                <Compass headingDegree={telemetry?.velocity?.headingDegree} />
                <div className="monitor-telemetry-list">
                  {flightRows.map(([label, value]) => (
                    <ProgressLine key={label} label={label} value={value} />
                  ))}
                </div>
              </div>
            </article>

            <article className="monitor-side-card monitor-gps-card">
              <CardHeader icon={<Satellite size={15} />} title="GPS" />
              <div className="monitor-telemetry-list">
                {gpsRows.map(([label, value]) => (
                  <ProgressLine key={label} label={label} value={value} />
                ))}
              </div>
            </article>

            <article className="monitor-side-card monitor-captures-card">
              <CardHeader icon={<Camera size={15} />} title="Camara" />
              {currentGimbal ? (
                <div className="monitor-camera-info">
                  <span className="monitor-camera-gimbal">
                    Apuntando {currentGimbal.assetName ? `a ${currentGimbal.assetName}` : "al punto de interes"}
                  </span>
                  <ProgressLine
                    label="Direccion"
                    value={`${headingToCompassLabel(currentGimbal.absoluteHeading)} (${formatNumber(currentGimbal.absoluteHeading, 0)} deg)`}
                  />
                  <ProgressLine label="Inclinacion (pitch)" value={`${pitchDescription(currentGimbal.pitch)} (${formatNumber(currentGimbal.pitch, 0)} deg)`} />
                  <ProgressLine label="Giro (yaw)" value={`${formatNumber(currentGimbal.yaw, 0)} deg`} />
                </div>
              ) : (
                <p className="monitor-empty-media">Sin apuntado de camara para este tramo del vuelo.</p>
              )}
              <ProgressLine
                label="Fotos capturadas"
                value={photoCounts.total > 0 ? `${photoCounts.taken} de ${photoCounts.total}` : EMPTY_VALUE}
              />
            </article>
          </aside>
        </section>
      )}
    </section>
  );
}

function CardHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h2 className="monitor-card-header">
      <span className="monitor-card-header-icon">{icon}</span>
      {title}
    </h2>
  );
}

function ProgressLine({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="monitor-data-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
