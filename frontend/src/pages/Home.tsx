import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight, LogOut, Package, MapPin, Radio, CheckCircle2, Clock, AlertCircle, Home as HomeIcon, Plane, ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { MockUser, InspectionMission, Asset, Plant, SessionUser } from "../types";
import type { BackendAsset, BackendMission } from "../api/types";
import { getAssets, getMissions } from "../api/client";
import { canConsultAssets, getRoleHomeTitle } from "../utils/helpers";
import { DRONE_OPERATION_ROLES } from "../constants";
import { AssetsOverviewMap } from "../components/AssetsOverviewMap";
import { MisActivosView } from "./MisActivos";
import { ConfigurarMisionView } from "./ConfigurarMision";
import { GenerarPlanVueloView } from "./GenerarPlanVuelo";
import { MisMisionesView } from "./MisMisiones";
import { DroneTelemetryView } from "./DroneTelemetry";
import { DronesAbmView } from "./DronesAbm";
import { PruebaTelemetriaView } from "./PruebaTelemetria";
import { LaunchMissionView } from "./LaunchMission";
import { RegistrarActivoView } from "./RegistrarActivo";
import { ProfileView } from "./Perfil";
import { RoleManagementView } from "./GestionRoles";
import { MonitorMissionView } from "./MonitorMission";
import { ReportesView } from "./ReportesConnected";
import { CrearReporteView } from "./CrearReporte";
import { ReporteDetalleView } from "./ReporteDetalle";
import { ReporteDetalleRealView } from "./ReporteDetalleReal";
import { CentroAyudaView } from "./CentroAyuda";
import { ActividadRecienteView } from "./ActividadReciente";
import { AppTopActions, DroneGlyph } from "../components/AppTopActions";
import sidebarLogo from "../assets/aeroinspect-sidebar-logo.png";

const MOCK_PLANT = {
  id: "planta-principal",
  name: "Planta Principal",
  province: "Buenos Aires",
  center: {
    latitude: "-35.140664",
    longitude: "-60.458214"
  },
  bounds: [
    { latitude: "-35.1398", longitude: "-60.4592" },
    { latitude: "-35.1398", longitude: "-60.4572" },
    { latitude: "-35.1415", longitude: "-60.4572" },
    { latitude: "-35.1415", longitude: "-60.4592" }
  ]
};

