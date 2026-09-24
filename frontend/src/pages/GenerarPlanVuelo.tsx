import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Radio,
  Route,
  Trash2
} from "lucide-react";
import type {
  FlightRecordingDetail,
  FlightRecordingSummary,
  GeneratedFlightPlan,
  WaypointAction
} from "../api/planBuilder";
import {
  PITCH_RANGE,
  YAW_RANGE,
  confirmFlightPlan,
  deletePlanWaypoint,
  generateFlightPlanDraft,
  getFlightRecording,
  getFlightRecordings,
  insertPlanWaypoint,
  movePlanWaypoint,
  updatePlanWaypoint,
  updatePlanWaypointCameraAngles,
  updatePlanWaypointStopSeconds,
  updatePlanWaypointType
} from "../api/planBuilder";
import { getAssets } from "../api/client";
import type { BackendAsset } from "../api/types";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { PlanDraftMap } from "../components/PlanDraftMap";
import { AppTopActions } from "../components/AppTopActions";
import { FieldError } from "../components/FieldError";
import { LoadingState } from "../components/LoadingState";
import { violatesAxisConstraint } from "../utils/axisConstraint";
import { estimateFlightDurationSeconds, haversineDistanceMeters, totalRouteDistanceMeters } from "../utils/geo";
import { getNavigateMovementKind, NAVIGATE_MOVEMENT_LABELS } from "../utils/waypointMovement";

type WizardStep = "recorrido" | "plan" | "confirmado";

const STEP_ORDER: WizardStep[] = ["recorrido", "plan", "confirmado"];

const STEP_LABELS: Record<WizardStep, string> = {
  recorrido: "Recorrido y datos",
  plan: "Ajustar ruta",
  confirmado: "Confirmación"
};

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

