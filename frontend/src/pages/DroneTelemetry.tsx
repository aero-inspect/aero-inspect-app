import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Battery, Check, Clock, Gauge, MapPin, Plane, Satellite } from "lucide-react";
import { getMissions } from "../api/client";
import type { BackendMission } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";
import droneImage from "../assets/drone-image.png";

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

type StatusEvent = {
  missionId: string;
  event: string;
  timestamp: string;
  batteryPercentage: number;
  action: string;
};

type DroneTelemetryViewProps = {
  token: string;
};

const EMPTY_VALUE = "--";

export function DroneTelemetryView({ token }: DroneTelemetryViewProps) {
  const [missionId, setMissionId] = useState("");
  const [missions, setMissions] = useState<BackendMission[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState("");
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState("");
  const [telemetry, setTelemetry] = useState<TelemetryUpdate | null>(null);
  const [status, setStatus] = useState<StatusEvent | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getMissions()
      .then((items) => {
        setMissions(items);
        const firstDroneId = items.find((mission) => mission.droneId)?.droneId ?? "";
        setSelectedDroneId((current) => current || firstDroneId);
      })
      .catch(() => setMissions([]));
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const droneOptions = useMemo(() => {
    const uniqueDroneIds = Array.from(new Set(missions.map((mission) => mission.droneId).filter(Boolean)));
    return uniqueDroneIds.map((droneId) => ({ id: droneId, label: droneId }));
  }, [missions]);

  const selectedDroneLabel = droneOptions.find((drone) => drone.id === selectedDroneId)?.label ?? selectedDroneId;

  const connect = () => {
    const nextMissionId = missionId.trim();
    if (!nextMissionId || eventSourceRef.current) return;

    const url = `/api/v1/telemetry/missions/${nextMissionId}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setLastError("");
    };

    eventSource.addEventListener("telemetry", (event) => {
      try {
        setTelemetry(JSON.parse((event as MessageEvent).data));
        setUpdatedAt(new Date().toLocaleTimeString("es-AR"));
      } catch {
        setLastError("No se pudo leer el evento de telemetria.");
      }
    });

    eventSource.addEventListener("status", (event) => {
      try {
        setStatus(JSON.parse((event as MessageEvent).data));
        setUpdatedAt(new Date().toLocaleTimeString("es-AR"));
      } catch {
        setLastError("No se pudo leer el evento de estado.");
      }
    });

    eventSource.onerror = () => {
      setLastError("Error en la conexion SSE.");
      setConnected(false);
    };
  };

  const disconnect = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnected(false);
  };

  const formatNumber = (value: number | null | undefined, decimals = 1) => {
    if (value == null || Number.isNaN(value)) return EMPTY_VALUE;
    return value.toFixed(decimals);
  };

  const updatedLabel = updatedAt || EMPTY_VALUE;

  return (
    <section className="drones-dashboard">
      <header className="drones-topbar">
        <div>
          <h1>Drones</h1>
          <p>Monitorea el estado, la telemetria y el historial de tu dron.</p>
        </div>
        <AppTopActions />
      </header>

      <article className="drone-select-card">
        <div className="drone-select-field">
          <label htmlFor="drone-select">Seleccionar dron</label>
          <select
            id="drone-select"
            value={selectedDroneId}
            onChange={(event) => setSelectedDroneId(event.target.value)}
            disabled={droneOptions.length === 0}
          >
            {droneOptions.length === 0 ? (
              <option value="">No hay drones disponibles</option>
            ) : (
              droneOptions.map((drone) => (
                <option key={drone.id} value={drone.id}>
                  {drone.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="drone-select-update">
          <span>Ultima actualizacion:</span>
          <strong>{updatedLabel}</strong>
        </div>

        <p className={connected ? "drone-sse-status connected" : "drone-sse-status"}>
          <span />
          {connected ? "Conectado" : "Desconectado"}
        </p>
      </article>

      <article className="drone-mission-connect-card">
        <label htmlFor="mission-id">ID de la mision (UUID)</label>
        <input
          id="mission-id"
          type="text"
          value={missionId}
          onChange={(event) => setMissionId(event.target.value)}
          placeholder="Ingresa el UUID de la mision"
          disabled={connected}
        />
        {!connected ? (
          <button type="button" onClick={connect} disabled={!missionId.trim()}>
            Conectar
          </button>
        ) : (
          <button type="button" onClick={disconnect}>
            Desconectar
          </button>
        )}
      </article>

      {lastError && <p className="drone-sse-error">{lastError}</p>}

      <section className="drone-telemetry-grid">
        <DroneInfoCard icon={<Battery size={20} />} title="Bateria" tone="green">
          <strong className="drone-big-value">{telemetry?.battery ? `${telemetry.battery.percentage}%` : EMPTY_VALUE}</strong>
          <InfoLine label="Voltaje" value={telemetry?.battery ? `${formatNumber(telemetry.battery.voltageV, 2)} V` : EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<MapPin size={20} />} title="Posicion" tone="blue">
          <InfoLine label="Latitud" value={telemetry?.position ? telemetry.position.latitude.toFixed(6) : EMPTY_VALUE} />
          <InfoLine label="Longitud" value={telemetry?.position ? telemetry.position.longitude.toFixed(6) : EMPTY_VALUE} />
          <InfoLine label="Altitud relativa" value={telemetry?.position ? `${formatNumber(telemetry.position.relativeAltitude)} m` : EMPTY_VALUE} />
          <InfoLine label="Altitud absoluta" value={telemetry?.position ? `${formatNumber(telemetry.position.absoluteAltitude)} m` : EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<Gauge size={20} />} title="Velocidad" tone="violet">
          <InfoLine label="Horizontal" value={telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundHorizontalSpeedMs)} m/s` : EMPTY_VALUE} />
          <InfoLine label="Vertical" value={telemetry?.velocity ? `${formatNumber(telemetry.velocity.groundVerticalSpeedMs)} m/s` : EMPTY_VALUE} />
          <InfoLine label="Rumbo" value={telemetry?.velocity ? `${formatNumber(telemetry.velocity.headingDegree, 0)} grados` : EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<Satellite size={20} />} title="GPS" tone="green">
          <InfoLine label="Fix" value={telemetry?.gps?.fixType ?? EMPTY_VALUE} />
          <InfoLine label="Satelites" value={telemetry?.gps ? String(telemetry.gps.satellites) : EMPTY_VALUE} />
          <InfoLine label="HDOP" value={telemetry?.gps ? telemetry.gps.hdop.toFixed(2) : EMPTY_VALUE} />
          <InfoLine label="VDOP" value={telemetry?.gps ? telemetry.gps.vdop.toFixed(2) : EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<Plane size={20} />} title="Vuelo" tone="blue">
          <InfoLine label="Modo" value={telemetry?.flightMode ?? EMPTY_VALUE} />
          <InfoLine label="Waypoint actual" value={telemetry?.currentWaypoint != null ? String(telemetry.currentWaypoint) : EMPTY_VALUE} />
          <InfoLine label="Timestamp" value={telemetry ? new Date(telemetry.timestamp).toLocaleTimeString("es-AR") : EMPTY_VALUE} />
        </DroneInfoCard>
      </section>

      <section className="drone-bottom-grid">
        <DroneInfoCard icon={<Clock size={20} />} title="Ultimo evento de estado" tone="orange" className="drone-event-card">
          <InfoLine label="Evento" value={status?.event ?? EMPTY_VALUE} />
          <InfoLine label="Accion" value={status?.action ?? EMPTY_VALUE} />
          <InfoLine label="Bateria" value={status ? `${status.batteryPercentage}%` : EMPTY_VALUE} />
          <InfoLine label="Timestamp" value={status ? new Date(status.timestamp).toLocaleTimeString("es-AR") : EMPTY_VALUE} />
        </DroneInfoCard>

        <article className="drone-photo-card">
          <h2>{selectedDroneLabel || "Dron"}</h2>
          <p>Modelo: DJI Matrice 300 RTK</p>
          <img src={droneImage} alt={selectedDroneLabel || "Dron"} />
        </article>

        <article className="drone-preflight-card">
          <h2>Chequeos prevuelo</h2>
          {["Bateria", "Helices", "Camara", "Sensores", "Senal y GPS"].map((item) => (
            <div className="preflight-row" key={item}>
              <Check size={14} />
              <span>{item}</span>
              <strong>OK</strong>
            </div>
          ))}
          <div className="drone-ready-box">
            <Check size={18} />
            <strong>Dron listo para operar</strong>
          </div>
        </article>
      </section>
    </section>
  );
}

function DroneInfoCard({
  icon,
  title,
  tone,
  className = "",
  children
}: {
  icon: ReactNode;
  title: string;
  tone: "blue" | "green" | "orange" | "violet";
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`drone-info-card ${className}`}>
      <header>
        <span className={`drone-info-icon ${tone}`}>{icon}</span>
        <h2>{title}</h2>
      </header>
      <div className="drone-info-body">{children}</div>
    </article>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="drone-info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
