import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Route,
  Trash2
} from "lucide-react";
import type {
  FlightRecordingDetail,
  FlightRecordingSummary,
  GeneratedFlightPlan,
  SensitivityLevel,
  WaypointAction
} from "../api/planBuilder";
import {
  confirmFlightPlan,
  deletePlanWaypoint,
  generateFlightPlanDraft,
  getFlightRecording,
  getFlightRecordings
} from "../api/planBuilder";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { PlanDraftMap } from "../components/PlanDraftMap";
import { AppTopActions } from "../components/AppTopActions";
import { FieldError } from "../components/FieldError";
import { getNavigateMovementKind, NAVIGATE_MOVEMENT_LABELS } from "../utils/waypointMovement";

type WizardStep = "recorrido" | "sensibilidad" | "revision" | "confirmado";

const STEP_ORDER: WizardStep[] = ["recorrido", "sensibilidad", "revision", "confirmado"];

const STEP_LABELS: Record<WizardStep, string> = {
  recorrido: "Recorrido real",
  sensibilidad: "Sensibilidad",
  revision: "Revisión y ajuste",
  confirmado: "Confirmación"
};

const SENSITIVITY_OPTIONS: Array<{ value: SensitivityLevel; title: string; description: string }> = [
  {
    value: "LOW",
    title: "Baja",
    description: "Ruta simplificada, con menos waypoints. Ideal para recorridos largos o repetitivos."
  },
  {
    value: "MEDIUM",
    title: "Media",
    description: "Balance entre fidelidad al recorrido y cantidad de waypoints. Recomendado para la mayoría de los casos."
  },
  {
    value: "HIGH",
    title: "Alta",
    description: "Sigue el recorrido real con mayor detalle. Genera más waypoints y tramos más cortos."
  }
];

