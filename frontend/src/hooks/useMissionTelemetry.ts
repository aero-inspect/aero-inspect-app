import { useEffect, useRef, useState } from "react";
import type { StatusEvent, TelemetryUpdate } from "../types/telemetry";

// Se suscribe al stream SSE de telemetria de una mision y expone el ultimo
// evento "telemetry" y "status" recibidos. Reconecta automaticamente cuando
// cambia la mision o el token, y cierra la conexion al desmontar.
export function useMissionTelemetry(missionId: string | null | undefined, token: string) {
  const [telemetry, setTelemetry] = useState<TelemetryUpdate | null>(null);
  const [statusEvent, setStatusEvent] = useState<StatusEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setTelemetry(null);
    setStatusEvent(null);

    if (!missionId || !token) return;

    const url = `/api/v1/telemetry/missions/${missionId}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("telemetry", (event) => {
      try {
        setTelemetry(JSON.parse((event as MessageEvent).data));
      } catch {
        setTelemetry(null);
      }
    });

    eventSource.addEventListener("status", (event) => {
      try {
        setStatusEvent(JSON.parse((event as MessageEvent).data));
      } catch {
        setStatusEvent(null);
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
  }, [missionId, token]);

  return { telemetry, statusEvent };
}
