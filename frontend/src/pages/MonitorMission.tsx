import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Camera, Gauge, Play, Route, Satellite, X } from "lucide-react";
import type { BackendAsset, BackendFlightPlan, BackendMission, BackendMissionStatus, BackendMissionWaypoint, BackendPlanWaypoint } from "../api/types";
import { getAssets, getFlightPlan, getMission, getMissions, startMission, cancelMission } from "../api/client";
import { BragadoPlant3DMap } from "../components/BragadoPlant3DMap";
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
  altitude: number;
  droneDegree: number;
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
    longitude: point.longitude,
    altitude: point.altitude,
    droneDegree: point.droneDegree
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
  const [isCancelling, setIsCancelling] = useState(false);
  const frozenProgress = useRef<typeof telemetry | undefined>(undefined);
  const statusPollRef = useRef<number | null>(null);

  const { telemetry, statusEvent } = useMissionTelemetry(mission?.idMission, token);

  useEffect(() => {
    if(!statusEvent || statusEvent.missionId!==mission?.idMission)return;
    const status: BackendMissionStatus | undefined = statusEvent.event==='MISSION_STARTED'?'IN_PROGRESS':statusEvent.event==='MISSION_START_REJECTED'?'FAILED':statusEvent.event==='MISSION_COMPLETED'?'COMPLETED':statusEvent.event==='MISSION_CANCELLED'?'CANCELLED':undefined;
    if(status)setMission(previous=>previous?{...previous,status}:previous);
    if(statusEvent.event==='MISSION_START_REJECTED')setStartError(statusEvent.reason || 'El controlador rechazó el inicio de la misión.');
    if(statusEvent.event==='COMMAND_REJECTED'){setStartError(statusEvent.reason || 'El controlador rechazó la orden.');setIsCancelling(false);}
  }, [statusEvent, mission?.idMission]);

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
    frozenProgress.current=undefined;
    try {
      const saved=sessionStorage.getItem(`mission-cancel-progress:${missionId}`);
      if(saved)frozenProgress.current=JSON.parse(saved);
    } catch { /* The counters can still freeze without browser storage. */ }
    setIsCancelling(false);
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
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "No se pudo cargar la misión.");
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

  const inspectionTelemetry = frozenProgress.current === undefined ? telemetry : frozenProgress.current;
  const currentWaypoint = inspectionTelemetry?.currentWaypoint ?? null;


  const totalWaypoints = routePoints.length;
  const orderedRoutePoints = useMemo(() => [...routePoints].sort((a, b) => a.sequence - b.sequence), [routePoints]);
  const totalRouteDistanceMetersValue = useMemo(() => totalRouteDistanceMeters(orderedRoutePoints), [orderedRoutePoints]);
  const distanceRemainingMeters = useMemo(
    () => remainingRouteDistanceMeters(orderedRoutePoints, inspectionTelemetry?.position, currentWaypoint),
    [orderedRoutePoints, inspectionTelemetry?.position, currentWaypoint]
  );
  const distanceTraveledMeters = Math.max(0, totalRouteDistanceMetersValue - distanceRemainingMeters);
  const progress =
    totalRouteDistanceMetersValue > 0
      ? Math.min(100, (distanceTraveledMeters / totalRouteDistanceMetersValue) * 100)
      : mission?.completionPercentage ?? null;
  const progressWidth = progress == null ? 0 : Math.max(0, Math.min(100, progress));
  const missionStatus = statusLabel(mission?.status);
  const isPendingMission = mission?.status === "PLANNED";


  const currentGimbal = useMemo(() => {
    if (currentWaypoint == null || !mission?.missionWaypoints) return null;
    const waypoint = mission.missionWaypoints.find((point) => point.sequence === currentWaypoint);
    if (!waypoint || waypoint.gimbalPitchDeg == null) return null;
    const pitch = waypoint.gimbalPitchDeg;
    const yaw = waypoint.gimbalYawDeg ?? 0;
    return { pitch, yaw, assetName: waypoint.name };
  }, [currentWaypoint, mission?.missionWaypoints]);

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
      setStartError(error instanceof Error ? error.message : "No se pudo iniciar la misión.");
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
    ["Batería", telemetry?.battery ? `${telemetry.battery.percentage}%` : EMPTY_VALUE],
    ["Altitud relativa", telemetry?.position ? `${formatNumber(telemetry.position.relativeAltitude)} m` : EMPTY_VALUE],
    ["Velocidad horizontal", telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundHorizontalSpeedMs)} m/s` : EMPTY_VALUE],
    ["Velocidad vertical", telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundVerticalSpeedMs)} m/s` : EMPTY_VALUE],
    ["Tiempo activo", activeDurationSeconds != null ? formatDuration(activeDurationSeconds) : EMPTY_VALUE],
    ["Distancia recorrida", formatDistance(distanceTraveledMeters)],
    ["Distancia restante", totalRouteDistanceMetersValue > 0 ? formatDistance(distanceRemainingMeters) : EMPTY_VALUE],
    ["Última actualización", telemetry?.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString("es-AR") : EMPTY_VALUE]
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
            <h1>Monitorear misión</h1>
            <p>Seguimiento en vivo de las inspecciones a los activos.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      {loadError && <p className="mission-empty">{loadError}</p>}

      {!loadError && !mission && <p className="mission-empty">Cargando misión...</p>}

      {!loadError && mission && (
        <section className="monitor-body-grid">
          <article className="monitor-live-card">
            <div className="monitor-live-title">
              <h2>{mission.name}</h2>
              <span className={`mission-state ${statusClass(missionStatus)}`}>{missionStatus}</span>
            </div>
            <p className="monitor-map-label">PLANTA 3D</p>

            <div className={`monitor-map-frame${isPendingMission ? " pending" : ""}`}>
              <BragadoPlant3DMap
                assets={assets}
                playback={{id:mission.idMission,status:statusEvent?.missionId===mission.idMission&&statusEvent.event==='MISSION_COMPLETED'?'COMPLETED':mission.status,points:routePoints,telemetry}}
              />
              {isPendingMission && (
                <div className="monitor-pending-overlay">
                  <div>
                    <h3>La misión aún no comenzó</h3>
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
              <button className="monitor-cancel" type="button" disabled={isCancelling || mission?.status!=='IN_PROGRESS'} onClick={async()=>{
                if(!mission)return;
                frozenProgress.current=telemetry;
                try{sessionStorage.setItem(`mission-cancel-progress:${mission.idMission}`,JSON.stringify(telemetry));}catch{}
                setIsCancelling(true);setStartError(null);
                try{await cancelMission(mission.idMission);}catch(error){setIsCancelling(false);setStartError(error instanceof Error?error.message:'No se pudo cancelar la misión.');}
              }}>
                <X size={17} />
                {isCancelling?'Cancelación solicitada…':'Cancelar'}
              </button>
            </div>
            {(startError || (mission?.status==='FAILED' && mission.notes)) && <p className="monitor-start-error">{startError || mission?.notes}</p>}
          </article>

          <aside className="monitor-side-column">
            <article className="monitor-side-card monitor-progress-card">
              <CardHeader icon={<Route size={15} />} title="Progreso de misión" />
              <strong>
                Punto {currentWaypoint ?? EMPTY_VALUE} de {totalWaypoints || EMPTY_VALUE}
              </strong>
              <div className="monitor-progress-track"><span style={{ width: `${progressWidth}%` }} /></div>
              <p>{formatPercent(progress)} completado</p>
              <ProgressLine label="Misión" value={mission.idMission} />
              <ProgressLine label="Plan de vuelo" value={flightPlan?.name ?? EMPTY_VALUE} />
            </article>

            <article className="monitor-side-card monitor-telemetry-card">
              <CardHeader icon={<Gauge size={15} />} title="Telemetría" />
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
              <CardHeader icon={<Camera size={15} />} title="Cámara" />
              {currentGimbal ? (
                <div className="monitor-camera-info">
                  <span className="monitor-camera-gimbal">
                    Apuntando {currentGimbal.assetName ? `a ${currentGimbal.assetName}` : "al punto de interes"}
                  </span>
                  <ProgressLine label="Inclinacion (pitch)" value={`${pitchDescription(currentGimbal.pitch)} (${formatNumber(currentGimbal.pitch, 0)} deg)`} />
                  <ProgressLine label="Giro (yaw)" value={`${formatNumber(currentGimbal.yaw, 0)} deg`} />
                </div>
              ) : (
                <p className="monitor-empty-media">Sin apuntado de cámara para este tramo del vuelo.</p>
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