const ACTION_LABELS: Record<WaypointAction, string> = {
  TAKEOFF: "Despegue",
  NAVIGATE: "Navegación",
  STOP: "Parada",
  LAND: "Aterrizaje"
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export function GenerarPlanVueloView({
  onBack,
  onPlanConfirmed
}: {
  onBack: () => void;
  onPlanConfirmed: (idFlightPlan: number) => void;
}) {
  const [step, setStep] = useState<WizardStep>("recorrido");

  const [recordings, setRecordings] = useState<FlightRecordingSummary[] | null>(null);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);

  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
  const [recordingDetail, setRecordingDetail] = useState<FlightRecordingDetail | null>(null);
  const [recordingDetailLoading, setRecordingDetailLoading] = useState(false);
  const [recordingDetailError, setRecordingDetailError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>("MEDIUM");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [plan, setPlan] = useState<GeneratedFlightPlan | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [deletingSequence, setDeletingSequence] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<{ sequence: number; message: string } | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    getFlightRecordings()
      .then(setRecordings)
      .catch((error: unknown) => setRecordingsError(error instanceof Error ? error.message : "No se pudieron cargar los recorridos."));
  }, []);

  const handleSelectRecording = (idFlightRecording: number) => {
    setSelectedRecordingId(idFlightRecording);
    setRecordingDetail(null);
    setRecordingDetailError(null);
    setRecordingDetailLoading(true);
    getFlightRecording(idFlightRecording)
      .then(setRecordingDetail)
      .catch((error: unknown) => setRecordingDetailError(error instanceof Error ? error.message : "No se pudo cargar el recorrido."))
      .finally(() => setRecordingDetailLoading(false));
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRecordingId) return;

    if (!name.trim()) {
      setNameError("Ingrese un nombre para el plan.");
      return;
    }
    setNameError(null);
    setGenerateError(null);
    setIsGenerating(true);
    try {
      const draft = await generateFlightPlanDraft({
        sourceRecordingId: selectedRecordingId,
        sensitivity,
        name: name.trim(),
        objective: objective.trim()
      });
      setPlan(draft);
      setSelectedSequence(null);
      setStep("revision");
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "No se pudo generar el plan.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteWaypoint = async (sequence: number) => {
    if (!plan) return;
    setDeleteError(null);
    setDeletingSequence(sequence);
    try {
      const updated = await deletePlanWaypoint(plan.idFlightPlan, sequence);
      setPlan(updated);
      if (selectedSequence === sequence) setSelectedSequence(null);
    } catch (error) {
      setDeleteError({ sequence, message: error instanceof Error ? error.message : "No se pudo eliminar el waypoint." });
    } finally {
      setDeletingSequence(null);
    }
  };

  const handleConfirm = async () => {
    if (!plan) return;
    setConfirmError(null);
    setIsConfirming(true);
    try {
      const confirmed = await confirmFlightPlan(plan.idFlightPlan);
      setPlan(confirmed);
      setStep("confirmado");
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "No se pudo confirmar el plan.");
    } finally {
      setIsConfirming(false);
    }
  };

  const orderedRoute = plan ? [...plan.route].sort((a, b) => a.sequence - b.sequence) : [];
  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <section className="missions-dashboard plan-builder-dashboard">
      <header className="missions-topbar">
        <div className="configure-title-row">
          <button className="monitor-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>Generar plan de vuelo</h1>
            <p>A partir de un recorrido manual, generá un plan de vuelo reproducible por el dron.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      <ol className="plan-builder-stepper" aria-label="Pasos">
        {STEP_ORDER.map((item, index) => (
          <li className={index === stepIndex ? "active" : index < stepIndex ? "done" : undefined} key={item}>
            <span className="plan-builder-step-index">{index + 1}</span>
            <span>{STEP_LABELS[item]}</span>
          </li>
        ))}
      </ol>

      {step === "recorrido" && (
        <div className="mission-builder-grid">
          <article className="mission-detail-card mission-builder-map">
            <div className="mission-detail-header">
              <div>
                <h2>{recordingDetail ? `Recorrido #${recordingDetail.idFlightRecording}` : "Elegí un recorrido"}</h2>
                <div className="mission-detail-id">
                  <small>{recordingDetail ? `Dron ${recordingDetail.droneId} · ${recordingDetail.points.length} puntos` : "Seleccioná un recorrido de la lista para previsualizarlo"}</small>
                </div>
              </div>
            </div>

            {recordingDetailError && (
              <p className="mission-empty">
                <AlertCircle size={16} aria-hidden="true" /> {recordingDetailError}
              </p>
            )}
            {recordingDetailLoading && <p className="mission-empty">Cargando recorrido...</p>}
            {!recordingDetailLoading && !recordingDetailError && recordingDetail && (
              <MissionDetailRouteMap
                points={recordingDetail.points.map((point, index) => ({
                  sequence: index,
                  latitude: point.latitude,
                  longitude: point.longitude
                }))}
              />
            )}
            {!recordingDetailLoading && !recordingDetailError && !recordingDetail && (
              <p className="mission-empty">Todavía no elegiste un recorrido.</p>
            )}
          </article>

          <article className="mission-detail-card mission-builder-fields">
            <h3 className="mission-quick-actions-title">Recorridos disponibles</h3>

            {recordingsError && (
              <p className="mission-empty">
                <AlertCircle size={16} aria-hidden="true" /> {recordingsError}
              </p>
            )}
            {recordings === null && !recordingsError && <p className="mission-empty">Cargando recorridos...</p>}
            {recordings !== null && recordings.length === 0 && (
              <p className="mission-empty">No hay recorridos manuales registrados todavía.</p>
            )}

            <div className="plan-builder-recording-list" role="radiogroup" aria-label="Recorridos">
              {(recordings ?? []).map((recording) => (
                <button
                  aria-checked={selectedRecordingId === recording.idFlightRecording}
                  className={selectedRecordingId === recording.idFlightRecording ? "plan-builder-recording-row selected" : "plan-builder-recording-row"}
                  key={recording.idFlightRecording}
                  onClick={() => handleSelectRecording(recording.idFlightRecording)}
                  role="radio"
                  type="button"
                >
                  <strong>Recorrido #{recording.idFlightRecording}</strong>
                  <span>Dron {recording.droneId} · {recording.pointCount} puntos</span>
                  <span>{formatDateTime(recording.recordedFrom)} - {formatDateTime(recording.recordedTo)}</span>
                </button>
              ))}
            </div>

            <div className="form-actions">
              <button
                className="configure-create mission-builder-submit"
                disabled={!recordingDetail}
                onClick={() => setStep("sensibilidad")}
                type="button"
              >
                Continuar
              </button>
            </div>
          </article>
        </div>
      )}

      {step === "sensibilidad" && recordingDetail && (
        <form className="mission-builder-grid" onSubmit={handleGenerate}>
          <article className="mission-detail-card mission-builder-map">
            <div className="mission-detail-header">
              <div>
                <h2>Recorrido #{recordingDetail.idFlightRecording}</h2>
                <div className="mission-detail-id">
                  <small>Dron {recordingDetail.droneId} · {recordingDetail.points.length} puntos</small>
                </div>
              </div>
            </div>
            <MissionDetailRouteMap
              points={recordingDetail.points.map((point, index) => ({
                sequence: index,
                latitude: point.latitude,
                longitude: point.longitude
              }))}
            />
          </article>

          <article className="mission-detail-card mission-builder-fields">
            <h3 className="mission-quick-actions-title">Datos del plan</h3>

            <label>
              <span>
                Nombre del plan <small className="required-inline">*</small>
              </span>
              <input
                aria-invalid={Boolean(nameError)}
                className={nameError ? "field-invalid" : undefined}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Inspección silo norte"
                type="text"
                value={name}
              />
              {nameError && <FieldError message={nameError} />}
            </label>

            <label>
              <span>Objetivo</span>
              <input onChange={(event) => setObjective(event.target.value)} placeholder="Opcional" type="text" value={objective} />
            </label>

            <div className="plan-builder-sensitivity-group">
              <span className="plan-builder-sensitivity-label">Sensibilidad</span>
              {SENSITIVITY_OPTIONS.map((option) => (
                <button
                  aria-checked={sensitivity === option.value}
                  className={sensitivity === option.value ? "flight-plan-option selected" : "flight-plan-option"}
                  key={option.value}
                  onClick={() => setSensitivity(option.value)}
                  role="radio"
                  type="button"
                >
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            {generateError && (
              <p className="mission-empty">
                <AlertCircle size={16} aria-hidden="true" /> {generateError}
              </p>
            )}

            <div className="form-actions plan-builder-actions-row">
              <button className="configure-cancel" onClick={() => setStep("recorrido")} type="button">
                Atrás
              </button>
              <button className="configure-create mission-builder-submit" disabled={isGenerating} type="submit">
                {isGenerating ? "Generando..." : "Generar plan"}
              </button>
            </div>
          </article>
        </form>
      )}

      {step === "revision" && plan && (
        <div className="mission-builder-grid">
          <article className="mission-detail-card mission-builder-map">
            <div className="mission-detail-header">
              <div>
                <h2>{plan.name}</h2>
                <div className="mission-detail-id">
                  <small>{plan.objective || "Sin objetivo"} · Sensibilidad {plan.sensitivity}</small>
                </div>
              </div>
            </div>
            <PlanDraftMap
              onSelectWaypoint={setSelectedSequence}
              route={plan.route}
              selectedSequence={selectedSequence}
              trackPoints={recordingDetail?.points ?? []}
            />
            <p className="map-field-label">
              <Route size={14} aria-hidden="true" /> {orderedRoute.length} waypoints generados. Tocá un pin o una fila para ubicarlo.
            </p>
          </article>

          <article className="mission-detail-card mission-builder-fields">
            <h3 className="mission-quick-actions-title">Waypoints del plan</h3>

            <div className="plan-builder-waypoint-list">
              {orderedRoute.map((waypoint, index) => (
                <div
                  className={selectedSequence === waypoint.sequence ? "plan-builder-waypoint-row selected" : "plan-builder-waypoint-row"}
                  key={waypoint.idPlanWaypoint}
                  onClick={() => setSelectedSequence(waypoint.sequence)}
                >
                  <div className="plan-builder-waypoint-info">
                    <strong>
                      #{waypoint.sequence} ·{" "}
                      {waypoint.action === "NAVIGATE"
                        ? NAVIGATE_MOVEMENT_LABELS[getNavigateMovementKind(waypoint, orderedRoute[index - 1])]
                        : ACTION_LABELS[waypoint.action]}
                    </strong>
                    <span>
                      {waypoint.latitude.toFixed(6)}, {waypoint.longitude.toFixed(6)}
                      {waypoint.stopSeconds > 0 ? ` · ${waypoint.stopSeconds}s de espera` : ""}
                    </span>
                    {deleteError?.sequence === waypoint.sequence && <FieldError message={deleteError.message} />}
                  </div>
                  <button
                    aria-label={`Eliminar waypoint ${waypoint.sequence}`}
                    className="mission-delete-button"
                    disabled={deletingSequence === waypoint.sequence}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteWaypoint(waypoint.sequence);
                    }}
                    title="Eliminar waypoint"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {confirmError && (
              <p className="mission-empty">
                <AlertCircle size={16} aria-hidden="true" /> {confirmError}
              </p>
            )}

            <div className="form-actions plan-builder-actions-row">
              <button className="configure-cancel" onClick={() => setStep("sensibilidad")} type="button">
                <RefreshCw size={14} aria-hidden="true" /> Regenerar
              </button>
              <button className="configure-create mission-builder-submit" disabled={isConfirming} onClick={handleConfirm} type="button">
                {isConfirming ? "Confirmando..." : "Confirmar plan"}
              </button>
            </div>
          </article>
        </div>
      )}

      {step === "confirmado" && plan && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="success-modal" role="dialog">
            <div className="success-icon">
              <CheckCircle2 size={48} aria-hidden="true" />
            </div>
            <h2>Plan confirmado</h2>
            <p>El plan &quot;{plan.name}&quot; quedó confirmado con {orderedRoute.length} waypoints y listo para usarse en una misión.</p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={onBack} type="button">
                Volver
              </button>
              <button className="register-button" onClick={() => onPlanConfirmed(plan.idFlightPlan)} type="button">
                Ir a configurar misión
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
