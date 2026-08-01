import { Fragment, useState } from "react";
import { ArrowRight, LogOut, Package, MapPin, Radio, CheckCircle2, Clock, AlertCircle, Home as HomeIcon, Plane, AlertTriangle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { MockUser, InspectionMission, Asset, Plant, SessionUser, MapMarker } from "../types";
import { canConsultAssets, getRoleHomeTitle } from "../utils/helpers";
import { DRONE_OPERATION_ROLES } from "../constants";
import { LeafletSatelliteMap } from "../components/LeafletSatelliteMap";
import { MisActivosView } from "./MisActivos";
import { ConfigurarMisionView } from "./ConfigurarMision";
import { MisMisionesView } from "./MisMisiones";
import { DroneTelemetryView } from "./DroneTelemetry";
import { LaunchMissionView } from "./LaunchMission";
import { RegistrarActivoView } from "./RegistrarActivo";
import { ProfileView } from "./Perfil";
import { RoleManagementView } from "./GestionRoles";
import { JefePlantaView } from "./JefePlanta";
import { MonitorMissionView } from "./MonitorMission";
import { ReportesView } from "./Reportes";
import { CrearReporteView } from "./CrearReporte";
import { ReporteDetalleView } from "./ReporteDetalle";
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
  setUsers
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
}) {
  const isRegisterAssetPath = currentPath === "/registro-activo";
  const isAssetsPath = currentPath === "/mis-activos";
  const isMissionPath = currentPath === "/configurar-mision";
  const isMissionsPath = currentPath === "/mis-misiones";
  const isDronePath = currentPath === "/dron";
  const isLaunchPath = currentPath === "/ejecutar-despegue";
  const isProfilePath = currentPath === "/perfil";
  const isRoleMgmtPath = currentPath === "/gestion-roles";
  const isMonitorPath = currentPath === "/monitorear-mision";
  const isReportsPath = currentPath === "/reportes";
  const isCreateReportPath = currentPath === "/crear-reporte";
  const isReportDetailPath = currentPath === "/reporte-detalle";
  const isHelpPath = currentPath === "/centro-ayuda";
  const isActivityPath = currentPath === "/actividad-reciente";
  const userCanConsultAssets = canConsultAssets(user.role);
  const currentUser = users.find((u) => u.name === user.name);
  const currentProfileImage = currentUser?.profileImage ?? "";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
          <button className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isDronePath && !isLaunchPath && !isMonitorPath && !isReportsPath && !isCreateReportPath && !isReportDetailPath && !isHelpPath && !isActivityPath ? "active" : undefined} onClick={() => navigateTo("/")} type="button">
            <HomeIcon size={20} />
            {!isSidebarCollapsed && <span>Inicio</span>}
          </button>

          {(userCanConsultAssets || user.role === "Jefe de Planta") && (
            <>
              {user.role === "Jefe de Planta" && (
                <button className={isRegisterAssetPath ? "active" : undefined} onClick={() => navigateTo("/registro-activo")} type="button">
                  <Package size={20} />
                  {!isSidebarCollapsed && <span>Activos</span>}
                </button>
              )}
              {userCanConsultAssets && (
                <button className={isAssetsPath ? "active" : undefined} onClick={() => navigateTo("/mis-activos")} type="button">
                  <Package size={20} />
                  {!isSidebarCollapsed && <span>Activos</span>}
                </button>
              )}
            </>
          )}

          {DRONE_OPERATION_ROLES.includes(user.role) && (
            <button className={isDronePath ? "active" : undefined} onClick={() => navigateTo("/dron")} type="button">
              <DroneGlyph />
              {!isSidebarCollapsed && <span>Drones</span>}
            </button>
          )}

          {(userCanConsultAssets || user.role === "Tecnico de Mantenimiento") && (
            <button className={isMissionsPath || isMissionPath ? "active" : undefined} onClick={() => navigateTo("/mis-misiones")} type="button">
              <Plane size={20} />
              {!isSidebarCollapsed && <span>Misiones</span>}
            </button>
          )}

          {user.role === "Jefe de Planta" && (
            <button onClick={() => navigateTo("/hallazgos")} type="button">
              <AlertTriangle size={20} />
              {!isSidebarCollapsed && <span>Hallazgos IA</span>}
            </button>
          )}

          <button className={isReportsPath || isCreateReportPath || isReportDetailPath ? "active" : undefined} onClick={() => navigateTo("/reportes")} type="button">
            <CheckCircle2 size={20} />
            {!isSidebarCollapsed && <span>Reportes</span>}
          </button>
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

      <section className={isRegisterAssetPath || isAssetsPath || isMissionPath || isMissionsPath || isReportsPath || isCreateReportPath || isReportDetailPath || isHelpPath || isActivityPath ? "workspace-no-header register-workspace" : "workspace-no-header"}>
        {!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isHelpPath && !isActivityPath && user.role !== "Tecnico de Mantenimiento" && user.role !== "Jefe de Planta" && (
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

        {isActivityPath ? (
          <ActividadRecienteView />
        ) : isHelpPath ? (
          <CentroAyudaView />
        ) : isProfilePath ? (
          <ProfileView user={user} users={users} setUsers={setUsers} onBack={() => navigateTo("/")} onAssignRoles={() => navigateTo("/gestion-roles")} onViewActivity={() => navigateTo("/actividad-reciente")} onLogout={() => { navigateTo("/"); onLogout(); }} />
        ) : isRegisterAssetPath && (userCanConsultAssets || user.role === "Jefe de Planta") ? (
          <RegistrarActivoView assets={assets} onBack={() => navigateTo("/mis-activos")} onCreateAsset={(asset) => setAssets((current) => [...current, { ...asset, id: Date.now(), plantId: MOCK_PLANT.id }])} onGoHome={() => navigateTo("/")} onViewAssets={() => navigateTo("/mis-activos")} plant={MOCK_PLANT} />
        ) : isRoleMgmtPath && user.role === "Jefe de Planta" ? (
          <RoleManagementView users={users} setUsers={setUsers} onBack={() => navigateTo("/")} />
        ) : isMonitorPath && userCanConsultAssets ? (
          <MonitorMissionView missions={missions} assets={assets} plant={MOCK_PLANT} onBack={() => navigateTo("/mis-misiones")} />
        ) : isMissionsPath ? (
          <MisMisionesView
            missions={missions}
            assets={assets}
            onBack={() => navigateTo("/")}
            onCreateMission={() => navigateTo("/configurar-mision")}
            onViewMission={() => navigateTo("/monitorear-mision")}
            plant={MOCK_PLANT}
          />
        ) : isMissionPath && user.role === "Tecnico de Mantenimiento" ? (
          <ConfigurarMisionView assets={assets} missions={missions} onBack={() => navigateTo("/mis-misiones")} onCreateMission={(mission) => {
            setMissions((current) => [...current, { ...mission, id: Date.now(), status: "Pendiente" }]);
          }} plant={MOCK_PLANT} />
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
          <DroneTelemetryView onBack={() => navigateTo("/")} droneConnected={droneConnected} setDroneConnected={setDroneConnected} battery={battery} setBattery={setBattery} />
        ) : isAssetsPath && userCanConsultAssets ? (
          <MisActivosView assets={assets} onBack={() => navigateTo("/")} onDeleteAsset={(assetId) => setAssets((current) => current.filter((asset) => asset.id !== assetId))} onRegisterAsset={() => navigateTo("/registro-activo")} onUpdateAsset={(nextAsset) => setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)))} plant={MOCK_PLANT} />
        ) : isCreateReportPath ? (
          <CrearReporteView onBack={() => navigateTo("/reportes")} />
        ) : isReportDetailPath ? (
          <ReporteDetalleView onBack={() => navigateTo("/reportes")} />
        ) : isReportsPath ? (
          <ReportesView assets={assets} onCreateReport={() => navigateTo("/crear-reporte")} onViewReport={() => navigateTo("/reporte-detalle")} />
        ) : user.role === "Jefe de Planta" ? (
          <JefePlantaView assets={assets} missions={missions} onRegisterAsset={() => navigateTo("/registro-activo")} plant={MOCK_PLANT} />
        ) : user.role === "Tecnico de Mantenimiento" ? (
          <InspectionHomeView navigateTo={navigateTo} plant={MOCK_PLANT} />
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
  plant: Plant;
};

