import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, CalendarClock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { BackendFlightPlan, BackendDrone, BackendDroneStatus } from "../api/types";
import { getFlightPlans, getDrones, getDroneStatuses, createFlightPlan, createMission, createMissionSchedule } from "../api/client";
import { FieldError } from "../components/FieldError";
import { MissionAssetPicker } from "../components/MissionAssetPicker";
import { AppTopActions } from "../components/AppTopActions";

import { photoCountForWaypoint } from "../utils/missionPhotos";
import { buildCombinedFlightPlan } from "../utils/missionPlanComposer";
import { availableMissionDistanceMeters, estimateMissionDistanceMeters, formatMissionDistance, missionReservePct } from "../utils/missionAutonomy";

type RecurrenceMode = "once" | "daily" | "weekly";
type FieldErrors = Partial<Record<"name" | "idDrone" | "scheduledAt" | "weekDays", string>>;

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEK_DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isBeforeToday(date: Date) {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime();
}

// Los activos que tienen una parada en el plan, sin repetir y en el orden en que se visitan.
function pointOfInterestAssetIds(plan: BackendFlightPlan) {
  return [...new Set(
    [...plan.route]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((point) => point.pointOfInterest && point.idAsset != null)
      .map((point) => point.idAsset as number)
  )];
}

