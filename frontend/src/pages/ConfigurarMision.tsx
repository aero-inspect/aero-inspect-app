import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, CalendarClock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { BackendFlightPlan, BackendAsset, BackendDrone } from "../api/types";
import { getFlightPlans, getAssets, getDrones, createMission } from "../api/client";
import { FieldError } from "../components/FieldError";
import { MissionPlanMap } from "../components/MissionPlanMap";
import { AppTopActions } from "../components/AppTopActions";
import type { InspectionPoint } from "../types";
import { photoCountForWaypoint } from "../utils/missionPhotos";

type FieldErrors = Partial<Record<"name" | "idDrone" | "scheduledAt", string>>;

type MissionDraftStatus = "Pendiente";

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatScheduledLabel(value: string) {
  if (!value) return "Seleccione fecha y hora";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstVisibleDay = new Date(firstDay);
  firstVisibleDay.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisibleDay);
    day.setDate(firstVisibleDay.getDate() + index);
    return day;
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

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

  const [drones, setDrones] = useState<BackendDrone[] | null>(null);
  const [dronesError, setDronesError] = useState<string | null>(null);

  const [selectedFlightPlan, setSelectedFlightPlan] = useState<BackendFlightPlan | null>(null);
  const [planAssets, setPlanAssets] = useState<BackendAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const [selectedWaypointIds, setSelectedWaypointIds] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [idDrone, setIdDrone] = useState("");
  const [isDroneMenuOpen, setIsDroneMenuOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledTimeInput, setScheduledTimeInput] = useState("09:00");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [visibleDate, setVisibleDate] = useState(() => new Date());
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
    getDrones()
      .then(setDrones)
      .catch((error: unknown) => setDronesError(error instanceof Error ? error.message : "No se pudieron cargar los drones."));
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

  const selectedDrone = drones?.find((drone) => drone.idDrone === idDrone) ?? null;
  const selectedScheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const calendarDays = buildCalendarDays(visibleDate);

  const handleSelectDate = (date: Date) => {
    const nextDate = new Date(date);
    if (selectedScheduledDate) {
      nextDate.setHours(selectedScheduledDate.getHours(), selectedScheduledDate.getMinutes(), 0, 0);
    } else {
      const [hours, minutes] = /^\d{2}:\d{2}$/.test(scheduledTimeInput) ? scheduledTimeInput.split(":").map(Number) : [9, 0];
      nextDate.setHours(hours, minutes, 0, 0);
    }
    setScheduledAt(toDateInputValue(nextDate));
    setScheduledTimeInput(toDateInputValue(nextDate).slice(11, 16));
    setVisibleDate(nextDate);
    setFieldErrors((current) => ({ ...current, scheduledAt: undefined }));
  };

  const handleSelectTime = (time: string) => {
    setScheduledTimeInput(time);
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    const [hours, minutes] = time.split(":").map(Number);
    if (hours > 23 || minutes > 59) return;
    const nextDate = selectedScheduledDate ? new Date(selectedScheduledDate) : new Date();
    nextDate.setHours(hours, minutes, 0, 0);
    setScheduledAt(toDateInputValue(nextDate));
    setVisibleDate(nextDate);
    setFieldErrors((current) => ({ ...current, scheduledAt: undefined }));
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
    setIdDrone("");
    setScheduledAt("");
    setScheduledTimeInput("09:00");
    setFieldErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFlightPlan) return;

    setSubmitError(null);

    const nextFieldErrors: FieldErrors = {};
    if (!name.trim()) nextFieldErrors.name = "Ingrese un nombre para la mision.";
    if (!idDrone) nextFieldErrors.idDrone = "Seleccione un dron.";
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
        idDrone,
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
                <div className={fieldErrors.idDrone ? "mission-drone-select field-invalid" : idDrone ? "mission-drone-select selected" : "mission-drone-select"}>
                  <button
                    aria-expanded={isDroneMenuOpen}
                    aria-invalid={Boolean(fieldErrors.idDrone)}
                    onClick={() => {
                      if (!dronesError) setIsDroneMenuOpen((open) => !open);
                    }}
                    type="button"
                  >
                    {selectedDrone ? `${selectedDrone.name} (${selectedDrone.droneId})` : dronesError ? "No se pudieron cargar los drones" : "Seleccione un dron"}
                  </button>
                  <ChevronDown size={14} />
                  {isDroneMenuOpen && (
                    <div className="mission-drone-menu">
                      {drones?.map((drone) => (
                        <button
                          className={idDrone === drone.idDrone ? "selected" : undefined}
                          key={drone.idDrone}
                          onClick={() => {
                            setIdDrone(drone.idDrone);
                            setFieldErrors((current) => ({ ...current, idDrone: undefined }));
                            setIsDroneMenuOpen(false);
                          }}
                          type="button"
                        >
                          {drone.name} ({drone.droneId})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldErrors.idDrone && <FieldError message={fieldErrors.idDrone} />}
              </label>

              <label>
                <span>
                  Programada para <small className="required-inline">*</small>
                </span>
                <div className={fieldErrors.scheduledAt ? "mission-date-input field-invalid" : scheduledAt ? "mission-date-input selected" : "mission-date-input"}>
                  <button
                    aria-expanded={isDatePickerOpen}
                    aria-invalid={Boolean(fieldErrors.scheduledAt)}
                    onClick={() => setIsDatePickerOpen((open) => !open)}
                    type="button"
                  >
                    {formatScheduledLabel(scheduledAt)}
                  </button>
                  <CalendarClock size={15} />
                  {isDatePickerOpen && (
                    <div className="mission-date-popover">
                      <div className="mission-calendar-panel">
                        <div className="mission-calendar-header">
                          <button
                            onClick={() => setVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                            type="button"
                            aria-label="Mes anterior"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <strong>{monthLabel(visibleDate)}</strong>
                          <button
                            onClick={() => setVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                            type="button"
                            aria-label="Mes siguiente"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                        <div className="mission-calendar-weekdays">
                          {WEEK_DAYS.map((day, index) => (
                            <span key={`${day}-${index}`}>{day}</span>
                          ))}
                        </div>
                        <div className="mission-calendar-grid">
                          {calendarDays.map((day) => (
                            <button
                              className={[
                                day.getMonth() !== visibleDate.getMonth() ? "muted" : "",
                                selectedScheduledDate && sameDay(day, selectedScheduledDate) ? "selected" : "",
                                sameDay(day, new Date()) ? "today" : ""
                              ].filter(Boolean).join(" ")}
                              key={day.toISOString()}
                              onClick={() => handleSelectDate(day)}
                              type="button"
                            >
                              {day.getDate()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mission-time-panel">
                        <span>Hora</span>
                        <input
                          aria-label="Hora"
                          className="mission-time-input"
                          onChange={(event) => handleSelectTime(event.target.value)}
                          type="time"
                          value={scheduledTimeInput}
                        />
                        <button className="mission-date-done" onClick={() => setIsDatePickerOpen(false)} type="button">
                          Listo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
