import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Box, CalendarCheck, CheckCircle2, Clock3, Database, Eye, Play, Plus, RefreshCw, Route, Search, Trash2, X, XCircle } from "lucide-react";
import type { BackendFlightPlan, BackendMission, BackendMissionStatus } from "../api/types";
import { getFlightPlans, getMission, getMissions, seedDemoData, startMission } from "../api/client";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { AppTopActions } from "../components/AppTopActions";

type MissionDisplayStatus = "Pendiente" | "Enviando al dron" | "En progreso" | "Completada" | "Cancelada" | "Fallida";

type MissionRow = {
  mission: BackendMission;
  flightPlanName: string;
  statusLabel: MissionDisplayStatus;
};

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

export function MisMisionesView({
  onCreateMission,
  onGeneratePlan,
  onViewMission
}: {
  onCreateMission: (idFlightPlan: number) => void;
  onGeneratePlan: () => void;
  onViewMission: (idMission: string) => void;
}) {
  const [missions, setMissions] = useState<BackendMission[] | null>(null);
  const [flightPlans, setFlightPlans] = useState<BackendFlightPlan[]>([]);
  const [flightPlansById, setFlightPlansById] = useState<Map<number, BackendFlightPlan>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailClosed, setIsDetailClosed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"Todas" | MissionDisplayStatus>("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [planModal, setPlanModal] = useState<"seed" | "choose" | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
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
    Promise.all([getMissions(), getFlightPlans()])
      .then(([missionList, flightPlans]) => {
        setMissions(missionList);
        setFlightPlans(flightPlans);
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
      .filter((mission) => mission.status === "UPLOADING")
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
      setStartError(error instanceof Error ? error.message : "No se pudo iniciar la mision.");
    } finally {
      setStartingId(null);
    }
  };

  const handleOpenCreateMission = () => {
    setSeedError(null);
    setSelectedPlanId(null);
    setPlanModal(flightPlans.length > 0 ? "choose" : "seed");
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedError(null);
    try {
      await seedDemoData();
      const nextPlans = await getFlightPlans();
      setFlightPlans(nextPlans);
      setFlightPlansById(new Map(nextPlans.map((plan) => [plan.idFlightPlan, plan])));
      setSelectedPlanId(nextPlans[0]?.idFlightPlan ?? null);
      setPlanModal("choose");
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "No se pudieron cargar los datos de prueba.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleContinuePlan = () => {
    if (selectedPlanId == null) return;
    setPlanModal(null);
    onCreateMission(selectedPlanId);
  };

  const pollMissionStatus = (idMission: string) => {
    if (activePolls.current.has(idMission)) return;

    let attempts = 0;
    const timerId = window.setInterval(() => {
      attempts += 1;
      getMission(idMission)
        .then((updated) => {
          setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
          if (updated.status !== "UPLOADING" || attempts >= 300) {
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
          <p>Gestiona y monitorea las misiones de inspeccion.</p>
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
          Nueva Mision
        </button>
      </section>

      {loadError && (
        <p className="mission-empty">
          <AlertCircle size={16} aria-hidden="true" /> {loadError}
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
                <label className="missions-status-filter">
                  <select onChange={(event) => setStatusFilter(event.target.value as "Todas" | MissionDisplayStatus)} value={statusFilter}>
                    <option value="Todas">Filtrar por estado</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Enviando al dron">Enviando al dron</option>
                    <option value="En progreso">En progreso</option>
                    <option value="Completada">Completada</option>
                    <option value="Cancelada">Cancelada</option>
                    <option value="Fallida">Fallida</option>
                  </select>
                </label>
              </div>

              <div className="missions-toolbar-actions">
                <label className="missions-search">
                  <Search size={15} />
                  <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar mision..." value={searchTerm} />
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
                    <th>Mision</th>
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
                          ? 'No hay misiones creadas todavia. Empeza por crear una desde "Nueva mision".'
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
                        <small>{mission.objective || "Inspeccion"}</small>
                      </td>
                      <td>
                        <span>{formatDate(mission.scheduledAt)}</span>
                        <small>{formatTime(mission.scheduledAt)}</small>
                      </td>
                      <td>
                        <span className={`mission-state ${statusClass(statusLabel)}`}>{statusLabel}</span>
                      </td>
                      <td>Emilia Andersen</td>
                      <td>
                        <div className="mission-row-actions">
                          <button
                            className="mission-view-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onViewMission(mission.idMission);
                            }}
                            title="Ver mision"
                            type="button"
                            aria-label="Ver mision"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="mission-delete-button"
                            disabled
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            title="Borrado no disponible"
                            type="button"
                            aria-label="Borrar mision"
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
                <MissionDetailRouteMap points={selectedRow.mission.missionWaypoints ?? flightPlansById.get(selectedRow.mission.idFlightPlan)?.route ?? []} />
              </div>

              <div className="mission-detail-grid">
                <MissionInfo label="Plan de vuelo" value={selectedRow.flightPlanName} />
                <MissionInfo label="Dron" value={selectedRow.mission.droneId ?? "--"} />
                <MissionInfo label="Fecha y hora" value={`${formatDate(selectedRow.mission.scheduledAt)} - ${formatTime(selectedRow.mission.scheduledAt)}`} />
                <MissionInfo label="Duracion" value={formatDuration(selectedRow.mission.startedAt, selectedRow.mission.finishedAt)} />
                <MissionInfo label="Objetivo" value={selectedRow.mission.objective || "-"} />
                <MissionInfo label="Puntos seleccionados" value={`${selectedRow.mission.selectedPlanWaypointIds?.length ?? 0} puntos`} />
              </div>

              {selectedRow.mission.status === "IN_PROGRESS" && (
                <div className="mission-progress-box">
                  <div>
                    <strong>Progreso de la mision</strong>
                    <span>{selectedRow.mission.completionPercentage}%</span>
                  </div>
                  <div className="mission-progress-track">
                    <i style={{ width: `${selectedRow.mission.completionPercentage}%` }} />
                  </div>
                </div>
              )}

              {selectedRow.mission.status !== "IN_PROGRESS" && (
              <div className="mission-quick-actions">
                <h3>Acciones rapidas</h3>

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
                    <button className="mission-action postpone" type="button">Postergar</button>
                    <button className="mission-action cancel" type="button">
                      <XCircle size={14} />
                      Cancelar
                    </button>
                  </div>
                )}

                {selectedRow.mission.status === "UPLOADING" && (
                  <p className="mission-empty">Esperando confirmacion del dron...</p>
                )}

              </div>
              )}
            </aside>
          )}
        </section>
      )}

      {planModal && (
        <div className="mission-plan-modal-backdrop" role="presentation">
          <section className="mission-plan-modal" role="dialog" aria-modal="true">
            <button className="mission-plan-modal-close" onClick={() => setPlanModal(null)} type="button" aria-label="Cerrar">
              <X size={16} />
            </button>
            <div className="mission-plan-modal-header">
              <span className="mission-plan-modal-icon" aria-hidden="true">
                {planModal === "seed" ? <Database size={20} /> : <Box size={20} />}
              </span>
              <h2>{planModal === "seed" ? "Cargar datos de prueba" : "Elegir plan de vuelo"}</h2>
            </div>
            <div className="mission-plan-modal-divider" />

            {planModal === "seed" ? (
              <div className="mission-plan-modal-body">
                <p>Apreta el boton cargar para subir los datos de prueba.</p>
                {seedError && <p className="mission-plan-modal-error">{seedError}</p>}
              </div>
            ) : (
              <div className="mission-plan-list" role="radiogroup" aria-label="Planes de vuelo">
                {flightPlans.map((plan) => (
                  <button
                    className={selectedPlanId === plan.idFlightPlan ? "mission-plan-row selected" : "mission-plan-row"}
                    key={plan.idFlightPlan}
                    onClick={() => setSelectedPlanId(plan.idFlightPlan)}
                    type="button"
                    role="radio"
                    aria-checked={selectedPlanId === plan.idFlightPlan}
                  >
                    <span>{plan.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mission-plan-modal-footer">
              {planModal === "seed" ? (
                <button className="mission-plan-modal-primary" disabled={isSeeding} onClick={handleSeed} type="button">
                  {isSeeding ? "Cargando..." : "Cargar"}
                </button>
              ) : (
                <button className="mission-plan-modal-primary" disabled={selectedPlanId == null} onClick={handleContinuePlan} type="button">
                  Continuar
                </button>
              )}
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
