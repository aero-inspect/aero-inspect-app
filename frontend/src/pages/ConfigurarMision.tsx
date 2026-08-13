import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from "lucide-react";
import type { BackendFlightPlan, BackendAsset } from "../api/types";
import { getFlightPlans, getAssets, createMission } from "../api/client";
import { FieldError } from "../components/FieldError";
import { MissionPlanMap } from "../components/MissionPlanMap";
import { AppTopActions } from "../components/AppTopActions";
import type { InspectionPoint } from "../types";
import { photoCountForWaypoint } from "../utils/missionPhotos";

type FieldErrors = Partial<Record<"name" | "droneId" | "scheduledAt", string>>;

type MissionDraftStatus = "Pendiente";

const DEFAULT_ROUTE: InspectionPoint[] = [
  { id: 1, latitude: "-35.140110", longitude: "-60.458900" },
  { id: 2, latitude: "-35.140410", longitude: "-60.458520" },
  { id: 3, latitude: "-35.140205", longitude: "-60.457920" },
  { id: 4, latitude: "-35.140760", longitude: "-60.457710" },
  { id: 5, latitude: "-35.141045", longitude: "-60.458240" },
  { id: 6, latitude: "-35.140820", longitude: "-60.458760" }
];

export function ConfigurarMisionView({
  initialFlightPlanId,
  onBack,
  onViewMissions
}: {
  initialFlightPlanId?: number | null;
  onBack: () => void;
  onViewMissions: () => void;
}) {
  const [flightPlans, setFlightPlans] = useState<BackendFlightPlan[] | null>(null);
  const [flightPlansError, setFlightPlansError] = useState<string | null>(null);
  const [hasAppliedInitialPlan, setHasAppliedInitialPlan] = useState(false);

  const [selectedFlightPlan, setSelectedFlightPlan] = useState<BackendFlightPlan | null>(null);
  const [planAssets, setPlanAssets] = useState<BackendAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const [selectedWaypointIds, setSelectedWaypointIds] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [droneId, setDroneId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const loadFlightPlans = () => {
    setFlightPlansError(null);
    setFlightPlans(null);
    getFlightPlans()
      .then(setFlightPlans)
      .catch((error: unknown) => setFlightPlansError(error instanceof Error ? error.message : "No se pudieron cargar los planes de vuelo."));
  };

  useEffect(() => {
    loadFlightPlans();
  }, []);

  const handleSelectFlightPlan = (plan: BackendFlightPlan) => {
    setSelectedFlightPlan(plan);
    setSelectedWaypointIds(new Set());
    setPlanAssets([]);
    setAssetsError(null);
    setAssetsLoading(true);
    getAssets()
      .then((allAssets) => {
        setPlanAssets(allAssets.filter((asset) => plan.assetIds.includes(asset.idAsset)));
      })
      .catch((error: unknown) => setAssetsError(error instanceof Error ? error.message : "No se pudieron cargar los activos."))
      .finally(() => setAssetsLoading(false));
  };

  useEffect(() => {
    setHasAppliedInitialPlan(false);
  }, [initialFlightPlanId]);

  useEffect(() => {
    if (hasAppliedInitialPlan || !initialFlightPlanId || selectedFlightPlan || !flightPlans?.length) return;
    const initialPlan = flightPlans.find((plan) => plan.idFlightPlan === initialFlightPlanId);
    if (initialPlan) {
      handleSelectFlightPlan(initialPlan);
      setHasAppliedInitialPlan(true);
    }
  }, [hasAppliedInitialPlan, initialFlightPlanId, flightPlans, selectedFlightPlan]);

  const totalPhotoCount = selectedFlightPlan
    ? selectedFlightPlan.route
        .filter((point) => selectedWaypointIds.has(point.idPlanWaypoint))
        .reduce((total, point) => total + photoCountForWaypoint(point), 0)
    : 0;

  const handleToggleWaypoint = (idPlanWaypoint: number) => {
    setSelectedWaypointIds((current) => {
      const next = new Set(current);
      if (next.has(idPlanWaypoint)) {
        next.delete(idPlanWaypoint);
      } else {
        next.add(idPlanWaypoint);
      }
      return next;
    });
  };

  const resetForm = () => {
    setSelectedFlightPlan(null);
    setPlanAssets([]);
    setSelectedWaypointIds(new Set());
    setName("");
    setObjective("");
    setDroneId("");
    setScheduledAt("");
    setFieldErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFlightPlan) return;

    setSubmitError(null);

    const nextFieldErrors: FieldErrors = {};
    if (!name.trim()) nextFieldErrors.name = "Ingrese un nombre para la mision.";
    if (!droneId.trim()) nextFieldErrors.droneId = "Ingrese el identificador del dron.";
    if (!scheduledAt) nextFieldErrors.scheduledAt = "Seleccione fecha y hora programada.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      await createMission({
        idFlightPlan: selectedFlightPlan.idFlightPlan,
        name: name.trim(),
        objective: objective.trim(),
        droneId: droneId.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        selectedPlanWaypointIds: Array.from(selectedWaypointIds)
      });
      setIsSuccessOpen(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear la mision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="missions-dashboard">
      <header className="missions-topbar">
        <div className="configure-title-row">
          <button className="monitor-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>Configurar mision</h1>
            <p>Elegi un plan de vuelo y marca los puntos de interes a inspeccionar.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      {!selectedFlightPlan ? (
        <article className="missions-list-card mission-builder-missing-plan">
          {flightPlansError ? (
            <p className="mission-empty">
              <AlertCircle size={16} aria-hidden="true" /> {flightPlansError}
            </p>
          ) : (
            <p className="mission-empty">Selecciona un plan desde Nueva Mision para configurar una mision.</p>
          )}
        </article>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mission-builder-grid">
            <article className="mission-detail-card mission-builder-map">
              <div className="mission-detail-header">
                <div>
                  <h2>{selectedFlightPlan.name}</h2>
                  <div className="mission-detail-id">
                    <small>{selectedFlightPlan.objective}</small>
                  </div>
                </div>
              </div>

              {assetsError && (
                <p className="mission-empty">
                  <AlertCircle size={16} aria-hidden="true" /> {assetsError}
                </p>
              )}
              {assetsLoading && <p className="mission-empty">Cargando activos...</p>}

              {!assetsLoading && !assetsError && (
                <MissionPlanMap
                  assets={planAssets}
                  flightPlan={selectedFlightPlan}
                  onToggleWaypoint={handleToggleWaypoint}
                  selectedWaypointIds={selectedWaypointIds}
                />
              )}

              <p className="map-field-label">
                {selectedWaypointIds.size} puntos de interes seleccionados
                {selectedWaypointIds.size > 0
                  ? ` · ${totalPhotoCount} foto${totalPhotoCount === 1 ? "" : "s"} en total`
                  : ""}
                . Toca un activo en el mapa para elegir sus puntos.
              </p>
            </article>

            <article className="mission-detail-card mission-builder-fields">
              <h3 className="mission-quick-actions-title">Datos de la mision</h3>

              <label>
                <span>
                  Nombre de la mision <small className="required-inline">*</small>
                </span>
                <input
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={fieldErrors.name ? "field-invalid" : undefined}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej: Inspeccion trimestral Q1"
                  type="text"
                  value={name}
                />
                {fieldErrors.name && <FieldError message={fieldErrors.name} />}
              </label>

              <label>
                <span>Objetivo</span>
                <input
                  onChange={(event) => setObjective(event.target.value)}
                  placeholder="Opcional"
                  type="text"
                  value={objective}
                />
              </label>

              <label>
                <span>
                  Dron <small className="required-inline">*</small>
                </span>
                <input
                  aria-invalid={Boolean(fieldErrors.droneId)}
                  className={fieldErrors.droneId ? "field-invalid" : undefined}
                  onChange={(event) => setDroneId(event.target.value)}
                  placeholder="Ej: DRONE-01"
                  type="text"
                  value={droneId}
                />
                {fieldErrors.droneId && <FieldError message={fieldErrors.droneId} />}
              </label>

              <label>
                <span>
                  Programada para <small className="required-inline">*</small>
                </span>
                <input
                  aria-invalid={Boolean(fieldErrors.scheduledAt)}
                  className={fieldErrors.scheduledAt ? "field-invalid" : undefined}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  type="datetime-local"
                  value={scheduledAt}
                />
                {fieldErrors.scheduledAt && <FieldError message={fieldErrors.scheduledAt} />}
              </label>

              {submitError && (
                <p className="mission-empty">
                  <AlertCircle size={16} aria-hidden="true" /> {submitError}
                </p>
              )}

              <div className="form-actions">
                <button className="configure-create mission-builder-submit" disabled={isSubmitting} type="submit">
                  <Save size={15} aria-hidden="true" />
                  {isSubmitting ? "Creando..." : "Crear mision"}
                </button>
              </div>
            </article>
          </div>
        </form>
      )}

      {isSuccessOpen && (
        <MissionSuccessModal
          onGoHome={() => {
            setIsSuccessOpen(false);
            resetForm();
            onBack();
          }}
          onViewMissions={() => {
            setIsSuccessOpen(false);
            resetForm();
            onViewMissions();
          }}
        />
      )}
    </section>
  );
}

function MissionSuccessModal({ onGoHome, onViewMissions }: { onGoHome: () => void; onViewMissions: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <CheckCircle2 size={48} aria-hidden="true" />
        </div>
        <h2>Mision creada</h2>
        <p>La mision se creo correctamente y quedo planificada.</p>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onGoHome} type="button">
            Volver al inicio
          </button>
          <button className="register-button" onClick={onViewMissions} type="button">
            Ver misiones
          </button>
        </div>
      </section>
    </div>
  );
}
