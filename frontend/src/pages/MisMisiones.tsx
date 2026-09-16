import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Box, CalendarCheck, CalendarClock, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eye, Play, Plus, RefreshCw, Route, Search, Trash2, X, XCircle } from "lucide-react";
import type { BackendFlightPlan, BackendMission, BackendMissionStatus, ManagedUser } from "../api/types";
import type { SessionUser } from "../types";
import { deleteMission, getFlightPlans, getManagedUsers, getMission, getMissions, startMission, updateMissionPilot, updateMissionSchedule } from "../api/client";
import { MissionAssetPicker } from "../components/MissionAssetPicker";
import { BragadoPlant3DMap } from "../components/BragadoPlant3DMap";
import { AppTopActions } from "../components/AppTopActions";

type MissionDisplayStatus = "Pendiente" | "Enviando al dron" | "En progreso" | "Completada" | "Cancelada" | "Fallida";

type MissionRow = {
  mission: BackendMission;
  flightPlanName: string;
  statusLabel: MissionDisplayStatus;
};

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function normalizeStatus(status: BackendMissionStatus): MissionDisplayStatus {
  if (status === "UPLOADING") return "Enviando al dron";
  if (status === "IN_PROGRESS") return "En progreso";
  if (status === "COMPLETED") return "Completada";
  if (status === "CANCELLED") return "Cancelada";
  if (status === "FAILED") return "Fallida";
  return "Pendiente";
}

function statusClass(status: MissionDisplayStatus) {
  if (status === "Enviando al dron") return "uploading";
  if (status === "En progreso") return "progress";
  if (status === "Completada") return "completed";
  if (status === "Cancelada") return "cancelled";
  if (status === "Fallida") return "failed";
  return "pending";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR");
}

function formatTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) return "Sin iniciar";
  if (!finishedAt) return "En curso";
  const minutes = Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  return `${minutes} min`;
}

function toDatetimeLocalValue(date: Date) {
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

function nextMinuteValue() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);
  return toDatetimeLocalValue(date);
}

