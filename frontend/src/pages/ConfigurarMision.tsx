import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Database, X } from "lucide-react";
import type { BackendFlightPlan, BackendAsset } from "../api/types";
import { getFlightPlans, getAssets, createMission, seedDemoData } from "../api/client";
import { FieldError } from "../components/FieldError";
import { MissionPlanMap } from "../components/MissionPlanMap";
import { AppTopActions } from "../components/AppTopActions";

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
  onBack,
  onViewMissions
}: {
  onBack: () => void;
  onViewMissions: () => void;
}) {
  const [flightPlans, setFlightPlans] = useState<BackendFlightPlan[] | null>(null);
  const [flightPlansError, setFlightPlansError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

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

  const handleSeed = async () => {
    setIsSeeding(true);
    setFlightPlansError(null);
    try {
      await seedDemoData();
      loadFlightPlans();
    } catch (error) {
      setFlightPlansError(error instanceof Error ? error.message : "No se pudo cargar la data de prueba.");
    } finally {
      setIsSeeding(false);
    }
  };

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
    if (!name.trim()) nextFieldErrors.name = "Ingrese un nombre para la misión.";
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
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear la misión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="missions-dashboard">
      <button className="back-link mission-builder-back" onClick={onBack} type="button">
        <ArrowLeft size={18} aria-hidden="true" />
        Volver
      </button>

      <header className="missions-topbar">
        <div>
          <h1>Configurar misión</h1>
          <p>Elegí un plan de vuelo y tildá los puntos de interés a inspeccionar.</p>
        </div>
        <AppTopActions />
      </header>

      {!selectedFlightPlan ? (
        <article className="missions-list-card">
          <div className="missions-list-toolbar">
            <h2 className="mission-quick-actions-title">Elegir plan de vuelo</h2>
          </div>

          {flightPlansError && (
            <p className="mission-empty">
              <AlertCircle size={16} aria-hidden="true" /> {flightPlansError}
            </p>
          )}

          {flightPlans === null && !flightPlansError && <p className="mission-empty">Cargando planes de vuelo...</p>}

          {flightPlans !== null && flightPlans.length === 0 && (
            <div className="mission-empty">
              <p>No hay planes de vuelo cargados todavía.</p>
              <button className="modal-link-button" disabled={isSeeding} onClick={handleSeed} type="button">
                <Database size={16} aria-hidden="true" />
                {isSeeding ? "Cargando..." : "Cargar datos de prueba"}
              </button>
            </div>
          )}

          {flightPlans !== null && flightPlans.length > 0 && (
            <div className="flight-plan-picker">
              {flightPlans.map((plan) => (
                <button
                  className="flight-plan-option"
                  key={plan.idFlightPlan}
                  onClick={() => handleSelectFlightPlan(plan)}
                  type="button"
                >
                  <strong>{plan.name}</strong>
                  <span>{plan.objective}</span>
                </button>
              ))}
            </div>
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
                <button className="mission-detail-close" onClick={resetForm} type="button" aria-label="Cambiar plan">
                  <X size={17} />
                </button>
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
                {selectedWaypointIds.size} puntos de interés seleccionados — tocá un activo en el mapa para
                elegir sus puntos.
              </p>
            </article>

            <article className="mission-detail-card mission-builder-fields">
              <h3 className="mission-quick-actions-title">Datos de la misión</h3>

              <label>
                <span>
                  Nombre de la misión <small className="required-inline">*</small>
                </span>
                <input
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={fieldErrors.name ? "field-invalid" : undefined}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej: Inspección trimestral Q1"
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
                <button className="register-button" disabled={isSubmitting} type="submit">
                  <Save size={18} aria-hidden="true" />
                  {isSubmitting ? "Creando..." : "Crear misión"}
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
        <h2>Misión creada</h2>
        <p>La misión se creó correctamente y quedó planificada, lista para despachar.</p>
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
