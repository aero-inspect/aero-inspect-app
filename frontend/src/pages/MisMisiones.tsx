import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CalendarCheck, CheckCircle2, Clock3, Pause, Play, Plus, RefreshCw, Search, X, XCircle } from "lucide-react";
import type { BackendFlightPlan, BackendMission, BackendMissionStatus } from "../api/types";
import { getFlightPlans, getMission, getMissions, startMission } from "../api/client";
import { MissionDetailRouteMap } from "../components/MissionDetailRouteMap";
import { AppTopActions } from "../components/AppTopActions";

type MissionDisplayStatus = "Pendiente" | "Enviando al dron" | "En progreso" | "Completada" | "Cancelada" | "Fallida";

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

export function MisMisionesView({ onCreateMission }: { onCreateMission: () => void }) {
  const [missions, setMissions] = useState<BackendMission[] | null>(null);
  const [flightPlansById, setFlightPlansById] = useState<Map<number, BackendFlightPlan>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"Todas" | MissionDisplayStatus>("Todas");
  const [searchTerm, setSearchTerm] = useState("");

  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  // idMission -> timerId. Evita sondear la misma misión dos veces, y permite arrancar el
  // sondeo tanto al apretar "Iniciar" acá como al encontrar una misión ya en UPLOADING al
  // cargar la lista (por ejemplo, si se inició por curl/Postman en otra sesión).
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
        setFlightPlansById(new Map(flightPlans.map((plan) => [plan.idFlightPlan, plan])));
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las misiones."))
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cualquier misión en UPLOADING (la haya iniciado esta pantalla u otra vía, ej. curl/Postman)
  // se sondea sola hasta que cambie de estado — no hace falta recargar la página.
  useEffect(() => {
    (missions ?? [])
      .filter((mission) => mission.status === "UPLOADING")
      .forEach((mission) => pollMissionStatus(mission.idMission));
  }, [missions]);

  const missionRows = useMemo(
    () =>
      (missions ?? []).map((mission) => ({
        mission,
        flightPlanName: flightPlansById.get(mission.idFlightPlan)?.name ?? `Plan #${mission.idFlightPlan}`,
        statusLabel: normalizeStatus(mission.status)
      })),
    [missions, flightPlansById]
  );

  const selectedRow = missionRows.find((row) => row.mission.idMission === selectedId) ?? null;

  const filteredRows = missionRows.filter((row) => {
    const matchesStatus = statusFilter === "Todas" || row.statusLabel === statusFilter;
    const matchesSearch =
      !searchTerm.trim() ||
      `${row.mission.name} ${row.flightPlanName} ${row.mission.droneId}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totals = {
    all: missionRows.length,
    pending: missionRows.filter((row) => row.statusLabel === "Pendiente").length,
    active: missionRows.filter((row) => row.statusLabel === "En progreso").length,
    completed: missionRows.filter((row) => row.statusLabel === "Completada").length
  };

  const handleStart = async (mission: BackendMission) => {
    setStartError(null);
    setStartingId(mission.idMission);
    try {
      const updated = await startMission(mission.idMission);
      setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
      // El status recién pasa a IN_PROGRESS cuando llega el mission/ack del dron (async, por MQTT),
      // no en la respuesta de /start. Se sondea la misión unos segundos hasta ver el cambio.
      pollMissionStatus(mission.idMission);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "No se pudo iniciar la misión.");
    } finally {
      setStartingId(null);
    }
  };

  const pollMissionStatus = (idMission: string) => {
    if (activePolls.current.has(idMission)) return;

    let attempts = 0;
    const timerId = window.setInterval(() => {
      attempts += 1;
      getMission(idMission)
        .then((updated) => {
          setMissions((current) => current?.map((item) => (item.idMission === updated.idMission ? updated : item)) ?? current);
          // Sin tope corto: el ack puede tardar (sobre todo si se manda a mano desde Postman).
          // 300 intentos a 2s son ~10 min, como red de seguridad ante algo que nunca confirma.
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
          <p>Gestiona y monitorea las misiones de inspección.</p>
        </div>
        <AppTopActions />
      </header>

      <section className="missions-summary-row">
        <MissionSummaryCard icon={<CalendarCheck size={22} />} label="Total misiones" tone="green" value={totals.all} />
        <MissionSummaryCard icon={<Clock3 size={22} />} label="Pendientes" tone="amber" value={totals.pending} />
        <MissionSummaryCard icon={<Play size={22} />} label="En progreso" tone="blue" value={totals.active} />
        <MissionSummaryCard icon={<CheckCircle2 size={22} />} label="Completadas" tone="green" value={totals.completed} />
        <button className="missions-new-button" onClick={onCreateMission} type="button">
          <Plus size={18} />
          Nueva misión
        </button>
      </section>

      {loadError && (
        <p className="mission-empty">
          <AlertCircle size={16} aria-hidden="true" /> {loadError}
        </p>
      )}

      {missions === null && !loadError && <p className="mission-empty">Cargando misiones...</p>}

      {missions !== null && missions.length === 0 && !loadError && (
        <p className="mission-empty">No hay misiones creadas todavía. Empezá por crear una desde "Nueva misión".</p>
      )}

      {missions !== null && missions.length > 0 && (
        <section className="missions-content-grid">
          <article className="missions-list-card">
            <div className="missions-list-toolbar">
              <div className="missions-tabs" role="tablist" aria-label="Filtro de misiones">
                {(["Todas", "Pendiente", "Enviando al dron", "En progreso", "Completada", "Cancelada", "Fallida"] as const).map((status) => (
                  <button className={statusFilter === status ? "active" : undefined} key={status} onClick={() => setStatusFilter(status)} type="button">
                    {status}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label className="missions-search">
                  <Search size={15} />
                  <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar misión..." value={searchTerm} />
                </label>
                <button className="mission-detail-close" disabled={isRefreshing} onClick={loadData} title="Actualizar" type="button" aria-label="Actualizar">
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
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(({ mission, flightPlanName, statusLabel }) => (
                    <tr
                      className={selectedRow?.mission.idMission === mission.idMission ? "selected" : undefined}
                      key={mission.idMission}
                      onClick={() => setSelectedId(mission.idMission)}
                    >
                      <td>
                        <strong>{mission.name}</strong>
                        <small>{mission.idMission.slice(0, 8)}</small>
                      </td>
                      <td>{flightPlanName}</td>
                      <td>
                        <span>{formatDate(mission.scheduledAt)}</span>
                        <small>{formatTime(mission.scheduledAt)}</small>
                      </td>
                      <td>
                        <span className={`mission-state ${statusClass(statusLabel)}`}>{statusLabel}</span>
                      </td>
                      <td>
                        {mission.status === "PLANNED" && (
                          <button
                            className="mission-delete-button"
                            disabled={startingId === mission.idMission}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStart(mission);
                            }}
                            title="Iniciar misión"
                            type="button"
                          >
                            <Play size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="missions-table-footer">
              <span>
                Mostrando {filteredRows.length} de {missionRows.length} misiones
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
                <button className="mission-detail-close" onClick={() => setSelectedId(null)} type="button" aria-label="Cerrar detalle">
                  <X size={17} />
                </button>
              </div>

              <div className="mission-detail-map">
                <MissionDetailRouteMap
                  points={
                    selectedRow.mission.missionWaypoints ??
                    flightPlansById.get(selectedRow.mission.idFlightPlan)?.route ??
                    []
                  }
                />
              </div>

              <div className="mission-detail-grid">
                <MissionInfo label="Plan de vuelo" value={selectedRow.flightPlanName} />
                <MissionInfo label="Dron" value={selectedRow.mission.droneId} />
                <MissionInfo label="Fecha y hora" value={`${formatDate(selectedRow.mission.scheduledAt)} - ${formatTime(selectedRow.mission.scheduledAt)}`} />
                <MissionInfo
                  label="Duración"
                  value={formatDuration(selectedRow.mission.startedAt, selectedRow.mission.finishedAt)}
                />
                <MissionInfo label="Objetivo" value={selectedRow.mission.objective || "-"} />
                <MissionInfo
                  label="Puntos seleccionados"
                  value={`${selectedRow.mission.selectedPlanWaypointIds?.length ?? 0} puntos`}
                />
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
                    <button className="mission-action postpone" type="button">
                      Postergar
                    </button>
                    <button className="mission-action cancel" type="button">
                      <XCircle size={14} />
                      Cancelar
                    </button>
                  </div>
                )}

                {selectedRow.mission.status === "UPLOADING" && (
                  <p className="mission-empty">Esperando confirmación del dron...</p>
                )}

                {selectedRow.mission.status === "IN_PROGRESS" && (
                  <div className="mission-actions-row">
                    <button className="mission-action telemetry" type="button">
                      Ver telemetría
                    </button>
                    <button className="mission-action pause" type="button">
                      <Pause size={14} />
                      Pausar misión
                    </button>
                    <button className="mission-action cancel" type="button">
                      <XCircle size={14} />
                      Cancelar misión
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}
        </section>
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
