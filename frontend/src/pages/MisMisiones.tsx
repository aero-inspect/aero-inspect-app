import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import type { Asset, InspectionMission, Plant } from "../types";
import { MissionRouteMap } from "../components/MissionRouteMap";

type MissionDisplayStatus = "Pendiente" | "En progreso" | "Completada" | "Cancelada";

type MissionRow = InspectionMission & {
  displayId: string;
  date: string;
  time: string;
  pilot: string;
  drone: string;
  duration: string;
  statusLabel: MissionDisplayStatus;
};

const MOCK_ROUTE = [
  { id: 1, latitude: "-35.140110", longitude: "-60.458900" },
  { id: 2, latitude: "-35.140410", longitude: "-60.458520" },
  { id: 3, latitude: "-35.140205", longitude: "-60.457920" },
  { id: 4, latitude: "-35.140760", longitude: "-60.457710" },
  { id: 5, latitude: "-35.141045", longitude: "-60.458240" },
  { id: 6, latitude: "-35.140820", longitude: "-60.458760" }
];

export function MisMisionesView({
  missions,
  assets,
  onCreateMission,
  plant
}: {
  missions: InspectionMission[];
  assets: Asset[];
  onBack: () => void;
  onCreateMission: () => void;
  plant: Plant;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeMissionIds, setActiveMissionIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<"Todas" | MissionDisplayStatus>("Todas");
  const [searchTerm, setSearchTerm] = useState("");

  const plantAssetIds = assets.filter((asset) => asset.plantId === plant.id).map((asset) => asset.id);
  const plantMissions = missions.filter((mission) => plantAssetIds.includes(mission.assetId));

  const missionRows = useMemo(() => buildMissionRows(plantMissions, assets, plant), [plantMissions, assets, plant]);
  const selectedMission = missionRows.find((mission) => mission.id === selectedId) ?? missionRows[0] ?? null;
  const selectedAsset = selectedMission ? assets.find((asset) => asset.id === selectedMission.assetId) ?? null : null;

  const filteredMissions = missionRows.filter((mission) => {
    const currentStatus = activeMissionIds.includes(mission.id) ? "En progreso" : mission.statusLabel;
    const matchesStatus = statusFilter === "Todas" || currentStatus === statusFilter;
    const matchesSearch = !searchTerm.trim() || `${mission.name} ${mission.assetName} ${mission.displayId}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totals = {
    all: missionRows.length,
    pending: missionRows.filter((mission) => mission.statusLabel === "Pendiente").length,
    active: missionRows.filter((mission) => activeMissionIds.includes(mission.id) || mission.statusLabel === "En progreso").length,
    completed: missionRows.filter((mission) => mission.statusLabel === "Completada").length
  };

  const isSelectedActive = selectedMission ? activeMissionIds.includes(selectedMission.id) || selectedMission.statusLabel === "En progreso" : false;

  const startMission = () => {
    if (!selectedMission) return;
    setActiveMissionIds((current) => (current.includes(selectedMission.id) ? current : [...current, selectedMission.id]));
  };

  return (
    <section className="missions-dashboard">
      <header className="missions-topbar">
        <div>
          <h1>Misiones</h1>
          <p>Gestiona y monitorea las misiones de inspeccion.</p>
        </div>
        <div className="missions-top-actions">
          <div className="missions-weather">
            <Sun size={30} />
            <div>
              <strong>23°C</strong>
              <span>Parcialmente nublado</span>
            </div>
          </div>
          <button className="tech-notification-button" type="button" aria-label="Notificaciones">
            <Bell size={20} />
            <span>3</span>
          </button>
          <button className="tech-user-button" type="button" aria-label="Perfil">
            <UserRound size={21} />
          </button>
        </div>
      </header>

      <section className="missions-summary-row">
        <MissionSummaryCard icon={<CalendarCheck size={22} />} label="Total misiones" tone="green" value={totals.all} />
        <MissionSummaryCard icon={<Clock3 size={22} />} label="Pendientes" tone="amber" value={totals.pending} />
        <MissionSummaryCard icon={<Play size={22} />} label="En progreso" tone="blue" value={totals.active} />
        <MissionSummaryCard icon={<CheckCircle2 size={22} />} label="Completadas" tone="green" value={totals.completed} />
        <button className="missions-new-button" onClick={onCreateMission} type="button">
          <Plus size={18} />
          Nueva mision
        </button>
      </section>

      <section className="missions-content-grid">
        <article className="missions-list-card">
          <div className="missions-list-toolbar">
            <div className="missions-tabs" role="tablist" aria-label="Filtro de misiones">
              {(["Todas", "Pendiente", "En progreso", "Completada", "Cancelada"] as const).map((status) => (
                <button className={statusFilter === status ? "active" : undefined} key={status} onClick={() => setStatusFilter(status)} type="button">
                  {status === "Todas" ? "Todas" : status === "Completada" ? "Completadas" : status === "Cancelada" ? "Canceladas" : status}
                </button>
              ))}
            </div>
            <label className="missions-search">
              <Search size={15} />
              <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar mision..." value={searchTerm} />
            </label>
          </div>

          <div className="missions-table-wrap">
            <table className="missions-table">
              <thead>
                <tr>
                  <th>Mision</th>
                  <th>Activo</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Piloto asignado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMissions.map((mission) => {
                  const currentStatus = activeMissionIds.includes(mission.id) ? "En progreso" : mission.statusLabel;
                  return (
                    <tr className={selectedMission?.id === mission.id ? "selected" : undefined} key={mission.id} onClick={() => setSelectedId(mission.id)}>
                      <td>
                        <strong>{mission.name}</strong>
                        <small>{mission.displayId}</small>
                      </td>
                      <td>
                        <strong>{mission.assetName}</strong>
                        <small>{assets.find((asset) => asset.id === mission.assetId)?.type ?? "Activo"}</small>
                      </td>
                      <td>
                        <span>{mission.date}</span>
                        <small>{mission.time}</small>
                      </td>
                      <td>
                        <span className={`mission-state ${statusClass(currentStatus)}`}>{currentStatus}</span>
                      </td>
                      <td>{mission.pilot}</td>
                      <td>
                        <button className="mission-delete-button" onClick={(event) => event.stopPropagation()} type="button" aria-label="Eliminar mision">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="missions-table-footer">
            <div className="missions-pagination">
              <button type="button">‹</button>
              <button className="active" type="button">1</button>
              <button type="button">2</button>
              <button type="button">›</button>
            </div>
            <span>Mostrando {filteredMissions.length} de {missionRows.length} misiones</span>
          </div>
        </article>

        {selectedMission && (
          <aside className="mission-detail-card">
            <div className="mission-detail-header">
              <div>
                <h2>{selectedMission.name}</h2>
                <div className="mission-detail-id">
                  <span className={`mission-state ${statusClass(isSelectedActive ? "En progreso" : selectedMission.statusLabel)}`}>
                    {isSelectedActive ? "En progreso" : selectedMission.statusLabel}
                  </span>
                  <small>{selectedMission.displayId}</small>
                </div>
              </div>
              <button className="mission-detail-close" onClick={() => setSelectedId(null)} type="button" aria-label="Cerrar detalle">
                <X size={17} />
              </button>
            </div>

            <div className="mission-detail-map">
              <MissionRouteMap asset={selectedAsset} disabled={true} onAddPoint={() => {}} plant={plant} routePoints={selectedMission.routePoints} />
            </div>

            <div className="mission-detail-grid">
              <MissionInfo label="Activo" value={selectedMission.assetName} />
              <MissionInfo label="Dron" value={selectedMission.drone} />
              <MissionInfo label="Fecha y hora" value={`${selectedMission.date} - ${selectedMission.time}`} />
              <MissionInfo label="Duracion estimada" value={selectedMission.duration} />
              <MissionInfo label="Piloto asignado" value={selectedMission.pilot} />
              <MissionInfo label="Puntos del recorrido" value={`${selectedMission.routePoints.length} puntos`} />
            </div>

            {isSelectedActive && (
              <div className="mission-progress-box">
                <div>
                  <strong>Progreso de la mision</strong>
                  <span>40%</span>
                </div>
                <div className="mission-progress-track">
                  <i />
                </div>
              </div>
            )}

            <div className="mission-quick-actions">
              <h3>Acciones rapidas</h3>
              {isSelectedActive ? (
                <div className="mission-actions-row">
                  <button className="mission-action telemetry" type="button">Ver telemetria</button>
                  <button className="mission-action pause" type="button">
                    <Pause size={14} />
                    Pausar mision
                  </button>
                  <button className="mission-action cancel" type="button">
                    <XCircle size={14} />
                    Cancelar mision
                  </button>
                </div>
              ) : (
                <div className="mission-actions-row">
                  <button className="mission-action start" onClick={startMission} type="button">
                    <Play size={14} />
                    Iniciar
                  </button>
                  <button className="mission-action postpone" type="button">Postergar</button>
                  <button className="mission-action cancel" type="button">
                    <XCircle size={14} />
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </section>
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

function buildMissionRows(missions: InspectionMission[], assets: Asset[], plant: Plant): MissionRow[] {
  const fallbackAssets = assets.length > 0 ? assets : [
    { id: 1, name: "Silo Norte", type: "Silo", latitude: plant.center.latitude, longitude: plant.center.longitude, description: "", plantId: plant.id } as Asset
  ];

  const baseRows = missions.length > 0 ? missions : [
    createMockMission(1, "Inspeccion Silo Norte", fallbackAssets[0], "Pendiente"),
    createMockMission(2, "Inspeccion Cinta Transportadora 2", fallbackAssets[1] ?? fallbackAssets[0], "En ejecución"),
    createMockMission(3, "Inspeccion Noria Principal", fallbackAssets[2] ?? fallbackAssets[0], "Pendiente"),
    createMockMission(4, "Inspeccion Tuberia de Vapor", fallbackAssets[3] ?? fallbackAssets[0], "Finalizada"),
    createMockMission(5, "Inspeccion Techo Almacen 2", fallbackAssets[4] ?? fallbackAssets[0], "Finalizada"),
    createMockMission(6, "Inspeccion Silo Sur", fallbackAssets[0], "Cancelada")
  ];

  return baseRows.map((mission, index) => ({
    ...mission,
    displayId: `MIS-2025-${String(index + 1).padStart(3, "0")}`,
    date: index < 3 ? "28/05/2025" : index < 5 ? "27/05/2025" : "25/05/2025",
    time: ["09:30", "11:15", "14:00", "16:20", "10:45", "09:10"][index] ?? "09:00",
    pilot: index === 2 ? "Sin asignar" : "Emilia Andersen",
    drone: "AeroDrone 01",
    duration: index === 1 ? "25 min" : "30 min",
    routePoints: mission.routePoints.length > 0 ? mission.routePoints : MOCK_ROUTE,
    statusLabel: normalizeStatus(mission.status)
  }));
}

function createMockMission(id: number, name: string, asset: Asset, status: InspectionMission["status"]): InspectionMission {
  return {
    id,
    name,
    assetId: asset.id,
    assetName: asset.name,
    routePoints: MOCK_ROUTE,
    status
  };
}

function normalizeStatus(status: InspectionMission["status"]): MissionDisplayStatus {
  if (status === "En ejecución") return "En progreso";
  if (status === "Finalizada") return "Completada";
  if (status === "Cancelada") return "Cancelada";
  return "Pendiente";
}

function statusClass(status: MissionDisplayStatus) {
  if (status === "En progreso") return "progress";
  if (status === "Completada") return "completed";
  if (status === "Cancelada") return "cancelled";
  return "pending";
}
