import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  Trash2
} from "lucide-react";
import type {
  FlightRecordingDetail,
  FlightRecordingSummary,
  GeneratedFlightPlan,
  PlannedPhoto,
  SensitivityLevel,
  WaypointAction
} from "../api/planBuilder";
import {
  PITCH_RANGE,
  YAW_RANGE,
  confirmFlightPlan,
  deletePlanWaypoint,
  generateFlightPlanDraft,
  getFlightRecording,
  getFlightRecordings
} from "../api/planBuilder";
import { getAssets } from "../api/client";
import type { BackendAsset } from "../api/types";
import { MarkedPointsMap } from "../components/MarkedPointsMap";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { PlanDraftMap } from "../components/PlanDraftMap";
import { AppTopActions } from "../components/AppTopActions";
import { FieldError } from "../components/FieldError";
import { LoadingState } from "../components/LoadingState";
import { haversineDistanceMeters } from "../utils/geo";
import { getNavigateMovementKind, NAVIGATE_MOVEMENT_LABELS } from "../utils/waypointMovement";

type WizardStep = "recorrido" | "puntos" | "sensibilidad" | "revision" | "confirmado";

const STEP_ORDER: WizardStep[] = ["recorrido", "puntos", "sensibilidad", "revision", "confirmado"];

