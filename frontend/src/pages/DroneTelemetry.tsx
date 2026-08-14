import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Battery, Check, MapPin, Plane, Satellite } from "lucide-react";
import { getDroneStatuses, getDrones } from "../api/client";
import type { BackendDrone, BackendDroneStatus } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";
import droneImage from "../assets/drone-image.png";

const HEARTBEAT_POLL_INTERVAL_MS = 3000;

const EMPTY_VALUE = "--";

export function DroneTelemetryView() {
  const [drones, setDrones] = useState<BackendDrone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [heartbeat, setHeartbeat] = useState<BackendDroneStatus | null>(null);
  const [heartbeatError, setHeartbeatError] = useState("");

  useEffect(() => {
    getDrones()
      .then((items) => {
        setDrones(items);
        setSelectedDroneId((current) => current || items[0]?.droneId || "");
      })
      .catch(() => setDrones([]));
  }, []);

  useEffect(() => {
    if (!selectedDroneId) {
      setHeartbeat(null);
      return;
    }

    let cancelled = false;

    const poll = () => {
      getDroneStatuses()
        .then((statuses) => {
          if (cancelled) return;
          setHeartbeat(statuses.find((droneStatus) => droneStatus.droneId === selectedDroneId) ?? null);
          setHeartbeatError("");
          setUpdatedAt(new Date().toLocaleTimeString("es-AR"));
        })
        .catch(() => {
          if (!cancelled) setHeartbeatError("No se pudo obtener el heartbeat del dron.");
        });
    };

    poll();
    const intervalId = setInterval(poll, HEARTBEAT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedDroneId]);

  const droneOptions = useMemo(
    () => drones.map((drone) => ({ id: drone.droneId, label: drone.name || drone.droneId })),
    [drones]
  );

  const selectedDroneLabel = droneOptions.find((drone) => drone.id === selectedDroneId)?.label ?? selectedDroneId;

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

        <p className={heartbeat?.mavlinkLinkOk ? "drone-sse-status connected" : "drone-sse-status"}>
          <span />
          {heartbeat?.mavlinkLinkOk ? "Conectado" : "Desconectado"}
        </p>
      </article>

      {heartbeatError && <p className="drone-sse-error">{heartbeatError}</p>}

      <section className="drone-telemetry-grid">
        <DroneInfoCard icon={<Plane size={20} />} title="Estado" tone="blue">
          <InfoLine label="Estado" value={heartbeat?.status ?? EMPTY_VALUE} />
          <InfoLine label="Modo de vuelo" value={heartbeat?.flightMode ?? EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<Battery size={20} />} title="Bateria" tone="green">
          <strong className="drone-big-value">{heartbeat?.battery ? `${heartbeat.battery.percentage}%` : EMPTY_VALUE}</strong>
          <InfoLine label="Voltaje" value={heartbeat?.battery ? `${formatNumber(heartbeat.battery.voltageV, 2)} V` : EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<MapPin size={20} />} title="Posicion" tone="blue">
          <InfoLine label="Latitud" value={heartbeat?.position ? heartbeat.position.latitude.toFixed(6) : EMPTY_VALUE} />
          <InfoLine label="Longitud" value={heartbeat?.position ? heartbeat.position.longitude.toFixed(6) : EMPTY_VALUE} />
        </DroneInfoCard>

        <DroneInfoCard icon={<Satellite size={20} />} title="GPS" tone="green">
          <InfoLine label="Fix" value={heartbeat?.gps?.fixType ?? EMPTY_VALUE} />
          <InfoLine label="Satelites" value={heartbeat?.gps ? String(heartbeat.gps.satellites) : EMPTY_VALUE} />
        </DroneInfoCard>
      </section>

      <section className="drone-bottom-grid">
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