export function ConfigurarMisionView({
  initialFlightPlanIds,
  onBack,
  onViewMissions
}: {
  initialFlightPlanIds?: number[];
  onBack: () => void;
  onViewMissions: () => void;
}) {
  const [flightPlans, setFlightPlans] = useState<BackendFlightPlan[] | null>(null);
  const [flightPlansError, setFlightPlansError] = useState<string | null>(null);
  const [hasAppliedInitialPlan, setHasAppliedInitialPlan] = useState(false);

  const [drones, setDrones] = useState<BackendDrone[] | null>(null);
  const [dronesError, setDronesError] = useState<string | null>(null);
  const [droneStatuses, setDroneStatuses] = useState<BackendDroneStatus[]>([]);

  const [selectedFlightPlans, setSelectedFlightPlans] = useState<BackendFlightPlan[]>([]);
  // Sólo con un plan fijo (el que se acaba de generar desde un recorrido): los activos del plan que
  // el usuario sacó de esta misión. Se guardan los excluidos y no los elegidos para que, sin tocar
  // nada, queden todos elegidos sin depender de cuándo terminó de cargar el plan.
  const [excludedAssetIds, setExcludedAssetIds] = useState<number[]>([]);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [idDrone, setIdDrone] = useState("");
  const [isDroneMenuOpen, setIsDroneMenuOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledTimeInput, setScheduledTimeInput] = useState("09:00");
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>("once");
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [visibleDate, setVisibleDate] = useState(() => new Date());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successKind, setSuccessKind] = useState<"mission" | "schedule">("mission");

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
    getDroneStatuses()
      .then(setDroneStatuses)
      .catch(() => setDroneStatuses([]));
  }, []);

  useEffect(() => {
    setHasAppliedInitialPlan(false);
  }, [initialFlightPlanIds]);

  useEffect(() => {
    if (hasAppliedInitialPlan || !initialFlightPlanIds?.length || selectedFlightPlans.length > 0 || !flightPlans?.length) return;
    const initialPlans = initialFlightPlanIds
      .map((id) => flightPlans.find((plan) => plan.idFlightPlan === id))
      .filter((plan): plan is BackendFlightPlan => Boolean(plan));
    if (initialPlans.length) {
      setSelectedFlightPlans(initialPlans);
      setHasAppliedInitialPlan(true);
    }
  }, [hasAppliedInitialPlan, initialFlightPlanIds, flightPlans, selectedFlightPlans.length]);

  // Se llega con un único plan ya elegido (Generar plan -> "Ir a configurar misión"): la ruta no se
  // cambia, se eligen los activos de ese plan en los que se para.
  const fixedPlan = initialFlightPlanIds?.length === 1 && selectedFlightPlans.length === 1 ? selectedFlightPlans[0] : null;
  const fixedPlanAssetIds = fixedPlan ? pointOfInterestAssetIds(fixedPlan) : [];
  const inspectedAssetIds = fixedPlanAssetIds.filter((idAsset) => !excludedAssetIds.includes(idAsset));

  const isInspectedStop = (point: BackendFlightPlan["route"][number]) =>
    point.pointOfInterest && (!fixedPlan || (point.idAsset != null && inspectedAssetIds.includes(point.idAsset)));

  const handleToggleInspectedAsset = (idAsset: number) => {
    setExcludedAssetIds((current) =>
      current.includes(idAsset) ? current.filter((id) => id !== idAsset) : [...current, idAsset]
    );
  };

  const totalPhotoCount = selectedFlightPlans
    .flatMap((plan) => plan.route)
    .filter(isInspectedStop)
    .reduce((total, point) => total + photoCountForWaypoint(point), 0);
  const inspectedAssetCount = fixedPlan ? inspectedAssetIds.length : selectedFlightPlans.length;

  const selectedDrone = drones?.find((drone) => drone.idDrone === idDrone) ?? null;
  const selectedDroneStatus = selectedDrone
    ? droneStatuses.find((status) => status.droneId === selectedDrone.droneId) ?? null
    : null;
  const routeDistanceMeters = estimateMissionDistanceMeters(selectedFlightPlans);
  const routeReservePct = missionReservePct(selectedFlightPlans);
  const availableDistanceMeters = availableMissionDistanceMeters(selectedDroneStatus?.battery?.percentage, routeReservePct);
  const routeExceedsBattery = selectedFlightPlans.length > 0 && routeDistanceMeters > availableDistanceMeters;
  const batteryLabel = selectedDroneStatus?.battery
    ? `${selectedDroneStatus.battery.percentage}%`
    : "sin telemetría, se calcula con batería completa";
  const selectedScheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const calendarDays = buildCalendarDays(visibleDate);

  const handleSelectDate = (date: Date) => {
    if (isBeforeToday(date)) return;
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

  const resetForm = () => {
    setSelectedFlightPlans([]);
    setExcludedAssetIds([]);

    setName("");
    setObjective("");
    setIdDrone("");
    setScheduledAt("");
    setScheduledTimeInput("09:00");
    setRecurrenceMode("once");
    setSelectedWeekDays([]);
    setFieldErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFlightPlans.length === 0 || (fixedPlan && inspectedAssetIds.length === 0)) { setSubmitError("Seleccioná al menos un activo para continuar"); return; }

    setSubmitError(null);

    const nextFieldErrors: FieldErrors = {};
    if (!name.trim()) nextFieldErrors.name = "Ingrese un nombre para la misión.";
    if (!idDrone) nextFieldErrors.idDrone = "Seleccione un dron.";
    if (recurrenceMode === "once" && !scheduledAt) nextFieldErrors.scheduledAt = "Seleccione fecha y hora programada.";
    if (recurrenceMode === "once" && scheduledAt && isBeforeToday(new Date(scheduledAt))) nextFieldErrors.scheduledAt = "No se pueden programar misiones en días anteriores.";
    if (recurrenceMode === "weekly" && selectedWeekDays.length === 0) nextFieldErrors.weekDays = "Seleccione al menos un día de la semana.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    if (routeExceedsBattery) {
      setSubmitError(
        `La misión recorre ${formatMissionDistance(routeDistanceMeters)} y el dron seleccionado tiene autonomía disponible para ${formatMissionDistance(availableDistanceMeters)}. Quitá activos o elegí un dron con más batería.`
      );
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const missionPlan = selectedFlightPlans.length === 1
        ? selectedFlightPlans[0]
        : await createFlightPlan(buildCombinedFlightPlan(selectedFlightPlans, name.trim()));
      const missionWaypointIds = missionPlan.route
        .filter(isInspectedStop)
        .map((point) => point.idPlanWaypoint);
      if (recurrenceMode === "once") {
        await createMission({
          idFlightPlan: missionPlan.idFlightPlan,
          name: name.trim(),
          objective: objective.trim(),
          idDrone,
          scheduledAt: new Date(scheduledAt).toISOString(),
          selectedPlanWaypointIds: missionWaypointIds
        });
        setSuccessKind("mission");
      } else {
        await createMissionSchedule({
          idFlightPlan: missionPlan.idFlightPlan,
          name: name.trim(),
          objective: objective.trim(),
          idDrone,
          frequency: recurrenceMode === "daily" ? "DAILY" : "WEEKLY",
          scheduledTime: `${scheduledTimeInput}:00`,
          weekDays: recurrenceMode === "weekly" ? selectedWeekDays : [],
          selectedPlanWaypointIds: missionWaypointIds
        });
        setSuccessKind("schedule");
      }
      setIsSuccessOpen(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear la misión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="missions-dashboard mission-configure-dashboard">
      <header className="missions-topbar">
        <div className="configure-title-row">
          <button className="monitor-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>Configurar misión</h1>
          </div>
        </div>
        <AppTopActions />
      </header>

      {flightPlansError && <p className="mission-empty" role="alert">{flightPlansError}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mission-builder-grid">
            <article className="mission-detail-card mission-builder-map mission-builder-map-3d">
              <MissionAssetPicker
                plans={flightPlans ?? []}
                selectedPlanIds={selectedFlightPlans.map((plan) => plan.idFlightPlan)}
                onSelect={setSelectedFlightPlans}
                locked={Boolean(initialFlightPlanIds?.length)}
                batteryPercentage={selectedDroneStatus?.battery?.percentage}
                planAssetSelection={fixedPlan ? {
                  selectableIds: fixedPlanAssetIds,
                  selectedIds: inspectedAssetIds,
                  onToggle: handleToggleInspectedAsset
                } : undefined}
              />
              {fixedPlan && (
                <p className="map-field-label">
                  Plan "{fixedPlan.name}"{fixedPlan.sourceRecordingId != null ? `, generado desde el recorrido #${fixedPlan.sourceRecordingId}` : ""}.
                  El dron vuela el recorrido completo y para sólo en los activos que elijas (los grises no están en el plan).
                </p>
              )}
              {selectedFlightPlans.length > 0 && (
                <p className={routeExceedsBattery ? "map-field-label mission-route-budget exceeded" : "map-field-label mission-route-budget"}>
                  {inspectedAssetCount} {inspectedAssetCount === 1 ? "activo" : "activos"} · {totalPhotoCount} fotos previstas · {formatMissionDistance(routeDistanceMeters)}
                </p>
              )}
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

              <div className={routeExceedsBattery ? "mission-battery-check exceeded" : "mission-battery-check"}>
                <span>Autonomía estimada</span>
                <strong>{formatMissionDistance(routeDistanceMeters)} / {formatMissionDistance(availableDistanceMeters)}</strong>
                <small>Batería: {batteryLabel} · reserva mínima {routeReservePct}%</small>
              </div>

              <label>
                <span>
                  Tipo de programación <small className="required-inline">*</small>
                </span>
                <div className="mission-recurrence-control" role="group" aria-label="Tipo de programación">
                  {([
                    ["once", "Única vez"],
                    ["daily", "Diaria"],
                    ["weekly", "Semanal"]
                  ] as const).map(([mode, label]) => (
                    <button
                      className={recurrenceMode === mode ? "selected" : undefined}
                      key={mode}
                      onClick={() => {
                        setRecurrenceMode(mode);
                        setFieldErrors((current) => ({ ...current, scheduledAt: undefined, weekDays: undefined }));
                      }}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>

              <label>
                <span>
                  {recurrenceMode === "once" ? "Programada para" : "Hora programada"} <small className="required-inline">*</small>
                </span>
                {recurrenceMode === "once" ? (
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
                          {calendarDays.map((day) => {
                            const disabled = isBeforeToday(day);
                            return (
                              <button
                                className={[
                                  day.getMonth() !== visibleDate.getMonth() ? "muted" : "",
                                  selectedScheduledDate && sameDay(day, selectedScheduledDate) ? "selected" : "",
                                  sameDay(day, new Date()) ? "today" : "",
                                  disabled ? "disabled" : ""
                                ].filter(Boolean).join(" ")}
                                disabled={disabled}
                                key={day.toISOString()}
                                onClick={() => handleSelectDate(day)}
                                type="button"
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
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
                ) : (
                  <input
                    aria-label="Hora programada"
                    className="mission-time-only-input"
                    onChange={(event) => handleSelectTime(event.target.value)}
                    type="time"
                    value={scheduledTimeInput}
                  />
                )}
                {fieldErrors.scheduledAt && <FieldError message={fieldErrors.scheduledAt} />}
              </label>

              {recurrenceMode === "weekly" && (
                <label>
                  <span>
                    Días de la semana <small className="required-inline">*</small>
                  </span>
                  <div className={fieldErrors.weekDays ? "mission-weekday-picker field-invalid" : "mission-weekday-picker"}>
                    {WEEK_DAY_NAMES.map((dayName, index) => {
                      const dayValue = index + 1;
                      const selected = selectedWeekDays.includes(dayValue);
                      return (
                        <button
                          className={selected ? "selected" : undefined}
                          key={dayName}
                          onClick={() => {
                            setSelectedWeekDays((current) =>
                              selected
                                ? current.filter((day) => day !== dayValue)
                                : [...current, dayValue].sort((a, b) => a - b)
                            );
                            setFieldErrors((current) => ({ ...current, weekDays: undefined }));
                          }}
                          type="button"
                        >
                          {dayName}
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrors.weekDays && <FieldError message={fieldErrors.weekDays} />}
                </label>
              )}

              {submitError && (
                <p className="mission-empty">
                  <AlertCircle size={16} aria-hidden="true" /> {submitError}
                </p>
              )}

              <div className="form-actions">
                <button className="configure-create mission-builder-submit" disabled={isSubmitting || selectedFlightPlans.length === 0 || routeExceedsBattery} type="submit">
                  <Save size={15} aria-hidden="true" />
                  {isSubmitting ? "Creando..." : "Crear misión"}
                </button>
              </div>
            </article>
          </div>
        </form>

      {isSuccessOpen && (
        <MissionSuccessModal
          kind={successKind}
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

function MissionSuccessModal({ kind, onGoHome, onViewMissions }: { kind: "mission" | "schedule"; onGoHome: () => void; onViewMissions: () => void }) {
  const isSchedule = kind === "schedule";
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <CheckCircle2 size={48} aria-hidden="true" />
        </div>
        <h2>{isSchedule ? "Programación creada" : "Misión creada"}</h2>
        <p>{isSchedule ? "La rutina se creó correctamente y generará la misión un día antes del vuelo." : "La misión se creó correctamente y quedó planificada."}</p>
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
