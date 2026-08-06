import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Pause, Play, X } from "lucide-react";
import type { BackendFlightPlan, BackendMission, BackendMissionStatus, BackendMissionWaypoint, BackendPlanWaypoint } from "../api/types";
import { getFlightPlan, getMission, getMissions, startMission } from "../api/client";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { AppTopActions } from "../components/AppTopActions";

type TelemetryUpdate = {
  missionId: string;
  timestamp: string;
  position: { latitude: number; longitude: number; relativeAltitude: number; absoluteAltitude: number } | null;
  velocity: { groundHorizontalSpeedMs: number; groundVerticalSpeedMs: number; headingDegree: number } | null;
  battery: { percentage: number; voltageV: number } | null;
  gps: { fixType: string; satellites: number; hdop: number; vdop: number } | null;
  flightMode: string | null;
  currentWaypoint: number | null;
};

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

export function MonitorMissionView({ missionId, token, onBack }: MonitorMissionViewProps) {
  const [mission, setMission] = useState<BackendMission | null>(null);
  const [flightPlan, setFlightPlan] = useState<BackendFlightPlan | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryUpdate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const statusPollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setTelemetry(null);
    setMission(null);
    setFlightPlan(null);
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

    return () => {
      cancelled = true;
    };
  }, [missionId]);

  useEffect(() => {
    return () => {
      if (statusPollRef.current) window.clearInterval(statusPollRef.current);
    };
  }, []);

  useEffect(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    if (!mission?.idMission || !token) return;

    const url = `/api/v1/telemetry/missions/${mission.idMission}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("telemetry", (event) => {
      try {
        setTelemetry(JSON.parse((event as MessageEvent).data));
      } catch {
        setTelemetry(null);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [mission?.idMission, token]);

  const routePoints = useMemo(
    () => (mission?.missionWaypoints?.length ? mission.missionWaypoints.map(toRoutePoint) : flightPlan?.route?.map(toRoutePoint) ?? []),
    [mission?.missionWaypoints, flightPlan?.route]
  );

  const currentWaypoint = telemetry?.currentWaypoint ?? null;
  const totalWaypoints = routePoints.length;
  const progress = mission?.completionPercentage ?? null;
  const progressWidth = progress == null ? 0 : Math.max(0, Math.min(100, progress));
  const missionStatus = statusLabel(mission?.status);
  const isPendingMission = mission?.status === "PLANNED";

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

  const telemetryRows = [
    ["Bateria", telemetry?.battery ? `${telemetry.battery.percentage}%` : EMPTY_VALUE],
    ["Altitud", telemetry?.position ? `${formatNumber(telemetry.position.relativeAltitude)} m` : EMPTY_VALUE],
    ["Velocidad", telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundHorizontalSpeedMs)} m/s` : EMPTY_VALUE],
    ["Senal GPS", telemetry?.gps?.fixType ?? EMPTY_VALUE],
    ["Satelites", telemetry?.gps ? String(telemetry.gps.satellites) : EMPTY_VALUE],
    ["Timestamp", telemetry?.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString("es-AR") : EMPTY_VALUE]
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

            <div className="monitor-map-frame">
              <MissionDetailRouteMap points={routePoints} />
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
              <h2>Progreso de mision</h2>
              <strong>
                Punto {currentWaypoint ?? EMPTY_VALUE} de {totalWaypoints || EMPTY_VALUE}
              </strong>
              <div className="monitor-progress-track"><span style={{ width: `${progressWidth}%` }} /></div>
              <p>{formatPercent(progress)} completado</p>
              <ProgressLine label="Mision" value={mission.idMission.slice(0, 8)} />
              <ProgressLine label="Plan de vuelo" value={flightPlan?.name ?? EMPTY_VALUE} />
            </article>

            <article className="monitor-side-card monitor-telemetry-card">
              <h2>Telemetria</h2>
              <div className="monitor-telemetry-list">
                {telemetryRows.map(([label, value]) => (
                  <ProgressLine key={label} label={label} value={value} />
                ))}
              </div>
            </article>

            <article className="monitor-side-card monitor-captures-card">
              <h2>Capturas recientes</h2>
              <p className="monitor-empty-media">No hay multimedia disponible en este momento.</p>
            </article>
          </aside>
        </section>
      )}
    </section>
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
