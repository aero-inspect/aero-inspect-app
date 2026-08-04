import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

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

export function PruebaTelemetriaView({ token, onBack }: { token: string; onBack: () => void }) {
  const [missionId, setMissionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState("");
  const [telemetry, setTelemetry] = useState<TelemetryUpdate | null>(null);
  const [status, setStatus] = useState<StatusEvent | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = () => {
    if (!missionId.trim() || eventSourceRef.current) return;

    const url = `/api/v1/telemetry/missions/${missionId.trim()}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setLastError("");
    };

    eventSource.addEventListener("telemetry", (event) => {
      try {
        setTelemetry(JSON.parse((event as MessageEvent).data));
        setUpdatedAt(new Date().toLocaleTimeString());
      } catch {
        setLastError("No se pudo parsear el evento de telemetria");
      }
    });

    eventSource.addEventListener("status", (event) => {
      try {
        setStatus(JSON.parse((event as MessageEvent).data));
        setUpdatedAt(new Date().toLocaleTimeString());
      } catch {
        setLastError("No se pudo parsear el evento de estado");
      }
    });

    eventSource.onerror = () => {
      setLastError("Error en la conexion SSE (revisa la consola / backend)");
      setConnected(false);
    };
  };

  const disconnect = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnected(false);
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <section style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button type="button" onClick={onBack} className="ghost-button">
          <ArrowLeft size={18} />
          Volver
        </button>
        <div>
          <h1 style={{ margin: 0 }}>Prueba de telemetria (SSE)</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Conecta directamente al endpoint SSE de general-monolith y muestra el ultimo valor recibido.
          </p>
        </div>
      </header>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="ID de la mision (UUID)"
          value={missionId}
          onChange={(event) => setMissionId(event.target.value)}
          disabled={connected}
          style={{ padding: "8px", minWidth: "320px" }}
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
        <span>Estado: {connected ? "Conectado" : "Desconectado"}</span>
        {updatedAt && <span style={{ color: "#666" }}>Ultima actualizacion: {updatedAt}</span>}
      </div>

      {lastError && <p style={{ color: "crimson" }}>{lastError}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        <DashboardCard title="Bateria">
          <BigValue value={telemetry?.battery ? `${telemetry.battery.percentage}%` : "--"} />
          <SmallValue label="Voltaje" value={telemetry?.battery ? `${telemetry.battery.voltageV.toFixed(2)} V` : "--"} />
        </DashboardCard>

        <DashboardCard title="Posicion">
          <SmallValue label="Latitud" value={telemetry?.position ? telemetry.position.latitude.toFixed(6) : "--"} />
          <SmallValue label="Longitud" value={telemetry?.position ? telemetry.position.longitude.toFixed(6) : "--"} />
          <SmallValue label="Altitud relativa" value={telemetry?.position ? `${telemetry.position.relativeAltitude.toFixed(1)} m` : "--"} />
          <SmallValue label="Altitud absoluta" value={telemetry?.position ? `${telemetry.position.absoluteAltitude.toFixed(1)} m` : "--"} />
        </DashboardCard>

        <DashboardCard title="Velocidad">
          <SmallValue label="Horizontal" value={telemetry?.velocity ? `${telemetry.velocity.groundHorizontalSpeedMs.toFixed(1)} m/s` : "--"} />
          <SmallValue label="Vertical" value={telemetry?.velocity ? `${telemetry.velocity.groundVerticalSpeedMs.toFixed(1)} m/s` : "--"} />
          <SmallValue label="Rumbo" value={telemetry?.velocity ? `${telemetry.velocity.headingDegree.toFixed(0)}°` : "--"} />
        </DashboardCard>

        <DashboardCard title="GPS">
          <SmallValue label="Fix" value={telemetry?.gps?.fixType ?? "--"} />
          <SmallValue label="Satelites" value={telemetry?.gps ? String(telemetry.gps.satellites) : "--"} />
          <SmallValue label="HDOP" value={telemetry?.gps ? telemetry.gps.hdop.toFixed(2) : "--"} />
          <SmallValue label="VDOP" value={telemetry?.gps ? telemetry.gps.vdop.toFixed(2) : "--"} />
        </DashboardCard>

        <DashboardCard title="Vuelo">
          <SmallValue label="Modo" value={telemetry?.flightMode ?? "--"} />
          <SmallValue label="Waypoint actual" value={telemetry?.currentWaypoint != null ? String(telemetry.currentWaypoint) : "--"} />
          <SmallValue label="Timestamp" value={telemetry ? new Date(telemetry.timestamp).toLocaleTimeString() : "--"} />
        </DashboardCard>

        <DashboardCard title="Ultimo evento de estado">
          <SmallValue label="Evento" value={status?.event ?? "--"} />
          <SmallValue label="Accion" value={status?.action ?? "--"} />
          <SmallValue label="Bateria" value={status ? `${status.batteryPercentage}%` : "--"} />
          <SmallValue label="Timestamp" value={status ? new Date(status.timestamp).toLocaleTimeString() : "--"} />
        </DashboardCard>
      </div>
    </section>
  );
}

function DashboardCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: "#555" }}>{title}</h3>
      {children}
    </div>
  );
}

function BigValue({ value }: { value: string }) {
  return <strong style={{ fontSize: "28px" }}>{value}</strong>;
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
      <span style={{ color: "#666" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
