import { useEffect, useRef, useState } from "react";
import type { StatusEvent, TelemetryUpdate } from "../types/telemetry";

// El backend manda "connected" al abrir la conexión y "heartbeat" cada 15 s. Si no llega nada
// durante este tiempo (dos latidos perdidos más margen), la conexión se da por muerta.
const SILENCE_TIMEOUT_MS = 40_000;
const WATCHDOG_INTERVAL_MS = 5_000;
// Pausa mínima entre reconexiones propias, para no martillar al backend si rechaza el pedido
// (por ejemplo, un 401 con la sesión vencida).
const MIN_RECONNECT_INTERVAL_MS = 15_000;

const LOG_PREFIX = "[telemetria]";

// Se suscribe al stream SSE de telemetria de una mision y expone el ultimo
// evento "telemetry" y "status" recibidos. Reconecta automaticamente cuando
// cambia la mision o el token, y cierra la conexion al desmontar.
//
// EventSource ya reintenta solo cuando se entera de un corte, pero no se entera de una conexion
// que murio en silencio (sigue "abierta" sin recibir nada), y deja de reintentar para siempre si
// el backend contesta con error. Para esos dos casos, un watchdog la cierra y abre una nueva.
// Cada apertura, error y reconexion queda en la consola con el prefijo [telemetria].
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
    let eventSource: EventSource | null = null;
    let lastActivityAt = Date.now();
    let connectedAt = Date.now();
    let attempt = 0;
    const touch = () => {
      lastActivityAt = Date.now();
    };

    const connect = (reason: string | null) => {
      eventSource?.close();
      attempt += 1;
      if (reason) console.warn(`${LOG_PREFIX} reconectando la misión ${missionId} (intento ${attempt}): ${reason}`);
      const source = new EventSource(url);
      eventSource = source;
      eventSourceRef.current = source;
      connectedAt = Date.now();
      lastActivityAt = connectedAt;

      source.onopen = () => {
        touch();
        console.info(`${LOG_PREFIX} conexión abierta para la misión ${missionId}`);
      };

      source.addEventListener("connected", touch);
      source.addEventListener("heartbeat", touch);

      source.addEventListener("telemetry", (event) => {
        touch();
        try {
          const next=JSON.parse((event as MessageEvent).data) as TelemetryUpdate;
          if(next.missionId!==missionId||!Number.isFinite(Date.parse(next.timestamp)))return;
          setTelemetry(previous=>previous&&Date.parse(previous.timestamp)>=Date.parse(next.timestamp)?previous:next);
        } catch {
          // Preserve the last valid sample when a malformed event is received.
        }
      });

      source.addEventListener("status", (event) => {
        touch();
        try {
          setStatusEvent(JSON.parse((event as MessageEvent).data));
        } catch {
          setStatusEvent(null);
        }
      });

      // EventSource retries transient failures itself; closing here disables reconnection.
      source.onerror = () => {
        const state = source.readyState === EventSource.CLOSED ? "cerrada, sin reintento del navegador" : "el navegador reintenta";
        console.warn(`${LOG_PREFIX} error en la conexión de la misión ${missionId} (${state})`);
      };
    };

    connect(null);

    const watchdog = window.setInterval(() => {
      if (!eventSource) return;
      const now = Date.now();
      if (now - connectedAt < MIN_RECONNECT_INTERVAL_MS) return;
      if (eventSource.readyState === EventSource.CLOSED) {
        connect("el navegador cerró la conexión y no va a reintentar");
      } else if (now - lastActivityAt > SILENCE_TIMEOUT_MS) {
        connect(`sin datos ni latidos hace ${Math.round((now - lastActivityAt) / 1000)} s`);
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      window.clearInterval(watchdog);
      eventSource?.close();
      eventSourceRef.current = null;
    };
  }, [missionId, token]);

  return { telemetry, statusEvent };
}