export function Home({
  currentPath,
  navigateTo,
  user,
  onLogout,
  assets,
  missions,
  users,
  droneConnected,
  battery,
  setDroneConnected,
  setBattery,
  setAssets,
  setMissions,
  setUsers,
  setUser
}: {
  currentPath: string;
  navigateTo: (path: string) => void;
  user: SessionUser;
  onLogout: () => void;
  assets: Asset[];
  missions: InspectionMission[];
  users: MockUser[];
  droneConnected: boolean;
  battery: number | null;
  setDroneConnected: Dispatch<SetStateAction<boolean>>;
  setBattery: Dispatch<SetStateAction<number | null>>;
  setAssets: Dispatch<SetStateAction<Asset[]>>;
  setMissions: Dispatch<SetStateAction<InspectionMission[]>>;
  setUsers: Dispatch<SetStateAction<MockUser[]>>;
  setUser: Dispatch<SetStateAction<SessionUser | null>>;
}) {
  const isRegisterAssetPath = currentPath === "/registro-activo";
  const isAssetsPath = currentPath === "/mis-activos";
  const isMissionPath = currentPath === "/configurar-mision";
  const isMissionsPath = currentPath === "/mis-misiones";
  const isGeneratePlanPath = currentPath === "/generar-plan";
  const isDronePath = currentPath === "/dron";
  const isDronesAbmPath = currentPath === "/gestion-drones";
  const isLaunchPath = currentPath === "/ejecutar-despegue";
  const isProfilePath = currentPath === "/perfil";
  const isRoleMgmtPath = currentPath === "/gestion-roles";
  const isMonitorPath = currentPath === "/monitorear-mision";
  const isReportsPath = currentPath === "/reportes";
  const isCreateReportPath = currentPath === "/crear-reporte";
  const isReportDetailPath = currentPath === "/reporte-detalle";
  const isReportDetailRealPath = currentPath === "/reporte-detalle-real";
  const isHelpPath = currentPath === "/centro-ayuda";
  const isActivityPath = currentPath === "/actividad-reciente";
  const isPruebaTelemetriaPath = currentPath === "/prueba-telemetria";
  const userCanConsultAssets = canConsultAssets(user.role);
  const currentProfileImage = user.profileImage ?? "";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedBackendMissionId, setSelectedBackendMissionId] = useState<string | null>(null);
  const [selectedFlightPlanId, setSelectedFlightPlanId] = useState<number | null>(null);
  const [selectedReportCode, setSelectedReportCode] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const sidebarRoleLabel = user.role === "Tecnico de Mantenimiento" ? "Técnico de Mantenimiento" : user.role;
  return (
    <main className={isSidebarCollapsed ? "home-shell-no-header sidebar-collapsed" : "home-shell-no-header"}>
      <aside className="sidebar-full">
        <button className="sidebar-collapse-button" onClick={() => setIsSidebarCollapsed((current) => !current)} type="button" aria-label={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}>
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <div className="sidebar-brand">
          <img className="sidebar-brand-logo" src={sidebarLogo} alt="AeroInspect" />
        </div>
        <nav className="nav-list" aria-label="Principal">
          <button className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isGeneratePlanPath && !isDronePath && !isDronesAbmPath && !isLaunchPath && !isMonitorPath && !isReportsPath && !isCreateReportPath && !isReportDetailPath && !isReportDetailRealPath && !isRoleMgmtPath && !isHelpPath && !isActivityPath ? "active" : undefined} onClick={() => navigateTo("/")} type="button">
            <HomeIcon size={20} />
            {!isSidebarCollapsed && <span>Inicio</span>}
          </button>

          {userCanConsultAssets && (
            <button className={isRegisterAssetPath || isAssetsPath ? "active" : undefined} onClick={() => navigateTo("/mis-activos")} type="button">
              <Package size={20} />
              {!isSidebarCollapsed && <span>Activos</span>}
            </button>
          )}

          {DRONE_OPERATION_ROLES.includes(user.role) && (
            <button className={isDronePath ? "active" : undefined} onClick={() => navigateTo("/dron")} type="button">
              <DroneGlyph />
              {!isSidebarCollapsed && <span>Drones</span>}
            </button>
          )}

          {user.role === "Jefe de Planta" && (
            <button className={isDronesAbmPath ? "active" : undefined} onClick={() => navigateTo("/gestion-drones")} type="button">
              <DroneGlyph />
              {!isSidebarCollapsed && <span>Gestión de Drones</span>}
            </button>
          )}

          {(userCanConsultAssets || user.role === "Tecnico de Mantenimiento") && (
            <button className={isMissionsPath || isMissionPath || isGeneratePlanPath ? "active" : undefined} onClick={() => navigateTo("/mis-misiones")} type="button">
              <Plane size={20} />
              {!isSidebarCollapsed && <span>Misiones</span>}
            </button>
          )}

          <button className={isReportsPath || isCreateReportPath || isReportDetailPath || isReportDetailRealPath ? "active" : undefined} onClick={() => navigateTo("/reportes")} type="button">
            <CheckCircle2 size={20} />
            {!isSidebarCollapsed && <span>Reportes</span>}
          </button>
          {user.role === "Jefe de Planta" && (
            <button className={isRoleMgmtPath ? "active" : undefined} onClick={() => navigateTo("/gestion-roles")} type="button">
              <UsersRound size={20} />
              {!isSidebarCollapsed && <span>Gestión de personal</span>}
            </button>
          )}
        </nav>
        <button className="sidebar-user" onClick={() => navigateTo("/perfil")} type="button">
          {currentProfileImage ? (
            <img className="sidebar-user-avatar" src={currentProfileImage} alt="Foto de perfil" />
          ) : (
            <div className="sidebar-user-avatar" aria-hidden="true"></div>
          )}
          {!isSidebarCollapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">{sidebarRoleLabel}</div>
              <div className="sidebar-user-status">
                <span className="status-dot"></span>
                En línea
              </div>
            </div>
          )}
          {!isSidebarCollapsed && <ArrowRight className="sidebar-user-arrow" size={15} aria-hidden="true" />}
        </button>
      </aside>

      <section className={isRegisterAssetPath || isAssetsPath || isMissionPath || isMissionsPath || isGeneratePlanPath || isReportsPath || isCreateReportPath || isReportDetailPath || isReportDetailRealPath || isRoleMgmtPath || isHelpPath || isActivityPath ? "workspace-no-header register-workspace" : "workspace-no-header"}>
        {!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isGeneratePlanPath && !isHelpPath && !isActivityPath && user.role !== "Tecnico de Mantenimiento" && user.role !== "Jefe de Planta" && (
          <header className="topbar">
            <div>
              <p className="eyebrow">Bienvenida, {user.name}</p>
              <h1>{getRoleHomeTitle(user.role)}</h1>
              <p className="role-label">Rol: {user.role}</p>
            </div>
            <button
              className="ghost-button"
              onClick={() => {
                navigateTo("/");
                onLogout();
              }}
              type="button"
            >
              <LogOut size={18} aria-hidden="true" />
              Salir
            </button>
          </header>
        )}

        {isPruebaTelemetriaPath ? (
          <PruebaTelemetriaView token={user.token} onBack={() => navigateTo("/dron")} />
        ) : isProfilePath ? (
          <ProfileView user={user} setUser={setUser} onBack={() => navigateTo("/")} onAssignRoles={() => navigateTo("/gestion-roles")} onViewActivity={() => navigateTo("/actividad-reciente")} onLogout={onLogout} />
        ) : isRegisterAssetPath && (userCanConsultAssets || user.role === "Jefe de Planta") ? (
          <RegistrarActivoView assets={assets} onBack={() => navigateTo("/mis-activos")} onCreateAsset={(asset) => setAssets((current) => [...current, { ...asset, id: Date.now(), plantId: MOCK_PLANT.id }])} onGoHome={() => navigateTo("/")} onViewAssets={() => navigateTo("/mis-activos")} plant={MOCK_PLANT} />
        ) : isRoleMgmtPath && user.role === "Jefe de Planta" ? (
          <RoleManagementView user={user} onBack={() => navigateTo("/perfil")} />
        ) : isDronesAbmPath && user.role === "Jefe de Planta" ? (
          <DronesAbmView />
        ) : isMonitorPath && userCanConsultAssets ? (
          <MonitorMissionView missionId={selectedBackendMissionId} token={user.token} onBack={() => navigateTo("/mis-misiones")} />
        ) : isMissionsPath ? (
          <MisMisionesView
            onCreateMission={(idFlightPlan) => {
              setSelectedFlightPlanId(idFlightPlan);
              navigateTo("/configurar-mision");
            }}
            onGeneratePlan={() => navigateTo("/generar-plan")}
            onViewMission={(idMission) => {
              setSelectedBackendMissionId(idMission);
              navigateTo("/monitorear-mision");
            }}
          />
        ) : isGeneratePlanPath && userCanConsultAssets ? (
          <GenerarPlanVueloView
            onBack={() => navigateTo("/mis-misiones")}
            onPlanConfirmed={(idFlightPlan) => {
              setSelectedFlightPlanId(idFlightPlan);
              navigateTo("/configurar-mision");
            }}
          />
        ) : isMissionPath && userCanConsultAssets ? (
          <ConfigurarMisionView initialFlightPlanId={selectedFlightPlanId} onBack={() => navigateTo("/mis-misiones")} onViewMissions={() => navigateTo("/mis-misiones")} />
        ) : isLaunchPath && DRONE_OPERATION_ROLES.includes(user.role) ? (
          <LaunchMissionView
            missions={missions}
            assets={assets}
            droneConnected={droneConnected}
            battery={battery}
            setMissions={setMissions}
            onBack={() => navigateTo("/")}
            plant={MOCK_PLANT}
          />
        ) : isDronePath && DRONE_OPERATION_ROLES.includes(user.role) ? (
          <DroneTelemetryView />
        ) : isAssetsPath && userCanConsultAssets ? (
          <MisActivosView assets={assets} onBack={() => navigateTo("/")} onDeleteAsset={(assetId) => setAssets((current) => current.filter((asset) => asset.id !== assetId))} onRegisterAsset={() => navigateTo("/registro-activo")} onUpdateAsset={(nextAsset) => setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)))} selectedAssetId={selectedAssetId} plant={MOCK_PLANT} />
        ) : isCreateReportPath ? (
          <CrearReporteView onBack={() => navigateTo("/reportes")} />
        ) : isReportDetailPath ? (
          <ReporteDetalleView onBack={() => navigateTo("/reportes")} />
        ) : isReportDetailRealPath ? (
          <ReporteDetalleRealView reportCode={selectedReportCode} onBack={() => navigateTo("/reportes")} />
        ) : isHelpPath ? (
          <CentroAyudaView />
        ) : isActivityPath ? (
          <ActividadRecienteView />
        ) : isReportsPath ? (
          <ReportesView onRunAi={() => { setSelectedReportCode(null); navigateTo("/reporte-detalle-real"); }} onViewReport={(code) => { setSelectedReportCode(code); navigateTo("/reporte-detalle-real"); }} />
        ) : user.role === "Jefe de Planta" || user.role === "Tecnico de Mantenimiento" ? (
          <InspectionHomeView
            navigateTo={navigateTo}
            onViewAsset={(idAsset) => {
              setSelectedAssetId(idAsset);
              navigateTo("/mis-activos");
            }}
            onViewMission={(idMission) => {
              setSelectedBackendMissionId(idMission);
              navigateTo("/monitorear-mision");
            }}
            plant={MOCK_PLANT}
          />
        ) : (
          <Fragment>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">Bienvenido, {user.name}</p>
                <h1>Panel de Control</h1>
                <p className="role-label">Rol: {user.role}</p>
              </div>
            </header>

            <div className="dashboard-grid">
              <div className="dashboard-card stats-card">
                <div className="card-header">
                  <h3>Resumen General</h3>
                </div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <Package size={20} />
                    <div>
                      <span className="stat-label">Activos Totales</span>
                      <strong className="stat-value">{assets.length}</strong>
                    </div>
                  </div>
                  <div className="stat-item">
                    <MapPin size={20} />
                    <div>
                      <span className="stat-label">Misiones</span>
                      <strong className="stat-value">{missions.length}</strong>
                    </div>
                  </div>
                  <div className="stat-item">
                    <Radio size={20} />
                    <div>
                      <span className="stat-label">Estado Dron</span>
                      <strong className="stat-value">{droneConnected ? "Conectado" : "Desconectado"}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="dashboard-card missions-card">
                <div className="card-header">
                  <h3>Misiones Recientes</h3>
                  {userCanConsultAssets && (
                    <button className="view-all-link" onClick={() => navigateTo("/mis-misiones")}>
                      Ver todas <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                <div className="missions-list">
                  {missions.slice(0, 3).map((mission) => (
                    <div key={mission.id} className="mission-item">
                      <div className="mission-icon">
                        {mission.status === "Finalizada" ? (
                          <CheckCircle2 size={18} />
                        ) : mission.status === "En ejecución" ? (
                          <Clock size={18} />
                        ) : (
                          <AlertCircle size={18} />
                        )}
                      </div>
                      <div className="mission-info">
                        <strong>{mission.assetName}</strong>
                        <span className={`mission-status status-${mission.status?.toLowerCase().replace(" ", "-") || "pendiente"}`}>
                          {mission.status || "Pendiente"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {missions.length === 0 && (
                    <p className="empty-state">No hay misiones registradas</p>
                  )}
                </div>
              </div>
              <div className="dashboard-card actions-card">
                <div className="card-header">
                  <h3>Acciones Rápidas</h3>
                </div>
                <div className="quick-actions">
                  {user.role === "Jefe de Planta" && (
                    <button className="action-button" onClick={() => navigateTo("/registro-activo")}>
                      <Package size={20} />
                      <span>Registrar Activo</span>
                    </button>
                  )}
                  {userCanConsultAssets && (
                    <>
                      <button className="action-button" onClick={() => navigateTo("/mis-activos")}>
                        <Package size={20} />
                        <span>Ver Activos</span>
                      </button>
                      <button className="action-button" onClick={() => navigateTo("/mis-misiones")}>
                        <MapPin size={20} />
                        <span>Ver Misiones</span>
                      </button>
                    </>
                  )}
                  {user.role === "Tecnico de Mantenimiento" && (
                    <button className="action-button" onClick={() => navigateTo("/configurar-mision")}>
                      <MapPin size={20} />
                      <span>Configurar Misión</span>
                    </button>
                  )}
                  {DRONE_OPERATION_ROLES.includes(user.role) && (
                    <>
                      <button className="action-button" onClick={() => navigateTo("/dron")}>
                        <Radio size={20} />
                        <span>Telemetría Dron</span>
                      </button>
                      <button className="action-button" onClick={() => navigateTo("/ejecutar-despegue")}>
                        <ArrowRight size={20} />
                        <span>Ejecutar Despegue</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="dashboard-card plant-card">
                <div className="card-header">
                  <h3>Información de Planta</h3>
                </div>
                <div className="plant-info">
                  <div className="plant-detail">
                    <span className="plant-label">Nombre</span>
                    <strong>{MOCK_PLANT.name}</strong>
                  </div>
                  <div className="plant-detail">
                    <span className="plant-label">Ubicación</span>
                    <strong>{MOCK_PLANT.province}</strong>
                  </div>
                  <div className="plant-detail">
                    <span className="plant-label">Coordenadas</span>
                    <strong>{MOCK_PLANT.center.latitude}, {MOCK_PLANT.center.longitude}</strong>
                  </div>
                </div>
              </div>
            </div>
          </Fragment>
        )}
      </section>
    </main>
  );
}

type InspectionHomeViewProps = {
  navigateTo: (path: string) => void;
  onViewAsset: (idAsset: number) => void;
  onViewMission: (idMission: string) => void;
  plant: Plant;
};

const missionStatusLabels: Record<BackendMission["status"], string> = {
  PLANNED: "Planificada",
  UPLOADING: "Enviando",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  FAILED: "Fallida"
};

const missionStatusClasses: Record<BackendMission["status"], "low" | "medium" | "critical"> = {
  PLANNED: "medium",
  UPLOADING: "medium",
  IN_PROGRESS: "medium",
  COMPLETED: "low",
  CANCELLED: "critical",
  FAILED: "critical"
};

function missionDisplayDate(mission: BackendMission) {
  const date = mission.finishedAt ?? mission.startedAt ?? mission.scheduledAt;
  if (!date) return "Sin fecha";
  return new Date(date).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function missionSortTime(mission: BackendMission) {
  const date = mission.finishedAt ?? mission.startedAt ?? mission.scheduledAt;
  return date ? new Date(date).getTime() : 0;
}

function InspectionHomeView({ navigateTo, onViewAsset, onViewMission, plant }: InspectionHomeViewProps) {
  const [assets, setAssets] = useState<BackendAsset[]>([]);
  const [missions, setMissions] = useState<BackendMission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError("");

    Promise.all([getAssets(), getMissions()])
      .then(([nextAssets, nextMissions]) => {
        if (!active) return;
        setAssets(nextAssets);
        setMissions(nextMissions);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los datos de inicio.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const latestMissions = useMemo(
    () => [...missions].sort((left, right) => missionSortTime(right) - missionSortTime(left)).slice(0, 4),
    [missions]
  );

  const completedMissions = missions.filter((mission) => mission.status === "COMPLETED").length;
  const totalMissions = missions.length;
  const completionPercentage = totalMissions === 0 ? 0 : Math.round((completedMissions / totalMissions) * 100);
  const pendingMissions = totalMissions - completedMissions;

  return (
    <div className="tech-dashboard inspection-home">
      <div className="inspection-home-header">
        <div>
          <h1>Inicio</h1>
          <p>Resumen de misiones y activos de la planta.</p>
        </div>
        <AppTopActions />
      </div>

      <div className="inspection-home-layout">
        <section className="inspection-latest-card">
          <header>
            <h2>Últimas misiones</h2>
            <button type="button" onClick={() => navigateTo("/mis-misiones")}>Ver todas</button>
          </header>
          <div className="inspection-latest-list">
            {isLoading ? (
              <p className="inspection-home-feedback">Cargando misiones...</p>
            ) : loadError ? (
              <p className="inspection-home-feedback error">{loadError}</p>
            ) : latestMissions.length ? (
              latestMissions.map((mission) => (
              <button className="inspection-latest-row" key={mission.idMission} onClick={() => onViewMission(mission.idMission)} type="button">
                <span className={`inspection-severity-line ${missionStatusClasses[mission.status]}`} />
                <span className="inspection-latest-name">
                  <strong>{mission.name}</strong>
                  <small>{missionDisplayDate(mission)}</small>
                </span>
                <span className={`inspection-severity-badge ${missionStatusClasses[mission.status]}`}>{missionStatusLabels[mission.status]}</span>
                <span className="inspection-finding-count">
                  <strong>{mission.completionPercentage}%</strong>
                  <small>avance</small>
                </span>
                <span className="inspection-chevron">›</span>
              </button>
              ))
            ) : (
              <p className="inspection-home-feedback">Todavía no hay misiones registradas.</p>
            )}
          </div>
        </section>

        <section className="inspection-map-card">
          <h2>Mapa de la planta</h2>
          <div className="inspection-map-shell">
            <AssetsOverviewMap assets={assets} onViewAsset={onViewAsset} plant={plant} />
          </div>
        </section>

        <section className="inspection-progress-card">
          <h2>Progreso semanal</h2>
          <div className="weekly-progress-content">
            <div
              className="weekly-progress-ring"
              style={{ "--mission-progress": `${completionPercentage}%` } as CSSProperties}
              aria-label={`${completionPercentage}% completado`}
            >
              <span>{completionPercentage}%</span>
            </div>
            <div className="weekly-progress-copy">
              <p>Misiones completadas</p>
              <strong>{completedMissions} de {totalMissions}</strong>
              <div className="weekly-progress-bar"><span style={{ width: `${completionPercentage}%` }} /></div>
              <small>{pendingMissions} pendientes o en curso</small>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}