export function MisMisionesView({
  user,
  onCreateMission,
  onGeneratePlan,
  onViewMission
}: {
  user: SessionUser;
  onCreateMission: (idFlightPlans: number[]) => void;
  onGeneratePlan: () => void;
  onViewMission: (idMission: string) => void;
}) {
  const [missions, setMissions] = useState<BackendMission[] | null>(null);
  const [flightPlans, setFlightPlans] = useState<BackendFlightPlan[]>([]);
  const [technicians, setTechnicians] = useState<ManagedUser[]>([]);
  const [flightPlansById, setFlightPlansById] = useState<Map<number, BackendFlightPlan>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailClosed, setIsDetailClosed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"Todas" | MissionDisplayStatus>("Todas");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<BackendMission | null>(null);
  const [postponeCandidate, setPostponeCandidate] = useState<BackendMission | null>(null);
  const [postponeValue, setPostponeValue] = useState("");
  const [postponeTimeInput, setPostponeTimeInput] = useState("09:00");
  const [postponeVisibleDate, setPostponeVisibleDate] = useState(() => new Date());
  const [isPostponePickerOpen, setIsPostponePickerOpen] = useState(false);
  const [postponeError, setPostponeError] = useState<string | null>(null);
  const [isPostponing, setIsPostponing] = useState(false);
  const [openPilotMissionId, setOpenPilotMissionId] = useState<string | null>(null);
  const [savingPilotMissionId, setSavingPilotMissionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [planModal, setPlanModal] = useState<"choose" | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const activePolls = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => {
      activePolls.current.forEach((timerId) => window.clearInterval(timerId));
      activePolls.current.clear();
    };
  }, []);

  const loadData = () => {
    setIsRefreshing(true);
    setLoadError(null);
    Promise.all([getMissions(), getFlightPlans(), user.role === "Jefe de Planta" ? getManagedUsers() : Promise.resolve([] as ManagedUser[])])
      .then(([missionList, flightPlans, userList]) => {
        setMissions(missionList);
        setFlightPlans(flightPlans);
        setTechnicians(userList.filter((item) => item.role === "TECNICO_MANTENIMIENTO" && item.active));
        setFlightPlansById(new Map(flightPlans.map((plan) => [plan.idFlightPlan, plan])));
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las misiones."))
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    (missions ?? [])
      .filter((mission) => mission.status === "UPLOADING" || mission.status === "IN_PROGRESS")
      .forEach((mission) => pollMissionStatus(mission.idMission));
  }, [missions]);

  const missionRows = useMemo<MissionRow[]>(
    () =>
      (missions ?? []).map((mission) => ({
        mission,
        flightPlanName: flightPlansById.get(mission.idFlightPlan)?.name ?? `Plan #${mission.idFlightPlan}`,
        statusLabel: normalizeStatus(mission.status)
      })),
    [missions, flightPlansById]
  );

  const filteredRows = missionRows.filter((row) => {
    const matchesStatus = statusFilter === "Todas" || row.statusLabel === statusFilter;
    const searchSource = `${row.mission.name} ${row.flightPlanName} ${row.mission.droneId ?? ""}`.toLowerCase();
    const matchesSearch = !searchTerm.trim() || searchSource.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const selectedRow = selectedId
    ? filteredRows.find((row) => row.mission.idMission === selectedId) ?? null
    : isDetailClosed
      ? null
      : filteredRows[0] ?? null;

  const totals = {
    all: missionRows.length,
    pending: missionRows.filter((row) => row.statusLabel === "Pendiente").length,
    active: missionRows.filter((row) => row.statusLabel === "En progreso" || row.statusLabel === "Enviando al dron").length,
    completed: missionRows.filter((row) => row.statusLabel === "Completada").length
  };

  const handleStart = async (mission: BackendMission) => {
    setStartError(null);
    setStartingId(mission.idMission);
    try {
      const updated = await startMission(mission.idMission);
      setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
      pollMissionStatus(mission.idMission);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "No se pudo iniciar la misión.");
    } finally {
      setStartingId(null);
    }
  };

  const pilotName = (username: string | null | undefined) => {
    if (!username) return "Sin asignar";
    if (username === user.username) return user.name;
    return technicians.find((technician) => technician.username === username)?.fullName ?? username;
  };

  const handleAssignPilot = async (mission: BackendMission, username: string | null) => {
    setStartError(null);
    setSavingPilotMissionId(mission.idMission);
    try {
      const updated = await updateMissionPilot(mission.idMission, username);
      setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
      setOpenPilotMissionId(null);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "No se pudo asignar el piloto.");
    } finally {
      setSavingPilotMissionId(null);
    }
  };

  const handleDelete = async (mission: BackendMission) => {
    setStartError(null);
    setDeletingId(mission.idMission);
    try {
      await deleteMission(mission.idMission);
      const timer = activePolls.current.get(mission.idMission);
      if(timer)window.clearInterval(timer);
      activePolls.current.delete(mission.idMission);
      setMissions((current) => current?.filter((item) => item.idMission !== mission.idMission) ?? current);
      if (selectedId === mission.idMission) {
        setSelectedId(null);
      }
      setDeleteCandidate(null);
      setIsDetailClosed(true);
      getMissions().then(setMissions).catch(()=>{});
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "No se pudo borrar la misión.");
    } finally {
      setDeletingId(null);
    }
  };

  const openPostponeModal = (mission: BackendMission) => {
    const minValue = nextMinuteValue();
    const currentValue = mission.scheduledAt ? toDatetimeLocalValue(new Date(mission.scheduledAt)) : minValue;
    const nextValue = currentValue >= minValue ? currentValue : minValue;
    const nextDate = new Date(nextValue);
    setPostponeCandidate(mission);
    setPostponeValue(nextValue);
    setPostponeTimeInput(nextValue.slice(11, 16));
    setPostponeVisibleDate(nextDate);
    setIsPostponePickerOpen(false);
    setPostponeError(null);
  };

  const closePostponeModal = () => {
    if (isPostponing) return;
    setPostponeCandidate(null);
    setPostponeValue("");
    setPostponeTimeInput("09:00");
    setIsPostponePickerOpen(false);
    setPostponeError(null);
  };

  const handleSelectPostponeDate = (date: Date) => {
    if (isBeforeToday(date)) return;
    const nextDate = new Date(date);
    const selectedDate = postponeValue ? new Date(postponeValue) : null;
    if (selectedDate) {
      nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    } else {
      const [hours, minutes] = /^\d{2}:\d{2}$/.test(postponeTimeInput) ? postponeTimeInput.split(":").map(Number) : [9, 0];
      nextDate.setHours(hours, minutes, 0, 0);
    }
    const minValue = nextMinuteValue();
    const nextValue = toDatetimeLocalValue(nextDate);
    const safeValue = sameDay(nextDate, new Date()) && nextValue < minValue ? minValue : nextValue;
    setPostponeValue(safeValue);
    setPostponeTimeInput(safeValue.slice(11, 16));
    setPostponeVisibleDate(new Date(safeValue));
    setPostponeError(null);
  };

  const handleSelectPostponeTime = (time: string) => {
    setPostponeTimeInput(time);
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    const [hours, minutes] = time.split(":").map(Number);
    if (hours > 23 || minutes > 59) return;
    const nextDate = postponeValue ? new Date(postponeValue) : new Date();
    nextDate.setHours(hours, minutes, 0, 0);
    setPostponeValue(toDatetimeLocalValue(nextDate));
    setPostponeVisibleDate(nextDate);
    setPostponeError(null);
  };

  const handlePostpone = async () => {
    if (!postponeCandidate) return;
    const minValue = nextMinuteValue();
    if (!postponeValue || postponeValue < minValue) {
      setPostponeError("Elegí una fecha y hora posterior al momento actual.");
      return;
    }
    setIsPostponing(true);
    setPostponeError(null);
    try {
      const updated = await updateMissionSchedule(postponeCandidate.idMission, new Date(postponeValue).toISOString());
      setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
      setPostponeCandidate(null);
      setPostponeValue("");
    } catch (error) {
      setPostponeError(error instanceof Error ? error.message : "No se pudo postergar la misión.");
    } finally {
      setIsPostponing(false);
    }
  };

  const handleOpenCreateMission = () => {
    setSelectedPlanIds([]);
    setPlanModal("choose");
  };

  const handleContinuePlan = () => {
    if (selectedPlanIds.length === 0) return;
    setPlanModal(null);
    onCreateMission(selectedPlanIds);
  };

  const pollMissionStatus = (idMission: string) => {
    if (activePolls.current.has(idMission)) return;

    const timerId = window.setInterval(() => {
      getMission(idMission)
        .then((updated) => {
          setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
          if (updated.status !== "UPLOADING" && updated.status !== "IN_PROGRESS") {
            window.clearInterval(timerId);
            activePolls.current.delete(idMission);
          }
        })
        .catch(() => {
          window.clearInterval(timerId);
          activePolls.current.delete(idMission);
        });
    }, 2000);
    activePolls.current.set(idMission, timerId);
  };

  return (
    <section className="missions-dashboard">
      <header className="missions-topbar">
        <div>
          <h1>Misiones</h1>
          <p>Gestiona y monitorea las misiones de inspección.</p>
        </div>
        <AppTopActions />
      </header>

      <section className="missions-summary-row">
        <MissionSummaryCard icon={<CalendarCheck size={22} />} label="Total misiones" tone="green" value={totals.all} />
        <MissionSummaryCard icon={<Clock3 size={22} />} label="Pendientes" tone="amber" value={totals.pending} />
        <MissionSummaryCard icon={<Play size={22} />} label="En progreso" tone="blue" value={totals.active} />
        <MissionSummaryCard icon={<CheckCircle2 size={22} />} label="Completadas" tone="green" value={totals.completed} />
        <button className="missions-generate-plan-button" onClick={onGeneratePlan} type="button">
          <Route size={18} />
          Generar plan desde recorrido
        </button>
        <button className="missions-new-button" onClick={handleOpenCreateMission} type="button">
          <Plus size={18} />
          Nueva Misión
        </button>
      </section>

      {loadError && (
        <p className="mission-empty">
          <AlertCircle size={16} aria-hidden="true" /> {loadError}
        </p>
      )}

      {startError && !startingId && (
        <p className="mission-empty">
          <AlertCircle size={16} aria-hidden="true" /> {startError}
        </p>
      )}

      {missions === null && !loadError && <p className="mission-empty">Cargando misiones...</p>}

      {missions !== null && !loadError && (
        <section className={selectedRow ? "missions-content-grid" : "missions-content-grid missions-content-grid-empty"}>
          <article className="missions-list-card">
            <div className="missions-list-toolbar">
              <div className="missions-filters" aria-label="Filtro de misiones">
                <button className={statusFilter === "Todas" ? "active" : undefined} onClick={() => setStatusFilter("Todas")} type="button">
                  Todas
                </button>
                <div className={statusFilter === "Todas" ? "missions-status-filter" : "missions-status-filter selected"}>
                  <button onClick={() => setIsStatusMenuOpen((open) => !open)} type="button">
                    {statusFilter === "Todas" ? "Filtrar por estado" : statusFilter}
                  </button>
                  <ChevronDown size={14} />
                  {isStatusMenuOpen && (
                    <div className="missions-status-menu">
                      {(["Todas", "Pendiente", "Enviando al dron", "En progreso", "Completada", "Cancelada", "Fallida"] as const).map((option) => (
                        <button
                          className={statusFilter === option ? "selected" : undefined}
                          key={option}
                          onClick={() => {
                            setStatusFilter(option);
                            setIsStatusMenuOpen(false);
                          }}
                          type="button"
                        >
                          {option === "Todas" ? "Filtrar por estado" : option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="missions-toolbar-actions">
                <label className="missions-search">
                  <Search size={15} />
                  <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar misión..." value={searchTerm} />
                </label>
                <button className="mission-refresh-button" disabled={isRefreshing} onClick={loadData} title="Actualizar" type="button" aria-label="Actualizar">
                  <RefreshCw size={16} className={isRefreshing ? "spin" : undefined} />
                </button>
              </div>
            </div>

            <div className="missions-table-wrap">
              <table className="missions-table">
                <thead>
                  <tr>
                    <th>Misión</th>
                    <th>Plan de vuelo</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Piloto asignado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr className="mission-empty-row">
                      <td colSpan={6}>
                        {missions.length === 0
                          ? 'No hay misiones creadas todavía. Empezá por crear una desde "Nueva misión".'
                          : "No hay misiones que coincidan con el filtro seleccionado."}
                      </td>
                    </tr>
                  )}

                  {filteredRows.map(({ mission, flightPlanName, statusLabel }) => (
                    <tr
                      className={selectedRow?.mission.idMission === mission.idMission ? "selected" : undefined}
                      key={mission.idMission}
                      onClick={() => {
                        setSelectedId(mission.idMission);
                        setIsDetailClosed(false);
                      }}
                    >
                      <td>
                        <strong>{mission.name}</strong>
                        <small>{mission.idMission.slice(0, 8)}</small>
                      </td>
                      <td>
                        <strong>{flightPlanName}</strong>
                        <small>{mission.objective || "Inspección"}</small>
                      </td>
                      <td>
                        <span>{formatDate(mission.scheduledAt)}</span>
                        <small>{formatTime(mission.scheduledAt)}</small>
                      </td>
                      <td>
                        <span className={`mission-state ${statusClass(statusLabel)}`}>{statusLabel}</span>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        {user.role === "Jefe de Planta" ? (
                          <div className={mission.assignedPilotUsername ? "mission-pilot-select selected" : "mission-pilot-select"}>
                            <button
                              disabled={savingPilotMissionId === mission.idMission}
                              onClick={() => setOpenPilotMissionId((current) => current === mission.idMission ? null : mission.idMission)}
                              type="button"
                            >
                              {savingPilotMissionId === mission.idMission ? "Guardando..." : pilotName(mission.assignedPilotUsername)}
                            </button>
                            <ChevronDown size={14} />
                            {openPilotMissionId === mission.idMission && (
                              <div className="missions-status-menu mission-pilot-menu">
                                <button
                                  className={!mission.assignedPilotUsername ? "selected" : undefined}
                                  onClick={() => void handleAssignPilot(mission, null)}
                                  type="button"
                                >
                                  Sin asignar
                                </button>
                                {technicians.map((technician) => (
                                  <button
                                    className={mission.assignedPilotUsername === technician.username ? "selected" : undefined}
                                    key={technician.username}
                                    onClick={() => void handleAssignPilot(mission, technician.username)}
                                    type="button"
                                  >
                                    {technician.fullName}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          pilotName(mission.assignedPilotUsername)
                        )}
                      </td>
                      <td>
                        <div className="mission-row-actions">
                          <button
                            className="mission-view-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onViewMission(mission.idMission);
                            }}
                            title="Ver misión"
                            type="button"
                            aria-label="Ver misión"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="mission-delete-button"
                            disabled={deletingId === mission.idMission}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteCandidate(mission);
                            }}
                            title="Borrar misión"
                            type="button"
                            aria-label="Borrar misión"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="missions-table-footer">
              <span>
                {missions.length === 0 ? "Mostrando 0 de 0 misiones" : `Mostrando ${filteredRows.length} de ${missionRows.length} misiones`}
              </span>
            </div>

          </article>

          {selectedRow && (
            <aside className="mission-detail-card">
              <div className="mission-detail-header">
                <div>
                  <h2>{selectedRow.mission.name}</h2>
                  <div className="mission-detail-id">
                    <span className={`mission-state ${statusClass(selectedRow.statusLabel)}`}>{selectedRow.statusLabel}</span>
                    <small>{selectedRow.mission.idMission.slice(0, 8)}</small>
                  </div>
                </div>
                <button
                  className="mission-detail-close"
                  onClick={() => {
                    setSelectedId(null);
                    setIsDetailClosed(true);
                  }}
                  type="button"
                  aria-label="Cerrar detalle"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="mission-detail-map">
                <BragadoPlant3DMap assets={[]} playback={{id:selectedRow.mission.idMission,status:selectedRow.mission.status,telemetry:null,
                  points:
                    selectedRow.mission.missionWaypoints?.length
                      ? selectedRow.mission.missionWaypoints
                      : flightPlansById.get(selectedRow.mission.idFlightPlan)?.route ?? []
                  }}
                />
              </div>

              <div className="mission-detail-grid">
                <MissionInfo label="Plan de vuelo" value={selectedRow.flightPlanName} />
                <MissionInfo label="Dron" value={selectedRow.mission.droneId ?? "--"} />
                <MissionInfo label="Fecha y hora" value={`${formatDate(selectedRow.mission.scheduledAt)} - ${formatTime(selectedRow.mission.scheduledAt)}`} />
                <MissionInfo label="Duración" value={formatDuration(selectedRow.mission.startedAt, selectedRow.mission.finishedAt)} />
                <MissionInfo label="Objetivo" value={selectedRow.mission.objective || "-"} />
                <MissionInfo label="Puntos seleccionados" value={`${selectedRow.mission.selectedPlanWaypointIds?.length ?? 0} puntos`} />
              </div>

              {selectedRow.mission.status === "IN_PROGRESS" && (
                <div className="mission-progress-box">
                  <div>
                    <strong>Progreso de la misión</strong>
                    <span>{selectedRow.mission.completionPercentage}%</span>
                  </div>
                  <div className="mission-progress-track">
                    <i style={{ width: `${selectedRow.mission.completionPercentage}%` }} />
                  </div>
                </div>
              )}

              {selectedRow.mission.status !== "IN_PROGRESS" && (
              <div className="mission-quick-actions">
                <h3>Acciones rápidas</h3>

                {startError && selectedRow.mission.idMission === startingId && (
                  <p className="mission-empty">
                    <AlertCircle size={16} aria-hidden="true" /> {startError}
                  </p>
                )}

                {selectedRow.mission.status === "PLANNED" && (
                  <div className="mission-actions-row">
                    <button
                      className="mission-action start"
                      disabled={startingId === selectedRow.mission.idMission}
                      onClick={() => handleStart(selectedRow.mission)}
                      type="button"
                    >
                      <Play size={14} />
                      {startingId === selectedRow.mission.idMission ? "Iniciando..." : "Iniciar"}
                    </button>
                    <button className="mission-action postpone" onClick={() => openPostponeModal(selectedRow.mission)} type="button">Postergar</button>
                    <button className="mission-action cancel" type="button">
                      <XCircle size={14} />
                      Cancelar
                    </button>
                  </div>
                )}

                {selectedRow.mission.status === "UPLOADING" && (
                  <p className="mission-waiting-text">Esperando confirmación del dron...</p>
                )}

              </div>
              )}
            </aside>
          )}
        </section>
      )}

      {planModal && (
        <div className="mission-plan-modal-backdrop" role="presentation">
          <section className="mission-plan-modal mission-asset-modal" role="dialog" aria-modal="true">
            <button className="mission-plan-modal-close" onClick={() => setPlanModal(null)} type="button" aria-label="Cerrar">
              <X size={16} />
            </button>
            <div className="mission-plan-modal-header">
              <span className="mission-plan-modal-icon" aria-hidden="true">
                <Box size={20} />
              </span>
              <h2>Seleccionar activos</h2>
            </div>
            <div className="mission-plan-modal-divider" />

            <MissionAssetPicker
              plans={flightPlans}
              selectedPlanIds={selectedPlanIds}
              onSelect={(selectedPlans) => setSelectedPlanIds(selectedPlans.map((plan) => plan.idFlightPlan))}
            />

            <div className="mission-plan-modal-footer">
              <button className="mission-plan-modal-primary" disabled={selectedPlanIds.length === 0} onClick={handleContinuePlan} type="button">
                Continuar
              </button>
            </div>
          </section>
        </div>
      )}

      {deleteCandidate && (
        <div className="modal-backdrop profile-delete-modal-backdrop" role="presentation">
          <section aria-modal="true" className="profile-delete-modal mission-delete-modal" role="dialog">
            <div className="profile-delete-modal-icon">
              <Trash2 size={26} />
            </div>
            <h2>Eliminar misión</h2>
            <p>
              ¿Está seguro de que desea eliminar la misión "{deleteCandidate.name}"?<br />
              Esta acción no se puede deshacer.
            </p>
            <div className="profile-delete-modal-actions">
              <button className="profile-delete-modal-secondary" onClick={() => setDeleteCandidate(null)} type="button">
                Cancelar
              </button>
              <button
                className="profile-delete-modal-primary"
                disabled={deletingId === deleteCandidate.idMission}
                onClick={() => void handleDelete(deleteCandidate)}
                type="button"
              >
                {deletingId === deleteCandidate.idMission ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </section>
        </div>
      )}

      {postponeCandidate && (
        <div className="modal-backdrop profile-delete-modal-backdrop" role="presentation">
          <section aria-modal="true" className="mission-postpone-modal" role="dialog">
            <button className="mission-plan-modal-close" onClick={closePostponeModal} type="button" aria-label="Cerrar">
              <X size={16} />
            </button>
            <span className="mission-postpone-icon" aria-hidden="true">
              <CalendarClock size={24} />
            </span>
            <h2>Postergar misión</h2>
            <p>Elegí una nueva fecha y hora para <strong>{postponeCandidate.name}</strong>.</p>
            <label className="mission-postpone-field">
              <span>Nueva fecha y hora</span>
              <div className="mission-date-input selected mission-postpone-date-input">
                <button
                  aria-expanded={isPostponePickerOpen}
                  onClick={() => setIsPostponePickerOpen((open) => !open)}
                  type="button"
                >
                  {formatScheduledLabel(postponeValue)}
                </button>
                <CalendarClock size={15} />
                {isPostponePickerOpen && (
                  <div className="mission-date-popover">
                    <div className="mission-calendar-panel">
                      <div className="mission-calendar-header">
                        <button
                          aria-label="Mes anterior"
                          onClick={() => setPostponeVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                          type="button"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <strong>{monthLabel(postponeVisibleDate)}</strong>
                        <button
                          aria-label="Mes siguiente"
                          onClick={() => setPostponeVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                          type="button"
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
                        {buildCalendarDays(postponeVisibleDate).map((day) => {
                          const disabled = isBeforeToday(day);
                          const selectedDate = postponeValue ? new Date(postponeValue) : null;
                          return (
                            <button
                              className={[
                                day.getMonth() !== postponeVisibleDate.getMonth() ? "muted" : "",
                                selectedDate && sameDay(day, selectedDate) ? "selected" : "",
                                sameDay(day, new Date()) ? "today" : "",
                                disabled ? "disabled" : ""
                              ].filter(Boolean).join(" ")}
                              disabled={disabled}
                              key={day.toISOString()}
                              onClick={() => handleSelectPostponeDate(day)}
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
                        onChange={(event) => handleSelectPostponeTime(event.target.value)}
                        type="time"
                        value={postponeTimeInput}
                      />
                      <button className="mission-date-done" onClick={() => setIsPostponePickerOpen(false)} type="button">
                        Listo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </label>
            {postponeError && <p className="mission-postpone-error" role="alert">{postponeError}</p>}
            <div className="profile-delete-modal-actions">
              <button className="profile-delete-modal-secondary" disabled={isPostponing} onClick={closePostponeModal} type="button">
                Cancelar
              </button>
              <button className="profile-delete-modal-primary" disabled={isPostponing || !postponeValue || postponeValue < nextMinuteValue()} onClick={() => void handlePostpone()} type="button">
                {isPostponing ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function MissionSummaryCard({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: "green" | "amber" | "blue"; value: number }) {
  return (
    <article className="missions-summary-card">
      <span className={`missions-summary-icon ${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function MissionInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="mission-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