const inspectionItems = [
  {
    name: "Silo Norte",
    asset: "Silo Norte",
    datetime: "Hace 15 min",
    findings: 14,
    severity: "Crítica",
    severityClass: "critical"
  },
  {
    name: "Cinta Transportadora",
    asset: "Cinta Transportadora 2",
    datetime: "Hace 35 min",
    findings: 8,
    severity: "Media",
    severityClass: "medium"
  },
  {
    name: "Noria Principal",
    asset: "Noria Principal",
    datetime: "Hace 2 h",
    findings: 3,
    severity: "Baja",
    severityClass: "low"
  },
  {
    name: "Tubería de Vapor",
    asset: "Tubería de Vapor",
    datetime: "Ayer 16:20",
    findings: 6,
    severity: "Baja",
    severityClass: "low"
  }
];

const inspectionKpis = [
  { label: "Inspecciones hoy", value: "3", tone: "blue", icon: <Search size={21} /> },
  { label: "En progreso", value: "2", tone: "amber", icon: <Clock size={18} /> },
  { label: "Hallazgos críticos", value: "7", tone: "red", icon: <AlertTriangle size={20} /> },
  { label: "Drones disponibles", value: "1 / 2", tone: "gray", icon: <DroneGlyph size={22} /> }
];

function InspectionHomeView({ navigateTo, plant }: InspectionHomeViewProps) {
  const plantMarkers: MapMarker[] = [
    { id: "silo", label: "Silo Norte", latitude: "-35.14031", longitude: "-60.45857", type: "Silo" },
    { id: "noria", label: "Noria Principal", latitude: "-35.14069", longitude: "-60.45809", type: "Noria" },
    { id: "cinta", label: "Cinta Transportadora", latitude: "-35.14098", longitude: "-60.45843", type: "Cinta transportadora" },
    { id: "tuberia", label: "Tubería", latitude: "-35.14047", longitude: "-60.45772", type: "Tuberia" }
  ];

  return (
    <div className="tech-dashboard inspection-home">
      <div className="inspection-home-header">
        <div>
          <h1>Inicio</h1>
          <p>Resumen de inspecciones y hallazgos detectados.</p>
        </div>
        <AppTopActions />
      </div>

      <div className="inspection-home-layout">
        <section className="inspection-kpi-grid" aria-label="Resumen del día">
          {inspectionKpis.map((item) => (
            <article className="inspection-kpi-card" key={item.label}>
              <span className={`inspection-kpi-icon ${item.tone}`}>{item.icon}</span>
              <div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="inspection-latest-card">
          <header>
            <h2>Últimas inspecciones</h2>
            <button type="button" onClick={() => navigateTo("/mis-misiones")}>Ver todas</button>
          </header>
          <div className="inspection-latest-list">
            {inspectionItems.map((inspection) => (
              <button className="inspection-latest-row" key={inspection.name} onClick={() => navigateTo("/monitorear-mision")} type="button">
                <span className={`inspection-severity-line ${inspection.severityClass}`} />
                <span className="inspection-latest-name">
                  <strong>{inspection.name}</strong>
                  <small>{inspection.datetime}</small>
                </span>
                <span className={`inspection-severity-badge ${inspection.severityClass}`}>{inspection.severity}</span>
                <span className="inspection-finding-count">
                  <strong>{inspection.findings}</strong>
                  <small>hallazgos</small>
                </span>
                <span className="inspection-chevron">›</span>
              </button>
            ))}
          </div>
        </section>

        <section className="inspection-map-card">
          <h2>Mapa de la planta</h2>
          <div className="inspection-map-shell">
            <LeafletSatelliteMap markers={plantMarkers} plant={plant} />
          </div>
        </section>

        <section className="inspection-progress-card">
          <h2>Progreso semanal</h2>
          <div className="weekly-progress-content">
            <div className="weekly-progress-ring" aria-label="68% completado">
              <span>68%</span>
            </div>
            <div className="weekly-progress-copy">
              <p>Inspecciones completadas</p>
              <strong>24 de 35</strong>
              <div className="weekly-progress-bar"><span /></div>
              <small>11 pendientes</small>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}




