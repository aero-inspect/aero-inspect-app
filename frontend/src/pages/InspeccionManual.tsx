// Inspección manual (Flujo 0, paso previo a "Generar plan de vuelo"): el usuario le avisa al
// dron que va a volarlo a mano y que grabe el recorrido. El dron cierra la grabación solo al
// aterrizar y sube el track; por eso acá no hay que esperar a nada para irse de la pantalla.
import { useEffect, useState } from "react";
import { ArrowLeft, AlertCircle, CheckCircle2, CircleDot, Radio, Square } from "lucide-react";

import { getDrones, getDroneStatuses } from "../api/client";
import type { BackendDrone, BackendDroneStatus } from "../api/types";
import { getFlightRecordings, startManualRecording, stopManualRecording } from "../api/planBuilder";
import type { FlightRecordingSummary } from "../api/planBuilder";
import { AppTopActions } from "../components/AppTopActions";
import { LoadingState } from "../components/LoadingState";

// El dron publica su heartbeat cada 5 s; sondear más seguido no trae nada nuevo.
const STATUS_POLL_INTERVAL_MS = 5000;

type RecordingPhase = "idle" | "starting" | "recording" | "stopping";

const STATUS_LABELS: Record<string, string> = {
  IDLE: "En tierra",
  ARMED: "Armado",
  IN_MISSION: "En misión",
  ERROR: "Sin enlace"
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export function InspeccionManualView({
  onBack,
  onGeneratePlan
}: {
  onBack: () => void;
  onGeneratePlan: (idFlightRecording: number) => void;
}) {
  const [drones, setDrones] = useState<BackendDrone[] | null>(null);
  const [dronesError, setDronesError] = useState<string | null>(null);
  const [selectedIdDrone, setSelectedIdDrone] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<BackendDroneStatus[]>([]);
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [commandError, setCommandError] = useState<string | null>(null);

  // El recorrido recién existe cuando el dron lo sube, al aterrizar: se detecta mirando si
  // apareció uno nuevo en la lista, que es la única señal que tiene el frontend hoy.
  const [knownRecordingIds, setKnownRecordingIds] = useState<number[] | null>(null);
  const [newRecording, setNewRecording] = useState<FlightRecordingSummary | null>(null);

  useEffect(() => {
    getDrones()
      .then((list) => {
        setDrones(list);
        if (list.length === 1) {
          setSelectedIdDrone(list[0].idDrone);
        }
      })
      .catch((error: unknown) =>
        setDronesError(error instanceof Error ? error.message : "No se pudieron cargar los drones.")
      );

    getFlightRecordings()
      .then((list) => setKnownRecordingIds(list.map((recording) => recording.idFlightRecording)))
      .catch(() => setKnownRecordingIds([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      getDroneStatuses()
        .then((list) => {
          if (!cancelled) setStatuses(list);
        })
        .catch(() => {
          // Un sondeo perdido no es un error que valga la pena mostrar: el siguiente lo arregla.
        });
    };

    poll();
    const intervalId = window.setInterval(poll, STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Mientras se graba, se mira si ya apareció el recorrido subido para ofrecer generar el plan.
  useEffect(() => {
    if (phase !== "recording" || knownRecordingIds === null) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      getFlightRecordings()
        .then((list) => {
          if (cancelled) return;
          const appeared = list.find(
            (recording) => !knownRecordingIds.includes(recording.idFlightRecording)
          );
          if (appeared) {
            setNewRecording(appeared);
            setPhase("idle");
          }
        })
        .catch(() => undefined);
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [phase, knownRecordingIds]);

  const selectedDrone = drones?.find((drone) => drone.idDrone === selectedIdDrone) ?? null;
  const selectedStatus = selectedDrone
    ? statuses.find((status) => status.droneId === selectedDrone.droneId) ?? null
    : null;

  const handleStart = async () => {
    if (!selectedIdDrone) return;
    setCommandError(null);
    setNewRecording(null);
    setPhase("starting");
    try {
      await startManualRecording(selectedIdDrone);
      setPhase("recording");
    } catch (error: unknown) {
      setPhase("idle");
      setCommandError(
        error instanceof Error ? error.message : "No se pudo arrancar la inspección manual."
      );
    }
  };

  const handleStop = async () => {
    if (!selectedIdDrone) return;
    setCommandError(null);
    setPhase("stopping");
    try {
      await stopManualRecording(selectedIdDrone);
      setPhase("idle");
    } catch (error: unknown) {
      setPhase("recording");
      setCommandError(
        error instanceof Error ? error.message : "No se pudo cortar la inspección manual."
      );
    }
  };

  const isRecording = phase === "recording" || phase === "stopping";
  const isBusy = phase === "starting" || phase === "stopping";

  return (
    <section className="missions-dashboard plan-builder-dashboard">
      <header className="missions-topbar">
        <div className="configure-title-row">
          <button className="monitor-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>Inspección manual</h1>
            <p>
              Volá el dron con la transmisora y el módulo graba el recorrido. Al aterrizar lo sube
              solo, y con eso se genera un plan de vuelo reproducible.
            </p>
          </div>
        </div>
        <AppTopActions />
      </header>

      <div className="mission-builder-grid">
        <article className="mission-detail-card mission-builder-fields">
          <h3 className="mission-quick-actions-title">Dron</h3>

          {dronesError && (
            <p className="mission-empty">
              <AlertCircle size={16} aria-hidden="true" /> {dronesError}
            </p>
          )}
          {drones === null && !dronesError && <LoadingState text="Cargando drones..." compact />}
          {drones !== null && drones.length === 0 && (
            <p className="mission-empty">No hay drones registrados todavía.</p>
          )}

          <div className="plan-builder-recording-list" role="radiogroup" aria-label="Drones">
            {(drones ?? []).map((drone) => {
              const status = statuses.find((item) => item.droneId === drone.droneId) ?? null;
              return (
                <button
                  aria-checked={selectedIdDrone === drone.idDrone}
                  className={
                    selectedIdDrone === drone.idDrone
                      ? "plan-builder-recording-row selected"
                      : "plan-builder-recording-row"
                  }
                  disabled={isRecording}
                  key={drone.idDrone}
                  onClick={() => setSelectedIdDrone(drone.idDrone)}
                  role="radio"
                  type="button"
                >
                  <strong>{drone.name}</strong>
                  <small>
                    {drone.droneId}
                    {status?.status ? ` · ${STATUS_LABELS[status.status] ?? status.status}` : " · sin señal"}
                    {status?.battery?.percentage != null
                      ? ` · ${Math.round(status.battery.percentage)}% batería`
                      : ""}
                  </small>
                </button>
              );
            })}
          </div>
        </article>

        <article className="mission-detail-card manual-recording-card">
          <div className="mission-detail-header">
            <div>
              <h2>{isRecording ? "Grabando el recorrido" : "Listo para grabar"}</h2>
              <div className="mission-detail-id">
                <small>
                  {selectedDrone
                    ? `${selectedDrone.name} · ${selectedStatus?.status ? STATUS_LABELS[selectedStatus.status] ?? selectedStatus.status : "sin señal"}`
                    : "Elegí un dron para empezar"}
                </small>
              </div>
            </div>
            <span className={isRecording ? "manual-recording-dot recording" : "manual-recording-dot"}>
              {isRecording ? <CircleDot size={18} /> : <Radio size={18} />}
            </span>
          </div>

          <ol className="manual-recording-steps">
            <li>Arrancá la grabación desde acá, con el dron todavía en tierra.</li>
            <li>Despegá y volá el recorrido con la transmisora, como lo harías normalmente.</li>
            <li>
              Marcá con el botón del radiocontrol cada punto que quieras inspeccionar: el plan
              para el dron ahí, y saca la foto. Frenar sin marcar no genera una parada.
            </li>
            <li>Aterrizá. El dron cierra la grabación y sube el recorrido solo.</li>
          </ol>

          <p className="manual-recording-hint">
            Este botón es opcional: si el piloto marca un punto con el radiocontrol en pleno
            vuelo, el dron arranca la grabación solo.
          </p>

          {commandError && (
            <p className="mission-empty">
              <AlertCircle size={16} aria-hidden="true" /> {commandError}
            </p>
          )}

          {newRecording && (
            <div className="manual-recording-result">
              <p>
                <CheckCircle2 size={16} aria-hidden="true" /> Recorrido #{newRecording.idFlightRecording}{" "}
                subido: {newRecording.pointCount} puntos, {formatDateTime(newRecording.recordedFrom)}.
              </p>
              <button
                className="configure-submit"
                onClick={() => onGeneratePlan(newRecording.idFlightRecording)}
                type="button"
              >
                Generar plan con este recorrido
              </button>
            </div>
          )}

          <div className="manual-recording-actions">
            {!isRecording ? (
              <button
                className="configure-submit"
                disabled={!selectedIdDrone || isBusy}
                onClick={handleStart}
                type="button"
              >
                <Radio size={16} aria-hidden="true" />
                {phase === "starting" ? "Arrancando..." : "Iniciar inspección manual"}
              </button>
            ) : (
              <button
                className="configure-cancel"
                disabled={isBusy}
                onClick={handleStop}
                type="button"
              >
                <Square size={16} aria-hidden="true" />
                {phase === "stopping" ? "Cortando..." : "Cortar grabación"}
              </button>
            )}
          </div>

          {isRecording && (
            <p className="manual-recording-hint">
              No hace falta cortarla a mano: el dron cierra el recorrido cuando aterriza. Usá
              &quot;Cortar grabación&quot; sólo para descartar este vuelo.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
