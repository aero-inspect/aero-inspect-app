import { useState } from "react";
import { ArrowRight, Bell, LogOut, Package, MapPin, Radio, CheckCircle2, Clock, AlertCircle, Home as HomeIcon, Plane, Calendar, AlertTriangle, Battery, Navigation, Signal, Eye, Wind, Droplets, Sun, HelpCircle, UserRound } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { MockUser, InspectionMission, Asset, Plant, SessionUser } from "../types";
import { canConsultAssets, getRoleHomeTitle, getUserInitials } from "../utils/helpers";
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
  const userCanConsultAssets = canConsultAssets(user.role);
  const currentUser = users.find((u) => u.name === user.name);
  const currentProfileImage = currentUser?.profileImage ?? "";
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <main className="home-shell-no-header">
      <aside className="sidebar-full">
        <div className="sidebar-brand">
          <img className="sidebar-brand-drone" src="/src/assets/aeroinspect-drone.png" alt="" aria-hidden="true" />
          <span className="sidebar-brand-text">
            <span>Aero</span>
            <strong>Inspect</strong>
          </span>
        </div>
        <nav className="nav-list" aria-label="Principal">
          <button className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isDronePath && !isLaunchPath && !isMonitorPath && !isReportsPath && !isProfilePath ? "active" : undefined} onClick={() => navigateTo("/")} type="button">
            <HomeIcon size={20} />
            <span>Inicio</span>
          </button>
          
          {(userCanConsultAssets || user.role === "Jefe de Planta") && (
            <>
              {user.role === "Jefe de Planta" && (
                <button className={isRegisterAssetPath ? "active" : undefined} onClick={() => navigateTo("/registro-activo")} type="button">
                  <Package size={20} />
                  <span>Activos</span>
                </button>
              )}
              {userCanConsultAssets && (
                <button className={isAssetsPath ? "active" : undefined} onClick={() => navigateTo("/mis-activos")} type="button">
                  <Package size={20} />
                  <span>Activos</span>
                </button>
              )}
            </>
          )}

          {(userCanConsultAssets || user.role === "Tecnico de Mantenimiento") && (
            <>
              <button className={isMissionsPath || isMissionPath ? "active" : undefined} onClick={() => navigateTo("/mis-misiones")} type="button">
                <Plane size={20} />
                <span>Misiones</span>
              </button>
            </>
          )}

          {user.role === "Jefe de Planta" && (
            <button onClick={() => navigateTo("/hallazgos")} type="button">
              <AlertTriangle size={20} />
              <span>Hallazgos IA</span>
            </button>
          )}

          <button className={isReportsPath ? "active" : undefined} onClick={() => navigateTo("/reportes")} type="button">
            <CheckCircle2 size={20} />
            <span>Reportes</span>
          </button>

          {DRONE_OPERATION_ROLES.includes(user.role) && (
            <button className={isDronePath ? "active" : undefined} onClick={() => navigateTo("/dron")} type="button">
              <DroneGlyph />
              <span>Drones</span>
            </button>
          )}
        </nav>

        {/* User Profile Section at Bottom */}
        <button className={isProfilePath ? "sidebar-user active" : "sidebar-user"} onClick={() => navigateTo("/perfil")} type="button">
          {currentProfileImage ? (
            <img className="sidebar-user-avatar" src={currentProfileImage} alt="Foto de perfil" />
          ) : (
            <div className="sidebar-user-avatar">{getUserInitials(user.name)}</div>
          )}
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.role}</div>
            <div className="sidebar-user-status">
              <span className="status-dot"></span>
              En línea
            </div>
          </div>
          <ArrowRight className="sidebar-user-arrow" size={15} aria-hidden="true" />
        </button>
        <button className="sidebar-help-button" type="button">
          <HelpCircle size={18} />
          <span>Centro de ayuda</span>
        </button>
      </aside>

      <section className={isRegisterAssetPath || isAssetsPath || isMissionPath || isMissionsPath || isReportsPath ? "workspace-no-header register-workspace" : "workspace-no-header"}>
        {!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && user.role !== "Tecnico de Mantenimiento" && user.role !== "Jefe de Planta" && (
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

        {isProfilePath ? (
          <ProfileView user={user} users={users} setUsers={setUsers} onBack={() => navigateTo("/")} onAssignRoles={() => navigateTo("/gestion-roles")} onLogout={() => { navigateTo("/"); onLogout(); }} />
        ) : isRegisterAssetPath && (userCanConsultAssets || user.role === "Jefe de Planta") ? (
          <RegistrarActivoView assets={assets} onBack={() => navigateTo("/mis-activos")} onCreateAsset={(asset) => setAssets((current) => [...current, { ...asset, id: Date.now(), plantId: MOCK_PLANT.id }])} onGoHome={() => navigateTo("/")} onViewAssets={() => navigateTo("/mis-activos")} plant={MOCK_PLANT} />
        ) : isRoleMgmtPath && user.role === "Jefe de Planta" ? (
          <RoleManagementView users={users} setUsers={setUsers} onBack={() => navigateTo("/")} />
        ) : isMonitorPath && userCanConsultAssets ? (
          <MonitorMissionView missions={missions} assets={assets} plant={MOCK_PLANT} onBack={() => navigateTo("/")} />
        ) : isMissionsPath ? (
          <MisMisionesView
            missions={missions}
            assets={assets}
            onBack={() => navigateTo("/")}
            onCreateMission={() => navigateTo("/configurar-mision")}
            plant={MOCK_PLANT}
          />
        ) : isMissionPath && user.role === "Tecnico de Mantenimiento" ? (
          <ConfigurarMisionView assets={assets} missions={missions} onBack={() => navigateTo("/")} onCreateMission={(mission) => {
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
          <MisActivosView assets={assets} onBack={() => navigateTo("/")} onRegisterAsset={() => navigateTo("/registro-activo")} onUpdateAsset={(nextAsset) => setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)))} plant={MOCK_PLANT} />
        ) : isReportsPath ? (
          <ReportesView assets={assets} />
        ) : user.role === "Jefe de Planta" ? (
          <JefePlantaView assets={assets} missions={missions} onRegisterAsset={() => navigateTo("/registro-activo")} plant={MOCK_PLANT} />
        ) : user.role === "Tecnico de Mantenimiento" ? (
          <>
            {/* New Maintenance Technician Dashboard */}
            <div className="tech-dashboard">
              <div className="tech-topbar">
                <div className="tech-greeting">
                  <h1>¡Buenos días, Emilia! 👋</h1>
                  <p className="tech-subtitle">Aquí tienes un resumen de la operación actual.</p>
                </div>

                <div className="tech-top-actions">
                  <div className="tech-weather">
                    <Sun size={34} className="weather-icon" />
                    <div className="weather-info">
                      <span className="weather-temp">23°C</span>
                      <span className="weather-desc">Parcialmente nublado</span>
                    </div>
                  </div>
                  <NotificationButton isOpen={isNotificationsOpen} onToggle={() => setIsNotificationsOpen((current) => !current)} />
                  <button className="tech-user-button" onClick={() => navigateTo("/perfil")} type="button" aria-label="Perfil">
                    <UserRound size={21} />
                  </button>
                </div>
              </div>

              {/* Stats Cards Row */}
              <div className="tech-stats-row">
                <div className="tech-stat-card">
                  <div className="stat-icon stat-icon-green">
                    <Package size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-label">Activos registrados</span>
                    <span className="stat-value">{assets.length}</span>
                    <button className="stat-link" onClick={() => navigateTo("/mis-activos")}>
                      Ver activos <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="tech-stat-card">
                  <div className="stat-icon stat-icon-green">
                    <Plane size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-label">Misiones totales</span>
                    <span className="stat-value">{missions.length}</span>
                    <button className="stat-link" onClick={() => navigateTo("/mis-misiones")}>
                      Ver misiones <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="tech-stat-card">
                  <div className="stat-icon stat-icon-green">
                    <Calendar size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-label">Misiones hoy</span>
                    <span className="stat-value">3</span>
                    <button className="stat-link">
                      Ver detalle <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="tech-stat-card">
                  <div className="stat-icon stat-icon-red">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-label">Alertas activas</span>
                    <span className="stat-value">2</span>
                    <button className="stat-link">
                      Ver alertas <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="tech-stat-card">
                  <div className="stat-icon stat-icon-green">
                    <Battery size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-label">Dron conectado</span>
                    <span className="stat-value">98%</span>
                    <span className="stat-link-text">Estado batería</span>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="tech-main-grid">
                {/* Plant Map */}
                <div className="tech-map-section">
                  <h2 className="section-title">Mapa de la planta</h2>
                  <div className="tech-map-container">
                    <LeafletSatelliteMap
                      markers={assets.map(asset => ({
                        id: asset.id,
                        latitude: asset.latitude,
                        longitude: asset.longitude,
                        label: asset.name,
                        type: asset.type
                      }))}
                      plant={MOCK_PLANT}
                    />
                  </div>
                </div>

                {/* Upcoming Missions */}
                <div className="tech-missions-section">
                  <div className="section-header">
                    <h2 className="section-title">Misiones próximas</h2>
                    <button className="view-all-btn" onClick={() => navigateTo("/mis-misiones")}>
                      Ver todas <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="tech-missions-list">
                    <div className="tech-mission-card">
                      <div className="mission-details">
                        <h3 className="mission-name">Inspección Silo Norte</h3>
                        <div className="mission-location">
                          <MapPin size={14} />
                          <span>Silo Norte</span>
                        </div>
                      </div>
                      <div className="mission-meta">
                        <div className="mission-time">
                          <Clock size={14} />
                          <span>09:30</span>
                        </div>
                        <span className="mission-badge badge-pending">Pendiente</span>
                      </div>
                    </div>

                    <div className="tech-mission-card">
                      <div className="mission-details">
                        <h3 className="mission-name">Cinta Transportadora 2</h3>
                        <div className="mission-location">
                          <MapPin size={14} />
                          <span>Sector Este</span>
                        </div>
                      </div>
                      <div className="mission-meta">
                        <div className="mission-time">
                          <Clock size={14} />
                          <span>11:15</span>
                        </div>
                        <span className="mission-badge badge-pending">Pendiente</span>
                      </div>
                    </div>

                    <div className="tech-mission-card">
                      <div className="mission-details">
                        <h3 className="mission-name">Noria Principal</h3>
                        <div className="mission-location">
                          <MapPin size={14} />
                          <span>Sector Central</span>
                        </div>
                      </div>
                      <div className="mission-meta">
                        <div className="mission-time">
                          <Clock size={14} />
                          <span>14:00</span>
                        </div>
                        <span className="mission-badge badge-progress">En progreso 🚁</span>
                      </div>
                    </div>
                  </div>

                  {/* Ready to Fly Card */}
                  <div className="tech-ready-card">
                    <Plane size={32} className="ready-icon" />
                    <div className="ready-content">
                      <h3>¿Listo para volar?</h3>
                      <p>Verifica el estado del dron</p>
                    </div>
                    <button className="ready-btn" onClick={() => navigateTo("/dron")}>
                      Ir a Telemetría <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Section */}
              <div className="tech-bottom-grid">
                {/* Recent Missions Table */}
                <div className="tech-recent-section">
                  <div className="section-header">
                    <h2 className="section-title">Misiones recientes</h2>
                    <button className="view-all-btn" onClick={() => navigateTo("/mis-misiones")}>
                      Ver historial <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="tech-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Misión</th>
                          <th>Activo</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.slice(0, 3).map((mission) => (
                          <tr key={mission.id}>
                            <td>
                              <div className="table-mission-icon">
                                <Package size={16} />
                              </div>
                              <span>Inspección Silos</span>
                            </td>
                            <td>{mission.assetName}</td>
                            <td>{mission.startedAt ? new Date(mission.startedAt).toLocaleDateString('es-ES') : '-'}</td>
                            <td>
                              <span className={`table-status status-${mission.status?.toLowerCase().replace(" ", "-")}`}>
                                <CheckCircle2 size={14} />
                                {mission.status}
                              </span>
                            </td>
                            <td>
                              <button className="table-action-btn">
                                <ArrowRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Weather Details */}
                <div className="tech-weather-section">
                  <h2 className="section-title">Clima actual</h2>
                  <button className="weather-forecast-btn">
                    Ver pronóstico <ArrowRight size={14} />
                  </button>
                  <div className="weather-display">
                    <Sun size={80} className="weather-main-icon" />
                    <div className="weather-main-temp">23°C</div>
                    <div className="weather-main-desc">Parcialmente nublado</div>
                  </div>
                  <div className="weather-details-grid">
                    <div className="weather-detail-item">
                      <Wind size={20} />
                      <div>
                        <span className="detail-value">14 km/h</span>
                        <span className="detail-label">Viento</span>
                      </div>
                    </div>
                    <div className="weather-detail-item">
                      <Droplets size={20} />
                      <div>
                        <span className="detail-value">48%</span>
                        <span className="detail-label">Humedad</span>
                      </div>
                    </div>
                    <div className="weather-detail-item">
                      <Eye size={20} />
                      <div>
                        <span className="detail-value">10 km</span>
                        <span className="detail-label">Visibilidad</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drone Status */}
                <div className="tech-drone-section">
                  <h2 className="section-title">Estado del dron</h2>
                  <span className="drone-status-badge">Conectado</span>
                  <div className="drone-image-container">
                    <img src="/src/assets/aeroinspect-drone.png" alt="Dron" className="drone-image" />
                  </div>
                  <div className="drone-battery">
                    <Battery size={20} />
                    <div className="battery-bar">
                      <div className="battery-fill" style={{ width: '98%' }}></div>
                    </div>
                    <span className="battery-percent">98%</span>
                  </div>
                  <div className="drone-details-grid">
                    <div className="drone-detail-item">
                      <Navigation size={18} className="detail-icon-green" />
                      <div>
                        <span className="detail-label">GPS</span>
                        <span className="detail-value-green">Bueno</span>
                      </div>
                    </div>
                    <div className="drone-detail-item">
                      <Signal size={18} className="detail-icon-green" />
                      <div>
                        <span className="detail-label">Señal</span>
                        <span className="detail-value-green">Excelente</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">Bienvenido, {user.name}</p>
                <h1>Panel de Control</h1>
                <p className="role-label">Rol: {user.role}</p>
              </div>
            </header>

            <div className="dashboard-grid">
              {/* Quick Stats */}
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

              {/* Recent Missions */}
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

              {/* Quick Actions */}
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

              {/* Plant Info */}
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
          </>
        )}
      </section>
    </main>
  );
}

function NotificationButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const notifications = [
    { tone: "danger", title: "Hallazgo critico detectado", text: "Se detecto corrosion severa en Silo Norte.", time: "Hace 5 min", icon: <AlertTriangle size={18} /> },
    { tone: "info", title: "Mision en progreso", text: "Inspeccion Cinta Transportadora 2 completada al 40%.", time: "Hace 12 min", icon: <DroneGlyph size={18} /> },
    { tone: "success", title: "Reporte generado", text: "El reporte mensual de mayo esta listo para descargar.", time: "Hace 1 hora", icon: <CheckCircle2 size={18} /> },
    { tone: "warning", title: "Mantenimiento programado", text: "El mantenimiento del dron esta programado para 10/06/2025.", time: "Hace 3 horas", icon: <Calendar size={18} /> },
    { tone: "purple", title: "Nueva mision asignada", text: "Se te asigno la mision Inspeccion Noria Principal.", time: "Hace 1 dia", icon: <Plane size={18} /> }
  ];

  return (
    <div className="notifications-menu-wrap">
      <button className="tech-notification-button" onClick={onToggle} type="button" aria-label="Notificaciones">
        <Bell size={20} />
        <span>3</span>
      </button>

      {isOpen && (
        <section className="notifications-popover" aria-label="Notificaciones">
          <header>
            <h2>Notificaciones</h2>
            <button type="button">Marcar todas como leidas</button>
          </header>
          <div className="notifications-list">
            {notifications.map((item) => (
              <article className="notification-item" key={item.title}>
                <span className={`notification-icon ${item.tone}`}>{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                  <small>{item.time}</small>
                </div>
                <i />
              </article>
            ))}
          </div>
          <button className="notifications-all-button" type="button">
            Ver todas las notificaciones
            <ArrowRight size={14} />
          </button>
        </section>
      )}
    </div>
  );
}

function DroneGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 8h10M12 8v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9.5 13h5l1.6 3H7.9L9.5 13Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="5" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="19" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 5.8V4M19 5.8V4M9.5 18h-2M14.5 18h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