const STEP_LABELS: Record<WizardStep, string> = {
  recorrido: "Recorrido real",
  puntos: "Puntos y activos",
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

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function GenerarPlanVueloView({
  onBack,
  onPlanConfirmed,
  onStartManualInspection,
  initialRecordingId = null
}: {
  onBack: () => void;
  onPlanConfirmed: (idFlightPlan: number) => void;
  // Volver a volar: el camino de salida cuando todavía no hay ningún recorrido que usar.
  onStartManualInspection?: () => void;
  // Recorrido recién grabado, para entrar al wizard con él ya elegido.
  initialRecordingId?: number | null;
}) {
  // Viniendo de una inspección manual recién terminada, el recorrido ya está elegido: se entra
  // directo a asignarle activos a los puntos marcados.
  const [step, setStep] = useState<WizardStep>(initialRecordingId !== null ? "puntos" : "recorrido");

  const [recordings, setRecordings] = useState<FlightRecordingSummary[] | null>(null);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);

  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
  const [recordingDetail, setRecordingDetail] = useState<FlightRecordingDetail | null>(null);
  const [recordingDetailLoading, setRecordingDetailLoading] = useState(false);
  const [recordingDetailError, setRecordingDetailError] = useState<string | null>(null);

  const [assets, setAssets] = useState<BackendAsset[] | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  // Activo elegido para cada punto marcado, por posición (0 = punto 1). null = sin activo.
  const [markedAssetIds, setMarkedAssetIds] = useState<Array<number | null>>([]);
  const [selectedMarkIndex, setSelectedMarkIndex] = useState<number | null>(null);

  // Fotos planificadas para cada punto marcado, por posición. Sólo tiene sentido en un punto con
  // activo asignado: al sacarle el activo se le vacía la lista.
  const [markedPhotos, setMarkedPhotos] = useState<Array<PlannedPhoto[]>>([]);
  const [photoDrafts, setPhotoDrafts] = useState<Record<number, { pitch: string; yaw: string }>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<number, string | null>>({});

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
    getAssets()
      .then(setAssets)
      .catch((error: unknown) => setAssetsError(error instanceof Error ? error.message : "No se pudieron cargar los activos."));
  }, []);

  useEffect(() => {
    getFlightRecordings()
      .then(setRecordings)
      .catch((error: unknown) => setRecordingsError(error instanceof Error ? error.message : "No se pudieron cargar los recorridos."));
  }, []);

  useEffect(() => {
    if (initialRecordingId !== null) {
      handleSelectRecording(initialRecordingId);
    }
    // Sólo al entrar: después el usuario elige con la lista y no hay que pisarle la selección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecordingId]);

  const handleSelectRecording = (idFlightRecording: number) => {
    setSelectedRecordingId(idFlightRecording);
    setMarkedAssetIds([]);
    setMarkedPhotos([]);
    setPhotoDrafts({});
    setPhotoErrors({});
    setSelectedMarkIndex(null);
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
        objective: objective.trim(),
        markedPointAssetIds: markedPoints.map((_, index) => markedAssetIds[index] ?? null),
        markedPointPhotos: markedPoints.map((_, index) => markedPhotos[index] ?? [])
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

  const handleAssignAsset = (index: number, idAsset: number | null) => {
    setMarkedAssetIds((current) => {
      const next = [...current];
      next[index] = idAsset;
      return next;
    });
    // Sin activo no tiene sentido planificar fotos: se le vacía la lista al punto.
    if (idAsset === null) {
      setMarkedPhotos((current) => {
        if (!current[index]?.length) return current;
        const next = [...current];
        next[index] = [];
        return next;
      });
      setPhotoErrors((current) => ({ ...current, [index]: null }));
    }
  };

  const handleAddPhoto = (index: number) => {
    const draft = photoDrafts[index] ?? { pitch: "", yaw: "" };
    const pitch = Number(draft.pitch);
    const yaw = Number(draft.yaw);

    if (draft.pitch.trim() === "" || draft.yaw.trim() === "" || Number.isNaN(pitch) || Number.isNaN(yaw)) {
      setPhotoErrors((current) => ({ ...current, [index]: "Ingresá un pitch y un yaw." }));
      return;
    }
    if (pitch < PITCH_RANGE.min || pitch > PITCH_RANGE.max) {
      setPhotoErrors((current) => ({
        ...current,
        [index]: `El pitch debe estar entre ${PITCH_RANGE.min} y ${PITCH_RANGE.max}.`
      }));
      return;
    }
    if (yaw < YAW_RANGE.min || yaw > YAW_RANGE.max) {
      setPhotoErrors((current) => ({
        ...current,
        [index]: `El yaw debe estar entre ${YAW_RANGE.min} y ${YAW_RANGE.max}.`
      }));
      return;
    }

    setPhotoErrors((current) => ({ ...current, [index]: null }));
    setMarkedPhotos((current) => {
      const next = [...current];
      next[index] = [...(next[index] ?? []), { pitch, yaw }];
      return next;
    });
    setPhotoDrafts((current) => ({ ...current, [index]: { pitch: "", yaw: "" } }));
  };

  const handleRemovePhoto = (index: number, photoIndex: number) => {
    setMarkedPhotos((current) => {
      const next = [...current];
      next[index] = (next[index] ?? []).filter((_, i) => i !== photoIndex);
      return next;
    });
  };

  const markedPoints = recordingDetail?.points.filter((point) => point.marked) ?? [];
  const assignedAssetIds = new Set(markedAssetIds.filter((idAsset): idAsset is number => idAsset != null));
  const assignedCount = markedPoints.filter((_, index) => markedAssetIds[index] != null).length;
  const assetNameById = new Map((assets ?? []).map((asset) => [asset.idAsset, asset.name]));

  // Los activos de cada punto, del más cercano al más lejano: el que se inspeccionó casi siempre
  // es uno de los primeros.
  const assetsByDistance = (point: { latitude: number; longitude: number }) =>
    (assets ?? [])
      .map((asset) => ({ asset, distance: haversineDistanceMeters(point, asset) }))
      .sort((a, b) => a.distance - b.distance);

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
            {recordingDetailLoading && <LoadingState text="Cargando recorrido..." compact />}
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
            {recordings === null && !recordingsError && <LoadingState text="Cargando recorridos..." compact />}
            {recordings !== null && recordings.length === 0 && (
              <>
                <p className="mission-empty">No hay recorridos manuales registrados todavía.</p>
                {onStartManualInspection && (
                  <button
                    className="configure-create mission-builder-submit manual-recording-button plan-builder-empty-action"
                    onClick={onStartManualInspection}
                    type="button"
                  >
                    <Radio size={16} aria-hidden="true" /> Iniciar inspección manual
                  </button>
                )}
              </>
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
                onClick={() => setStep("puntos")}
                type="button"
              >
                Continuar
              </button>
            </div>
          </article>
        </div>
      )}

      {step === "puntos" && !recordingDetail && (
        <article className="mission-detail-card">
          {recordingDetailError ? (
            <p className="mission-empty">
              <AlertCircle size={16} aria-hidden="true" /> {recordingDetailError}
            </p>
          ) : (
            <LoadingState text="Cargando recorrido..." compact />
          )}
        </article>
      )}

      {step === "puntos" && recordingDetail && (
        <div className="mission-builder-grid">
          <article className="mission-detail-card mission-builder-map">
            <div className="mission-detail-header">
              <div>
                <h2>Recorrido #{recordingDetail.idFlightRecording}</h2>
                <div className="mission-detail-id">
                  <small>
                    {markedPoints.length === 1 ? "1 punto marcado" : `${markedPoints.length} puntos marcados`} · Dron {recordingDetail.droneId}
                  </small>
                </div>
              </div>
            </div>
            <MarkedPointsMap
              assets={assets ?? []}
              assignedAssetIds={assignedAssetIds}
              markedPoints={markedPoints}
              onSelectPoint={setSelectedMarkIndex}
              selectedIndex={selectedMarkIndex}
              trackPoints={recordingDetail.points}
            />
            <p className="map-field-label">
              <MapPin size={14} aria-hidden="true" /> Cada número es un punto que marcaste con el botón del radiocontrol.
            </p>
          </article>

          <article className="mission-detail-card mission-builder-fields">
            <h3 className="mission-quick-actions-title">Activo de cada punto</h3>

            {assetsError && (
              <p className="mission-empty">
                <AlertCircle size={16} aria-hidden="true" /> {assetsError}
              </p>
            )}
            {assets === null && !assetsError && <LoadingState text="Cargando activos..." compact />}

            {markedPoints.length === 0 ? (
              <p className="mission-empty">
                En este recorrido no se marcó ningún punto: el plan no va a tener paradas para inspeccionar.
              </p>
            ) : (
              <>
                <p className="plan-builder-points-hint">
                  Elegí qué activo se inspecciona en cada punto. En la misión vas a poder elegir cuáles de
                  esos activos inspeccionar; en un punto sin activo el dron pasa sin parar.
                </p>
                <div className="plan-builder-waypoint-list">
                  {markedPoints.map((point, index) => (
                    <div
                      className={selectedMarkIndex === index ? "plan-builder-waypoint-row plan-builder-mark-row selected" : "plan-builder-waypoint-row plan-builder-mark-row"}
                      key={`${point.timestamp}-${index}`}
                      onClick={() => setSelectedMarkIndex(index)}
                    >
                      <span className="plan-builder-mark-number">{index + 1}</span>
                      <div className="plan-builder-waypoint-info">
                        <strong>Punto {index + 1}</strong>
                        <span>
                          {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)} · {point.altitude.toFixed(1)} m
                        </span>
                        <select
                          aria-label={`Activo del punto ${index + 1}`}
                          disabled={assets === null}
                          onChange={(event) => handleAssignAsset(index, event.target.value ? Number(event.target.value) : null)}
                          onClick={(event) => event.stopPropagation()}
                          value={markedAssetIds[index] ?? ""}
                        >
                          <option value="">Sin activo</option>
                          {assetsByDistance(point).map(({ asset, distance }) => (
                            <option key={asset.idAsset} value={asset.idAsset}>
                              {asset.name} ({asset.code}) · a {formatDistance(distance)}
                            </option>
                          ))}
                        </select>

                        {markedAssetIds[index] != null && (
                          <div className="plan-builder-photos" onClick={(event) => event.stopPropagation()}>
                            <span className="plan-builder-photos-label">Fotos ({(markedPhotos[index] ?? []).length})</span>

                            {(markedPhotos[index] ?? []).map((photo, photoIndex) => (
                              <div className="plan-builder-photo-row" key={photoIndex}>
                                <span>Pitch {photo.pitch}° · Yaw {photo.yaw}°</span>
                                <button
                                  aria-label={`Eliminar foto ${photoIndex + 1} del punto ${index + 1}`}
                                  className="mission-delete-button"
                                  onClick={() => handleRemovePhoto(index, photoIndex)}
                                  title="Eliminar foto"
                                  type="button"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}

                            <div className="plan-builder-photo-add">
                              <input
                                aria-label={`Pitch de la nueva foto del punto ${index + 1}`}
                                max={PITCH_RANGE.max}
                                min={PITCH_RANGE.min}
                                onChange={(event) =>
                                  setPhotoDrafts((current) => ({
                                    ...current,
                                    [index]: { pitch: event.target.value, yaw: current[index]?.yaw ?? "" }
                                  }))
                                }
                                placeholder="Pitch"
                                type="number"
                                value={photoDrafts[index]?.pitch ?? ""}
                              />
                              <input
                                aria-label={`Yaw de la nueva foto del punto ${index + 1}`}
                                max={YAW_RANGE.max}
                                min={YAW_RANGE.min}
                                onChange={(event) =>
                                  setPhotoDrafts((current) => ({
                                    ...current,
                                    [index]: { pitch: current[index]?.pitch ?? "", yaw: event.target.value }
                                  }))
                                }
                                placeholder="Yaw"
                                type="number"
                                value={photoDrafts[index]?.yaw ?? ""}
                              />
                              <button
                                className="configure-cancel plan-builder-photo-add-button"
                                onClick={() => handleAddPhoto(index)}
                                type="button"
                              >
                                Agregar foto
                              </button>
                            </div>
                            {photoErrors[index] && <FieldError message={photoErrors[index]!} />}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="map-field-label">
                  {assignedCount} de {markedPoints.length} puntos con activo asignado.
                </p>
              </>
            )}

            <div className="form-actions plan-builder-actions-row">
              <button className="configure-cancel" onClick={() => setStep("recorrido")} type="button">
                Atrás
              </button>
              <button className="configure-create mission-builder-submit" onClick={() => setStep("sensibilidad")} type="button">
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
              <button className="configure-cancel" onClick={() => setStep("puntos")} type="button">
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
                    {waypoint.idAsset != null && (
                      <span className="plan-builder-waypoint-asset">
                        {waypoint.name ? `${waypoint.name} · ` : ""}{assetNameById.get(waypoint.idAsset) ?? `Activo #${waypoint.idAsset}`}
                      </span>
                    )}
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
