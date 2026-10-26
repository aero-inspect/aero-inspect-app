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
  PlannedPhoto,
  PlanWaypoint,
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
  updatePlanWaypointType
} from "../api/planBuilder";
import { getAssets } from "../api/client";
import type { BackendAsset } from "../api/types";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { PlanDraftMap } from "../components/PlanDraftMap";
import { AppTopActions } from "../components/AppTopActions";
import { FieldError } from "../components/FieldError";
import { LoadingState } from "../components/LoadingState";
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

type WaypointEditDraft = {
  latitude: string;
  longitude: string;
  altitude: string;
  stopSeconds: string;
  droneDegree: string;
};

const EMPTY_EDIT_DRAFT: WaypointEditDraft = { latitude: "", longitude: "", altitude: "", stopSeconds: "", droneDegree: "" };

function editDraftOf(waypoint: PlanWaypoint): WaypointEditDraft {
  return {
    latitude: String(waypoint.latitude),
    longitude: String(waypoint.longitude),
    altitude: String(waypoint.altitude),
    stopSeconds: String(waypoint.stopSeconds),
    droneDegree: String(waypoint.droneDegree)
  };
}

function samePhotos(a: PlannedPhoto[], b: PlannedPhoto[]) {
  return a.length === b.length && a.every((photo, i) => photo.pitch === b[i].pitch && photo.yaw === b[i].yaw);
}

const CARDINAL_POINTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