function formatDuration(seconds: number) {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
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
  const [step, setStep] = useState<WizardStep>("recorrido");

  const [recordings, setRecordings] = useState<FlightRecordingSummary[] | null>(null);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);

  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
  const [recordingDetail, setRecordingDetail] = useState<FlightRecordingDetail | null>(null);
  const [recordingDetailLoading, setRecordingDetailLoading] = useState(false);
  const [recordingDetailError, setRecordingDetailError] = useState<string | null>(null);

  const [assets, setAssets] = useState<BackendAsset[] | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [plan, setPlan] = useState<GeneratedFlightPlan | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [deletingSequence, setDeletingSequence] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<{ sequence: number; message: string } | null>(null);

  // Edición manual de la coordenada del waypoint seleccionado. x/y y z se guardan por separado:
  // tocar uno nunca manda el otro.
  const [coordDraft, setCoordDraft] = useState<{ latitude: string; longitude: string; altitude: string }>({
    latitude: "",
    longitude: "",
    altitude: ""
  });
  const [isSavingCoords, setIsSavingCoords] = useState<"xy" | "z" | "stop" | null>(null);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [stopSecondsDraft, setStopSecondsDraft] = useState("");

  // Tipo del waypoint seleccionado: null = como está; "interes" mientras se elige el activo antes
  // de confirmarlo (recién ahí se manda al backend).
  const [pendingPointType, setPendingPointType] = useState<"paso" | "interes" | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  // ABM de fotos de un punto de interés (tanto uno con activo asignado ahora como uno que ya lo
  // tenía).
  const [planPhotoDraft, setPlanPhotoDraft] = useState({ pitch: "", yaw: "" });
  const [planPhotoError, setPlanPhotoError] = useState<string | null>(null);
  const [isSavingPlanPhotos, setIsSavingPlanPhotos] = useState(false);

  // Reordenar un waypoint intermedio un lugar hacia arriba/abajo.
  const [movingSequence, setMovingSequence] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<{ sequence: number; message: string } | null>(null);

  // Insertar un punto nuevo justo después de un waypoint (paso o interés), a mano.
  const [insertingAfterSequence, setInsertingAfterSequence] = useState<number | null>(null);
  const [insertDraft, setInsertDraft] = useState<{
    latitude: string;
    longitude: string;
    altitude: string;
    type: "paso" | "interes";
    idAsset: number | null;
  }>({ latitude: "", longitude: "", altitude: "", type: "paso", idAsset: null });
  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);

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

  const orderedRoute = plan ? [...plan.route].sort((a, b) => a.sequence - b.sequence) : [];
  const selectedWaypoint = orderedRoute.find((waypoint) => waypoint.sequence === selectedSequence) ?? null;
  const assetNameById = new Map((assets ?? []).map((asset) => [asset.idAsset, asset.name]));

  // Sincroniza los inputs de edición con el waypoint recién seleccionado (o los limpia si no hay
  // ninguno elegido).
  useEffect(() => {
    if (!selectedWaypoint) {
      setCoordDraft({ latitude: "", longitude: "", altitude: "" });
      setStopSecondsDraft("");
      return;
    }
    setCoordDraft({
      latitude: String(selectedWaypoint.latitude),
      longitude: String(selectedWaypoint.longitude),
      altitude: String(selectedWaypoint.altitude)
    });
    setStopSecondsDraft(String(selectedWaypoint.stopSeconds));
    setCoordError(null);
    setPendingPointType(null);
    setTypeError(null);
    setPlanPhotoDraft({ pitch: "", yaw: "" });
    setPlanPhotoError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSequence]);

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
      // Todos los puntos marcados arrancan como "punto de paso": el tipo y el activo se eligen
      // después, sobre la ruta ya armada, en "Ajustar ruta".
      const draft = await generateFlightPlanDraft({
        sourceRecordingId: selectedRecordingId,
        name: name.trim(),
        objective: objective.trim(),
        markedPointAssetIds: [],
        markedPointPhotos: []
      });
      setPlan(draft);
      setSelectedSequence(null);
      setStep("plan");
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

  // Mover el marker en el mapa (drag) sólo cambia x/y: la altitud viaja tal cual estaba. Antes de
  // mandarlo al backend se chequea localmente contra los vecinos: si va a quedar en diagonal, se
  // avisa al toque (sin ida y vuelta al server) y el marker vuelve solo a su lugar, porque el
  // `position` que ve el mapa sigue siendo el del plan sin cambios.
  const handleMoveWaypoint = async (sequence: number, latitude: number, longitude: number) => {
    if (!plan) return;
    const index = orderedRoute.findIndex((item) => item.sequence === sequence);
    if (index < 0) return;
    const waypoint = orderedRoute[index];
    const moved = { latitude, longitude, altitude: waypoint.altitude };
    const previous = orderedRoute[index - 1];
    const next = orderedRoute[index + 1];

    if ((previous && violatesAxisConstraint(previous, moved)) || (next && violatesAxisConstraint(moved, next))) {
      setCoordError("Ese punto quedaría conectado en diagonal con un vecino: no se puede mover ahí.");
      return;
    }

    setCoordError(null);
    try {
      const updated = await updatePlanWaypoint(plan.idFlightPlan, sequence, moved);
      setPlan(updated);
      // Si el punto arrastrado es el seleccionado, los inputs tienen que reflejar la nueva
      // posición: si no, quedarían mostrando la coordenada vieja hasta volver a seleccionarlo.
      if (selectedSequence === sequence) {
        setCoordDraft((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }));
      }
    } catch (error) {
      setCoordError(error instanceof Error ? error.message : "No se pudo mover el waypoint.");
    }
  };

  const handleSaveXY = async () => {
    if (!plan || !selectedWaypoint) return;
    const latitude = Number(coordDraft.latitude);
    const longitude = Number(coordDraft.longitude);
    if (coordDraft.latitude.trim() === "" || coordDraft.longitude.trim() === "" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setCoordError("Ingresá una latitud y una longitud válidas.");
      return;
    }
    setCoordError(null);
    setIsSavingCoords("xy");
    try {
      // z no se toca: viaja el valor que ya tenía el waypoint, no lo que haya en el input de altitud.
      const updated = await updatePlanWaypoint(plan.idFlightPlan, selectedWaypoint.sequence, {
        latitude,
        longitude,
        altitude: selectedWaypoint.altitude
      });
      setPlan(updated);
    } catch (error) {
      setCoordError(error instanceof Error ? error.message : "No se pudo guardar la posición.");
    } finally {
      setIsSavingCoords(null);
    }
  };

  const handleSaveAltitude = async () => {
    if (!plan || !selectedWaypoint) return;
    const altitude = Number(coordDraft.altitude);
    if (coordDraft.altitude.trim() === "" || Number.isNaN(altitude)) {
      setCoordError("Ingresá una altitud válida.");
      return;
    }
    setCoordError(null);
    setIsSavingCoords("z");
    try {
      // x/y no se tocan: viaja lo que ya tenía el waypoint, no lo que haya en los inputs de posición.
      const updated = await updatePlanWaypoint(plan.idFlightPlan, selectedWaypoint.sequence, {
        latitude: selectedWaypoint.latitude,
        longitude: selectedWaypoint.longitude,
        altitude
      });
      setPlan(updated);
    } catch (error) {
      setCoordError(error instanceof Error ? error.message : "No se pudo guardar la altitud.");
    } finally {
      setIsSavingCoords(null);
    }
  };

  const handleSaveStopSeconds = async () => {
    if (!plan || !selectedWaypoint) return;
    const stopSeconds = Number(stopSecondsDraft);
    if (stopSecondsDraft.trim() === "" || Number.isNaN(stopSeconds) || !Number.isInteger(stopSeconds) || stopSeconds < 1) {
      setCoordError("Ingresá un tiempo de espera válido (segundos enteros, mínimo 1).");
      return;
    }
    setCoordError(null);
    setIsSavingCoords("stop");
    try {
      const updated = await updatePlanWaypointStopSeconds(plan.idFlightPlan, selectedWaypoint.sequence, stopSeconds);
      setPlan(updated);
    } catch (error) {
      setCoordError(error instanceof Error ? error.message : "No se pudo guardar el tiempo de espera.");
    } finally {
      setIsSavingCoords(null);
    }
  };

  // Pasar a "punto de paso" se manda al toque (no hace falta elegir nada más). Pasar a "punto de
  // interés" sólo abre el combo de activos acá: recién se manda cuando se elige uno.
  const handleClickPointType = async (type: "paso" | "interes") => {
    if (type === "interes") {
      setPendingPointType("interes");
      setTypeError(null);
      return;
    }
    if (!plan || !selectedWaypoint) return;
    setTypeError(null);
    setIsSavingType(true);
    try {
      const updated = await updatePlanWaypointType(plan.idFlightPlan, selectedWaypoint.sequence, null);
      setPlan(updated);
      setPendingPointType(null);
    } catch (error) {
      setTypeError(error instanceof Error ? error.message : "No se pudo cambiar el tipo de punto.");
    } finally {
      setIsSavingType(false);
    }
  };

  const handleAssignWaypointAsset = async (idAsset: number | null) => {
    if (!plan || !selectedWaypoint || idAsset == null) return;
    setTypeError(null);
    setIsSavingType(true);
    try {
      const updated = await updatePlanWaypointType(plan.idFlightPlan, selectedWaypoint.sequence, idAsset);
      setPlan(updated);
      setPendingPointType(null);
    } catch (error) {
      setTypeError(error instanceof Error ? error.message : "No se pudo asignar el activo.");
    } finally {
      setIsSavingType(false);
    }
  };

  const handleAddPlanPhoto = async () => {
    if (!plan || !selectedWaypoint) return;
    const pitch = Number(planPhotoDraft.pitch);
    const yaw = Number(planPhotoDraft.yaw);
    if (planPhotoDraft.pitch.trim() === "" || planPhotoDraft.yaw.trim() === "" || Number.isNaN(pitch) || Number.isNaN(yaw)) {
      setPlanPhotoError("Ingresá un pitch y un yaw.");
      return;
    }
    if (pitch < PITCH_RANGE.min || pitch > PITCH_RANGE.max) {
      setPlanPhotoError(`El pitch debe estar entre ${PITCH_RANGE.min} y ${PITCH_RANGE.max}.`);
      return;
    }
    if (yaw < YAW_RANGE.min || yaw > YAW_RANGE.max) {
      setPlanPhotoError(`El yaw debe estar entre ${YAW_RANGE.min} y ${YAW_RANGE.max}.`);
      return;
    }
    setPlanPhotoError(null);
    setIsSavingPlanPhotos(true);
    try {
      const nextPhotos = [...(selectedWaypoint.cameraAngles ?? []), { pitch, yaw }];
      const updated = await updatePlanWaypointCameraAngles(plan.idFlightPlan, selectedWaypoint.sequence, nextPhotos);
      setPlan(updated);
      setPlanPhotoDraft({ pitch: "", yaw: "" });
    } catch (error) {
      setPlanPhotoError(error instanceof Error ? error.message : "No se pudo agregar la foto.");
    } finally {
      setIsSavingPlanPhotos(false);
    }
  };

  const handleRemovePlanPhoto = async (photoIndex: number) => {
    if (!plan || !selectedWaypoint) return;
    setPlanPhotoError(null);
    setIsSavingPlanPhotos(true);
    try {
      const nextPhotos = (selectedWaypoint.cameraAngles ?? []).filter((_, i) => i !== photoIndex);
      const updated = await updatePlanWaypointCameraAngles(plan.idFlightPlan, selectedWaypoint.sequence, nextPhotos);
      setPlan(updated);
    } catch (error) {
      setPlanPhotoError(error instanceof Error ? error.message : "No se pudo eliminar la foto.");
    } finally {
      setIsSavingPlanPhotos(false);
    }
  };

  // Reordena un waypoint intermedio un lugar hacia arriba/abajo: cada punto conserva su propia
  // coordenada, sólo cambia el orden en que el dron los visita.
  const handleReorder = async (sequence: number, direction: "UP" | "DOWN") => {
    if (!plan) return;
    setMoveError(null);
    setMovingSequence(sequence);
    try {
      const updated = await movePlanWaypoint(plan.idFlightPlan, sequence, direction);
      setPlan(updated);
    } catch (error) {
      setMoveError({ sequence, message: error instanceof Error ? error.message : "No se pudo reordenar el waypoint." });
    } finally {
      setMovingSequence(null);
    }
  };

  const handleOpenInsert = (afterSequence: number) => {
    if (insertingAfterSequence === afterSequence) {
      setInsertingAfterSequence(null);
      return;
    }
    const index = orderedRoute.findIndex((item) => item.sequence === afterSequence);
    const from = orderedRoute[index];
    const to = orderedRoute[index + 1];
    // Por default, el punto nuevo va a mitad de camino entre los dos que va a separar: un punto
    // de partida razonable para que el usuario lo termine de ajustar.
    setInsertDraft({
      latitude: String(to ? (from.latitude + to.latitude) / 2 : from.latitude),
      longitude: String(to ? (from.longitude + to.longitude) / 2 : from.longitude),
      altitude: String(to ? (from.altitude + to.altitude) / 2 : from.altitude),
      type: "paso",
      idAsset: null
    });
    setInsertError(null);
    setInsertingAfterSequence(afterSequence);
  };

  const handleSubmitInsert = async () => {
    if (!plan || insertingAfterSequence == null) return;
    const latitude = Number(insertDraft.latitude);
    const longitude = Number(insertDraft.longitude);
    const altitude = Number(insertDraft.altitude);
    if ([insertDraft.latitude, insertDraft.longitude, insertDraft.altitude].some((value) => value.trim() === "")
      || [latitude, longitude, altitude].some((value) => Number.isNaN(value))) {
      setInsertError("Completá latitud, longitud y altitud.");
      return;
    }
    if (insertDraft.type === "interes" && insertDraft.idAsset == null) {
      setInsertError("Elegí un activo para el punto de interés.");
      return;
    }
    setInsertError(null);
    setIsInserting(true);
    try {
      const updated = await insertPlanWaypoint(plan.idFlightPlan, {
        afterSequence: insertingAfterSequence,
        latitude,
        longitude,
        altitude,
        idAsset: insertDraft.type === "interes" ? insertDraft.idAsset : null
      });
      setPlan(updated);
      setInsertingAfterSequence(null);
    } catch (error) {
      setInsertError(error instanceof Error ? error.message : "No se pudo insertar el punto.");
    } finally {
      setIsInserting(false);
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

  // Los activos más cercanos primero: el que se quiere inspeccionar casi siempre es uno de ellos.
  const assetsByDistance = (point: { latitude: number; longitude: number }) =>
    (assets ?? [])
      .map((asset) => ({ asset, distance: haversineDistanceMeters(point, asset) }))
      .sort((a, b) => a.distance - b.distance);

  // El activo a resaltar en el mapa: el que se está por elegir en el form de insertar un punto
  // nuevo, o si no el que ya tiene asignado el waypoint seleccionado.
  const highlightedAssetId =
    insertingAfterSequence != null && insertDraft.type === "interes"
      ? insertDraft.idAsset
      : (selectedWaypoint?.idAsset ?? null);

  const hasNegativeAltitude = orderedRoute.some((waypoint) => waypoint.altitude < 0);
  const totalDistanceMeters = totalRouteDistanceMeters(orderedRoute);
  const estimatedDurationSeconds = plan ? estimateFlightDurationSeconds(orderedRoute, plan.cruiseSpeedMs) : 0;
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
        <form onSubmit={handleGenerate}>
          <div className="mission-builder-grid plan-builder-recorrido-grid">
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
              <h3 className="mission-quick-actions-title">Datos del plan</h3>
              <div className="plan-builder-name-fields">
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
              </div>

              <h3 className="mission-quick-actions-title plan-builder-section-title">Recorridos disponibles</h3>

              {recordingsError && (
                <p className="mission-empty">
                  <AlertCircle size={16} aria-hidden="true" /> {recordingsError}
                </p>
              )}
              {recordings === null && !recordingsError && <LoadingState text="Cargando recorridos..." compact />}
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

              {generateError && (
                <p className="mission-empty">
                  <AlertCircle size={16} aria-hidden="true" /> {generateError}
                </p>
              )}

              <div className="form-actions plan-builder-actions-row">
                {onStartManualInspection && (
                  <button className="configure-cancel" onClick={onStartManualInspection} type="button">
                    <Radio size={16} aria-hidden="true" /> Nuevo recorrido manual
                  </button>
                )}
                <button
                  className="configure-create mission-builder-submit"
                  disabled={!recordingDetail || isGenerating}
                  type="submit"
                >
                  {isGenerating ? "Generando..." : "Generar plan"}
                </button>
              </div>
            </article>
          </div>
        </form>
      )}

      {step === "plan" && plan && (
        <div className="mission-builder-grid plan-builder-ajustar-grid">
          <article className="mission-detail-card mission-builder-map">
            <div className="mission-detail-header">
              <div>
                <h2>{plan.name}</h2>
                <div className="mission-detail-id">
                  <small>{plan.objective || "Sin objetivo"}</small>
                </div>
              </div>
            </div>
            <PlanDraftMap
              assets={assets ?? []}
              highlightedAssetId={highlightedAssetId}
              onMoveWaypoint={handleMoveWaypoint}
              onSelectWaypoint={setSelectedSequence}
              route={plan.route}
              selectedSequence={selectedSequence}
              trackPoints={recordingDetail?.points ?? []}
            />
            <p className="map-field-label">
              <Route size={14} aria-hidden="true" /> {orderedRoute.length} waypoints. El recorrido real queda de
              fondo, como guía: sólo se usan los puntos de esta lista para armar la ruta.
            </p>
          </article>

          <article className="mission-detail-card mission-builder-fields">
            <h3 className="mission-quick-actions-title">Waypoints del plan</h3>
            <p className="plan-builder-points-hint">
              Tocá un punto para editarlo: tipo (paso o interés), activo, fotos, posición y tiempo de espera. Usá
              las flechas para reordenar, o &quot;Insertar punto acá&quot; para agregar uno nuevo.
            </p>

            <p className="plan-builder-flight-estimate">
              Distancia total: <strong>{formatDistance(totalDistanceMeters)}</strong> · Tiempo estimado:{" "}
              <strong>{formatDuration(estimatedDurationSeconds)}</strong> (incluye paradas, a {plan.cruiseSpeedMs} m/s
              de crucero)
            </p>

            <div className="plan-builder-waypoint-list">
              {orderedRoute.map((waypoint, index) => {
                const isNegativeAltitude = waypoint.altitude < 0;
                const canMove = index > 0 && index < orderedRoute.length - 1;
                const canInsertAfter = index < orderedRoute.length - 1;
                const canChangeType = waypoint.action !== "TAKEOFF" && waypoint.action !== "LAND";
                const isSelected = selectedSequence === waypoint.sequence;
                const isInteres = isSelected && (waypoint.action === "STOP" || pendingPointType === "interes");
                return (
                  <div key={waypoint.idPlanWaypoint}>
                    <div
                      className={isSelected ? "plan-builder-waypoint-row selected" : "plan-builder-waypoint-row"}
                      onClick={() => setSelectedSequence(waypoint.sequence)}
                    >
                      {canMove && (
                        <div className="plan-builder-reorder-buttons" onClick={(event) => event.stopPropagation()}>
                          <button
                            aria-label={`Subir waypoint ${waypoint.sequence}`}
                            disabled={movingSequence !== null}
                            onClick={() => handleReorder(waypoint.sequence, "UP")}
                            title="Mover antes"
                            type="button"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            aria-label={`Bajar waypoint ${waypoint.sequence}`}
                            disabled={movingSequence !== null}
                            onClick={() => handleReorder(waypoint.sequence, "DOWN")}
                            title="Mover después"
                            type="button"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      )}
                      <div className="plan-builder-waypoint-info">
                        <strong>
                          #{waypoint.sequence} ·{" "}
                          {waypoint.action === "NAVIGATE"
                            ? NAVIGATE_MOVEMENT_LABELS[getNavigateMovementKind(waypoint, orderedRoute[index - 1])]
                            : ACTION_LABELS[waypoint.action]}
                        </strong>
                        <span>
                          {waypoint.latitude.toFixed(6)}, {waypoint.longitude.toFixed(6)} ·{" "}
                          <span className={isNegativeAltitude ? "plan-builder-altitude-negative" : undefined}>
                            {waypoint.altitude.toFixed(1)} m
                          </span>
                          {waypoint.stopSeconds > 0 ? ` · ${waypoint.stopSeconds}s de espera` : ""}
                        </span>
                        {isNegativeAltitude && (
                          <span className="plan-builder-altitude-negative">
                            <AlertCircle size={12} aria-hidden="true" /> Altitud inválida: no puede quedar negativa.
                          </span>
                        )}
                        {waypoint.idAsset != null && (
                          <span className="plan-builder-waypoint-asset">
                            {waypoint.name ? `${waypoint.name} · ` : ""}{assetNameById.get(waypoint.idAsset) ?? `Activo #${waypoint.idAsset}`}
                          </span>
                        )}
                        {deleteError?.sequence === waypoint.sequence && <FieldError message={deleteError.message} />}
                        {moveError?.sequence === waypoint.sequence && <FieldError message={moveError.message} />}

                        {isSelected && (
                          <div className="plan-builder-coord-editor" onClick={(event) => event.stopPropagation()}>
                            {canChangeType && (
                              <>
                                <div className="plan-builder-point-type-toggle">
                                  <button
                                    aria-pressed={!isInteres}
                                    className={!isInteres ? "selected" : undefined}
                                    disabled={isSavingType}
                                    onClick={() => handleClickPointType("paso")}
                                    type="button"
                                  >
                                    Punto de paso
                                  </button>
                                  <button
                                    aria-pressed={isInteres}
                                    className={isInteres ? "selected" : undefined}
                                    disabled={isSavingType}
                                    onClick={() => handleClickPointType("interes")}
                                    type="button"
                                  >
                                    Punto de interés
                                  </button>
                                </div>
                                {isInteres && (
                                  <select
                                    aria-label={`Activo del punto ${waypoint.sequence}`}
                                    disabled={assets === null || isSavingType}
                                    onChange={(event) => handleAssignWaypointAsset(event.target.value ? Number(event.target.value) : null)}
                                    value={waypoint.idAsset ?? ""}
                                  >
                                    <option value="">Elegí un activo</option>
                                    {assetsByDistance(waypoint).map(({ asset, distance }) => (
                                      <option key={asset.idAsset} value={asset.idAsset}>
                                        {asset.name} ({asset.code}) · a {formatDistance(distance)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {typeError && <FieldError message={typeError} />}
                              </>
                            )}

                            <div className="plan-builder-coord-row">
                              <label>
                                <span>Latitud</span>
                                <input
                                  onChange={(event) => setCoordDraft((current) => ({ ...current, latitude: event.target.value }))}
                                  type="number"
                                  value={coordDraft.latitude}
                                />
                              </label>
                              <label>
                                <span>Longitud</span>
                                <input
                                  onChange={(event) => setCoordDraft((current) => ({ ...current, longitude: event.target.value }))}
                                  type="number"
                                  value={coordDraft.longitude}
                                />
                              </label>
                              <button
                                className="configure-cancel plan-builder-coord-save"
                                disabled={isSavingCoords !== null}
                                onClick={handleSaveXY}
                                type="button"
                              >
                                {isSavingCoords === "xy" ? "Guardando..." : "Guardar posición"}
                              </button>
                            </div>
                            <div className="plan-builder-coord-row">
                              <label>
                                <span>Altitud (z)</span>
                                <input
                                  onChange={(event) => setCoordDraft((current) => ({ ...current, altitude: event.target.value }))}
                                  type="number"
                                  value={coordDraft.altitude}
                                />
                              </label>
                              <button
                                className="configure-cancel plan-builder-coord-save"
                                disabled={isSavingCoords !== null}
                                onClick={handleSaveAltitude}
                                type="button"
                              >
                                {isSavingCoords === "z" ? "Guardando..." : "Guardar altitud"}
                              </button>
                            </div>
                            {waypoint.action === "STOP" && (
                              <div className="plan-builder-coord-row">
                                <label>
                                  <span>Tiempo de espera (s)</span>
                                  <input
                                    min={1}
                                    onChange={(event) => setStopSecondsDraft(event.target.value)}
                                    type="number"
                                    value={stopSecondsDraft}
                                  />
                                </label>
                                <button
                                  className="configure-cancel plan-builder-coord-save"
                                  disabled={isSavingCoords !== null}
                                  onClick={handleSaveStopSeconds}
                                  type="button"
                                >
                                  {isSavingCoords === "stop" ? "Guardando..." : "Guardar tiempo"}
                                </button>
                              </div>
                            )}
                            {coordError && <FieldError message={coordError} />}

                            {waypoint.action === "STOP" && (
                              <div className="plan-builder-photos">
                                <span className="plan-builder-photos-label">
                                  Fotos planificadas ({(waypoint.cameraAngles ?? []).length})
                                </span>

                                {(waypoint.cameraAngles ?? []).map((photo, photoIndex) => (
                                  <div className="plan-builder-photo-row" key={photoIndex}>
                                    <span>Pitch {photo.pitch}° · Yaw {photo.yaw}°</span>
                                    <button
                                      aria-label={`Eliminar foto ${photoIndex + 1}`}
                                      className="mission-delete-button"
                                      disabled={isSavingPlanPhotos}
                                      onClick={() => handleRemovePlanPhoto(photoIndex)}
                                      title="Eliminar foto"
                                      type="button"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}

                                <div className="plan-builder-photo-add">
                                  <input
                                    aria-label="Pitch de la nueva foto"
                                    max={PITCH_RANGE.max}
                                    min={PITCH_RANGE.min}
                                    onChange={(event) => setPlanPhotoDraft((current) => ({ ...current, pitch: event.target.value }))}
                                    placeholder="Pitch"
                                    type="number"
                                    value={planPhotoDraft.pitch}
                                  />
                                  <input
                                    aria-label="Yaw de la nueva foto"
                                    max={YAW_RANGE.max}
                                    min={YAW_RANGE.min}
                                    onChange={(event) => setPlanPhotoDraft((current) => ({ ...current, yaw: event.target.value }))}
                                    placeholder="Yaw"
                                    type="number"
                                    value={planPhotoDraft.yaw}
                                  />
                                  <button
                                    className="configure-cancel plan-builder-photo-add-button"
                                    disabled={isSavingPlanPhotos}
                                    onClick={handleAddPlanPhoto}
                                    type="button"
                                  >
                                    Agregar foto
                                  </button>
                                </div>
                                {planPhotoError && <FieldError message={planPhotoError} />}
                              </div>
                            )}
                          </div>
                        )}
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

                    {canInsertAfter && (
                      <div className="plan-builder-insert-row">
                        <button
                          className="plan-builder-insert-toggle"
                          onClick={() => handleOpenInsert(waypoint.sequence)}
                          type="button"
                        >
                          <Plus size={12} aria-hidden="true" />
                          {insertingAfterSequence === waypoint.sequence ? "Cancelar" : "Insertar punto acá"}
                        </button>

                        {insertingAfterSequence === waypoint.sequence && (
                          <div className="plan-builder-insert-form">
                            <div className="plan-builder-point-type-toggle">
                              <button
                                aria-pressed={insertDraft.type === "paso"}
                                className={insertDraft.type === "paso" ? "selected" : undefined}
                                onClick={() => setInsertDraft((current) => ({ ...current, type: "paso", idAsset: null }))}
                                type="button"
                              >
                                Punto de paso
                              </button>
                              <button
                                aria-pressed={insertDraft.type === "interes"}
                                className={insertDraft.type === "interes" ? "selected" : undefined}
                                onClick={() => setInsertDraft((current) => ({ ...current, type: "interes" }))}
                                type="button"
                              >
                                Punto de interés
                              </button>
                            </div>

                            {insertDraft.type === "interes" && (
                              <select
                                aria-label="Activo del punto nuevo"
                                onChange={(event) =>
                                  setInsertDraft((current) => ({
                                    ...current,
                                    idAsset: event.target.value ? Number(event.target.value) : null
                                  }))
                                }
                                value={insertDraft.idAsset ?? ""}
                              >
                                <option value="">Elegí un activo</option>
                                {(assets ?? []).map((asset) => (
                                  <option key={asset.idAsset} value={asset.idAsset}>
                                    {asset.name} ({asset.code})
                                  </option>
                                ))}
                              </select>
                            )}

                            <div className="plan-builder-coord-row">
                              <label>
                                <span>Latitud</span>
                                <input
                                  onChange={(event) => setInsertDraft((current) => ({ ...current, latitude: event.target.value }))}
                                  type="number"
                                  value={insertDraft.latitude}
                                />
                              </label>
                              <label>
                                <span>Longitud</span>
                                <input
                                  onChange={(event) => setInsertDraft((current) => ({ ...current, longitude: event.target.value }))}
                                  type="number"
                                  value={insertDraft.longitude}
                                />
                              </label>
                              <label>
                                <span>Altitud</span>
                                <input
                                  onChange={(event) => setInsertDraft((current) => ({ ...current, altitude: event.target.value }))}
                                  type="number"
                                  value={insertDraft.altitude}
                                />
                              </label>
                            </div>
                            {insertError && <FieldError message={insertError} />}
                            <button
                              className="configure-create plan-builder-coord-save"
                              disabled={isInserting}
                              onClick={handleSubmitInsert}
                              type="button"
                            >
                              {isInserting ? "Insertando..." : "Agregar punto"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasNegativeAltitude && (
              <p className="mission-empty plan-builder-altitude-negative">
                <AlertCircle size={16} aria-hidden="true" /> Hay puntos con altitud negativa: corregilos antes de
                confirmar el plan.
              </p>
            )}

            {confirmError && (
              <p className="mission-empty">
                <AlertCircle size={16} aria-hidden="true" /> {confirmError}
              </p>
            )}

            <div className="form-actions plan-builder-actions-row">
              <button className="configure-cancel" onClick={() => setStep("recorrido")} type="button">
                Atrás
              </button>
              <button
                className="configure-create mission-builder-submit"
                disabled={isConfirming || hasNegativeAltitude}
                onClick={handleConfirm}
                type="button"
              >
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