// "45° (NE)": el número es lo que viaja al dron, el punto cardinal es para leerlo de un vistazo.
function formatDroneDegree(degree: number) {
  const cardinal = CARDINAL_POINTS[Math.round((((degree % 360) + 360) % 360) / 45) % 8];
  return `${Math.round(degree)}° (${cardinal})`;
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

  // Edición manual del waypoint seleccionado: posición, altitud, espera y rumbo se editan juntos y
  // se guardan con un único "Guardar cambios" (o se descartan).
  const [editDraft, setEditDraft] = useState<WaypointEditDraft>(EMPTY_EDIT_DRAFT);
  const [isSavingWaypoint, setIsSavingWaypoint] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Tipo del waypoint seleccionado: null = como está; "interes" mientras se elige el activo antes
  // de confirmarlo (recién ahí se manda al backend).
  const [pendingPointType, setPendingPointType] = useState<"paso" | "interes" | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  // Fotos de un punto de interés: se arman en la lista local (agregar/quitar) y viajan con el resto
  // del punto en "Guardar cambios". planPhotoDraft son los inputs de la foto que se está cargando.
  const [photosDraft, setPhotosDraft] = useState<PlannedPhoto[]>([]);
  const [takePhotoDraft, setTakePhotoDraft] = useState(true);
  const [planPhotoDraft, setPlanPhotoDraft] = useState({ pitch: "", yaw: "" });
  const [planPhotoError, setPlanPhotoError] = useState<string | null>(null);

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
    setEditDraft(selectedWaypoint ? editDraftOf(selectedWaypoint) : EMPTY_EDIT_DRAFT);
    setEditError(null);
    if (!selectedWaypoint) return;
    setPendingPointType(null);
    setTypeError(null);
    setPlanPhotoDraft({ pitch: "", yaw: "" });
    setPlanPhotoError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSequence]);

  // Las fotos guardadas cambian también al cambiar el tipo o el activo (se guardan al instante y
  // pasar a punto de paso las borra): la lista local se vuelve a tomar de lo guardado.
  useEffect(() => {
    setPhotosDraft(selectedWaypoint?.cameraAngles ?? []);
    setTakePhotoDraft(selectedWaypoint?.takePhoto ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSequence, selectedWaypoint?.idAsset, selectedWaypoint?.pointOfInterest]);

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

  // Mover el marker en el mapa (drag) sólo cambia x/y: la altitud viaja tal cual estaba. Puede
  // dejar un tramo en diagonal con un vecino: el borrador lo admite y recién el backend lo rechaza
  // al confirmar el plan.
  const handleMoveWaypoint = async (sequence: number, latitude: number, longitude: number) => {
    if (!plan) return;
    const waypoint = orderedRoute.find((item) => item.sequence === sequence);
    if (!waypoint) return;
    const moved = { latitude, longitude, altitude: waypoint.altitude };

    setEditError(null);
    try {
      const updated = await updatePlanWaypoint(plan.idFlightPlan, sequence, moved);
      setPlan(updated);
      // Si el punto arrastrado es el seleccionado, los inputs tienen que reflejar la nueva
      // posición: si no, quedarían mostrando la coordenada vieja hasta volver a seleccionarlo.
      if (selectedSequence === sequence) {
        setEditDraft((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }));
      }
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo mover el waypoint.");
    }
  };

  // Hay cambios sin guardar si algún input difiere de lo que tiene guardado el waypoint.
  const hasPendingPhotoInput = planPhotoDraft.pitch.trim() !== "" || planPhotoDraft.yaw.trim() !== "";
  const hasUnsavedChanges = (() => {
    if (!selectedWaypoint) return false;
    if (selectedWaypoint.pointOfInterest) {
      if (takePhotoDraft !== selectedWaypoint.takePhoto) return true;
      if (takePhotoDraft && (hasPendingPhotoInput || !samePhotos(photosDraft, selectedWaypoint.cameraAngles ?? []))) {
        return true;
      }
    }
    const saved = editDraftOf(selectedWaypoint);
    return (Object.keys(saved) as (keyof WaypointEditDraft)[]).some(
      // "3.0" y "3" son el mismo valor: sólo cuenta como cambio si el número es otro.
      (field) => {
        const value = editDraft[field].trim();
        return value !== saved[field] && (value === "" || Number(value) !== Number(saved[field]));
      }
    );
  })();

  // Abrir otro punto, o cerrar el abierto (null), avisa antes de tirar cambios sin guardar.
  const selectWaypoint = (sequence: number | null) => {
    if (sequence === selectedSequence) return;
    if (hasUnsavedChanges && !window.confirm("Tenés cambios sin guardar en este punto. ¿Descartarlos?")) return;
    setSelectedSequence(sequence);
  };

  const handleDiscardWaypoint = () => {
    if (!selectedWaypoint) return;
    setEditDraft(editDraftOf(selectedWaypoint));
    setEditError(null);
    setPhotosDraft(selectedWaypoint.cameraAngles ?? []);
    setTakePhotoDraft(selectedWaypoint.takePhoto);
    setPlanPhotoDraft({ pitch: "", yaw: "" });
    setPlanPhotoError(null);
  };

  const handleSaveWaypoint = async () => {
    if (!plan || !selectedWaypoint) return;
    // Sin nada que guardar, el botón sólo cierra el punto.
    if (!hasUnsavedChanges) {
      setSelectedSequence(null);
      return;
    }
    const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
    const latitude = toNumber(editDraft.latitude);
    const longitude = toNumber(editDraft.longitude);
    const altitude = toNumber(editDraft.altitude);
    const stopSeconds = toNumber(editDraft.stopSeconds);
    const droneDegree = toNumber(editDraft.droneDegree);
    const isStop = selectedWaypoint.action === "STOP";
    // El rumbo del despegue no se edita: lo pone el flight-controller con la orientación del dron.
    const editsDegree = selectedWaypoint.action !== "TAKEOFF";

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setEditError("Ingresá una latitud y una longitud válidas.");
      return;
    }
    if (Number.isNaN(altitude)) {
      setEditError("Ingresá una altitud válida.");
      return;
    }
    if (isStop && (Number.isNaN(stopSeconds) || !Number.isInteger(stopSeconds) || stopSeconds < 1)) {
      setEditError("Ingresá un tiempo de espera válido (segundos enteros, mínimo 1).");
      return;
    }
    if (editsDegree && (Number.isNaN(droneDegree) || droneDegree < 0 || droneDegree >= 360)) {
      setEditError("Ingresá un rumbo válido, entre 0 y 359 grados.");
      return;
    }

    // Una foto escrita pero sin "+ Foto" también se guarda: es lo que se espera al tocar
    // "Guardar cambios" con los dos campos completos.
    let cameraAngles = photosDraft;
    if (selectedWaypoint.pointOfInterest && takePhotoDraft && hasPendingPhotoInput) {
      const pending = parsePlanPhoto();
      if (!pending) return;
      cameraAngles = [...photosDraft, pending];
    }

    setEditError(null);
    setIsSavingWaypoint(true);
    try {
      const updated = await updatePlanWaypoint(plan.idFlightPlan, selectedWaypoint.sequence, {
        latitude,
        longitude,
        altitude,
        ...(isStop ? { stopSeconds } : {}),
        ...(editsDegree ? { droneDegree } : {}),
        ...(selectedWaypoint.pointOfInterest ? { cameraAngles, takePhoto: takePhotoDraft } : {})
      });
      setPlan(updated);
      // Guardado: se cierra el punto. Si falla, queda abierto con el error y lo escrito.
      setSelectedSequence(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setIsSavingWaypoint(false);
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

  // Valida los inputs de la foto en carga; null (con el error a la vista) si no sirven.
  const parsePlanPhoto = (): PlannedPhoto | null => {
    const pitch = Number(planPhotoDraft.pitch);
    const yaw = Number(planPhotoDraft.yaw);
    if (planPhotoDraft.pitch.trim() === "" || planPhotoDraft.yaw.trim() === "" || Number.isNaN(pitch) || Number.isNaN(yaw)) {
      setPlanPhotoError("Completá pitch y yaw de la foto (o borralos si no querés agregarla).");
      return null;
    }
    if (pitch < PITCH_RANGE.min || pitch > PITCH_RANGE.max) {
      setPlanPhotoError(`El pitch debe estar entre ${PITCH_RANGE.min} y ${PITCH_RANGE.max}.`);
      return null;
    }
    if (yaw < YAW_RANGE.min || yaw > YAW_RANGE.max) {
      setPlanPhotoError(`El yaw debe estar entre ${YAW_RANGE.min} y ${YAW_RANGE.max}.`);
      return null;
    }
    setPlanPhotoError(null);
    return { pitch, yaw };
  };

  const handleAddPlanPhoto = () => {
    const photo = parsePlanPhoto();
    if (!photo) return;
    setPhotosDraft((current) => [...current, photo]);
    setPlanPhotoDraft({ pitch: "", yaw: "" });
  };

  const handleRemovePlanPhoto = (photoIndex: number) => {
    setPhotosDraft((current) => current.filter((_, i) => i !== photoIndex));
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
              onSelectWaypoint={selectWaypoint}
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
                      // Tocar el punto abierto lo cierra; el editor de adentro no propaga sus clicks.
                      onClick={() => selectWaypoint(isSelected ? null : waypoint.sequence)}
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
                          {isSelected ? (
                            <ChevronUp aria-label="Cerrar punto" size={14} />
                          ) : (
                            <ChevronDown aria-label="Abrir punto" size={14} />
                          )}
                        </strong>
                        <span>
                          {waypoint.latitude.toFixed(6)}, {waypoint.longitude.toFixed(6)} ·{" "}
                          <span className={isNegativeAltitude ? "plan-builder-altitude-negative" : undefined}>
                            {waypoint.altitude.toFixed(1)} m
                          </span>
                          {waypoint.stopSeconds > 0 ? ` · ${waypoint.stopSeconds}s de espera` : ""}
                          {waypoint.pointOfInterest && !waypoint.takePhoto ? " · sin foto" : ""}
                          {waypoint.action === "TAKEOFF"
                            ? " · rumbo libre"
                            : ` · rumbo ${formatDroneDegree(waypoint.droneDegree)}`}
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
                                  onChange={(event) => setEditDraft((current) => ({ ...current, latitude: event.target.value }))}
                                  type="number"
                                  value={editDraft.latitude}
                                />
                              </label>
                              <label>
                                <span>Longitud</span>
                                <input
                                  onChange={(event) => setEditDraft((current) => ({ ...current, longitude: event.target.value }))}
                                  type="number"
                                  value={editDraft.longitude}
                                />
                              </label>
                            </div>
                            <div className="plan-builder-coord-row">
                              <label>
                                <span>Altitud (z)</span>
                                <input
                                  onChange={(event) => setEditDraft((current) => ({ ...current, altitude: event.target.value }))}
                                  type="number"
                                  value={editDraft.altitude}
                                />
                              </label>
                              {waypoint.action === "STOP" && (
                                <label>
                                  <span>Tiempo de espera (s)</span>
                                  <input
                                    min={1}
                                    onChange={(event) => setEditDraft((current) => ({ ...current, stopSeconds: event.target.value }))}
                                    type="number"
                                    value={editDraft.stopSeconds}
                                  />
                                </label>
                              )}
                            </div>
                            {waypoint.action === "TAKEOFF" ? (
                              // El flight-controller despega con el rumbo que tiene el dron apoyado
                              // (takeoff_facing): el rumbo guardado acá no llega a usarse.
                              <p className="plan-builder-points-hint">
                                Rumbo del dron: <strong>Libre</strong>. Usa la orientación del dron.
                              </p>
                            ) : (
                              <div className="plan-builder-coord-row">
                                <label>
                                  <span>Rumbo del dron (°, 0 = norte, 90 = este)</span>
                                  <input
                                    max={359}
                                    min={0}
                                    onChange={(event) => setEditDraft((current) => ({ ...current, droneDegree: event.target.value }))}
                                    type="number"
                                    value={editDraft.droneDegree}
                                  />
                                </label>
                              </div>
                            )}
                            {waypoint.action === "STOP" && !waypoint.pointOfInterest && (
                              <p className="plan-builder-points-hint">Para planificar fotos, pasalo a punto de interés y elegí un activo.</p>
                            )}
                            {waypoint.pointOfInterest && (
                              <div className="plan-builder-photos">
                                <div className="plan-builder-point-type-toggle">
                                  <button
                                    aria-pressed={takePhotoDraft}
                                    className={takePhotoDraft ? "selected" : undefined}
                                    onClick={() => setTakePhotoDraft(true)}
                                    type="button"
                                  >
                                    Con foto
                                  </button>
                                  <button
                                    aria-pressed={!takePhotoDraft}
                                    className={!takePhotoDraft ? "selected" : undefined}
                                    onClick={() => setTakePhotoDraft(false)}
                                    type="button"
                                  >
                                    Sin foto
                                  </button>
                                </div>
                                {!takePhotoDraft && (
                                  <span className="plan-builder-points-hint">
                                    El dron frena y espera {editDraft.stopSeconds || waypoint.stopSeconds} s, pero no saca foto.
                                  </span>
                                )}
                                {takePhotoDraft && (
                                  <>
                                    <span className="plan-builder-photos-label">Fotos planificadas ({photosDraft.length})</span>
                                    {photosDraft.length === 0 && (
                                      <span className="plan-builder-points-hint">Sin fotos cargadas: saca una con el gimbal como esté.</span>
                                    )}
                                    {photosDraft.map((photo, photoIndex) => (
                                      <div className="plan-builder-photo-row" key={photoIndex}>
                                        <span>Foto {photoIndex + 1} · Pitch {photo.pitch}° · Yaw {photo.yaw}°</span>
                                        <button
                                          aria-label={`Quitar foto ${photoIndex + 1}`}
                                          className="mission-delete-button"
                                          disabled={isSavingWaypoint}
                                          onClick={() => handleRemovePlanPhoto(photoIndex)}
                                          title="Quitar foto"
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
                                        onKeyDown={(event) => event.key === "Enter" && handleAddPlanPhoto()}
                                        placeholder={`Pitch (${PITCH_RANGE.min} a ${PITCH_RANGE.max})`}
                                        type="number"
                                        value={planPhotoDraft.pitch}
                                      />
                                      <input
                                        aria-label="Yaw de la nueva foto"
                                        max={YAW_RANGE.max}
                                        min={YAW_RANGE.min}
                                        onChange={(event) => setPlanPhotoDraft((current) => ({ ...current, yaw: event.target.value }))}
                                        onKeyDown={(event) => event.key === "Enter" && handleAddPlanPhoto()}
                                        placeholder={`Yaw (${YAW_RANGE.min} a ${YAW_RANGE.max})`}
                                        type="number"
                                        value={planPhotoDraft.yaw}
                                      />
                                      <button
                                        className="configure-cancel plan-builder-photo-add-button"
                                        disabled={isSavingWaypoint}
                                        onClick={handleAddPlanPhoto}
                                        type="button"
                                      >
                                        + Foto
                                      </button>
                                    </div>
                                    {planPhotoError && <FieldError message={planPhotoError} />}
                                  </>
                                )}
                              </div>
                            )}
                            <div className="plan-builder-coord-row plan-builder-edit-actions">
                              <button
                                className="configure-cancel"
                                disabled={!hasUnsavedChanges || isSavingWaypoint}
                                onClick={handleDiscardWaypoint}
                                type="button"
                              >
                                Descartar
                              </button>
                              <button
                                className="configure-create"
                                disabled={isSavingWaypoint}
                                onClick={handleSaveWaypoint}
                                type="button"
                              >
                                {isSavingWaypoint ? "Guardando..." : hasUnsavedChanges ? "Guardar cambios" : "Listo"}
                              </button>
                            </div>
                            {editError && <FieldError message={editError} />}

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
