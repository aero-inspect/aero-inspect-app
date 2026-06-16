import { Fragment, useEffect, useState } from "react";
import { ArrowRight, LogOut, Package, MapPin, Radio, CheckCircle2, Clock, AlertCircle, Home as HomeIcon, Plane, Calendar, AlertTriangle, Battery, Navigation, Signal, Eye, Wind, Droplets, HelpCircle, UserRound, Search, Download, FileText } from "lucide-react";
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
import { CentroAyudaView } from "./CentroAyuda";
import { ActividadRecienteView } from "./ActividadReciente";
import { AppTopActions, DroneGlyph } from "../components/AppTopActions";
import { WeatherWidget } from "../components/WeatherWidget";
import droneImage from "../assets/drone-image.png";
import climaImage from "../assets/clima.jpg";
import { emptyWeather, fetchWeather } from "../services/weather";

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
  const isHelpPath = currentPath === "/centro-ayuda";
  const isActivityPath = currentPath === "/actividad-reciente";
  const userCanConsultAssets = canConsultAssets(user.role);
  const currentUser = users.find((u) => u.name === user.name);
  const currentProfileImage = currentUser?.profileImage ?? "";
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
          <button className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isDronePath && !isLaunchPath && !isMonitorPath && !isReportsPath && !isProfilePath && !isHelpPath && !isActivityPath ? "active" : undefined} onClick={() => navigateTo("/")} type="button">
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
        <button className={isProfilePath || isActivityPath ? "sidebar-user active" : "sidebar-user"} onClick={() => navigateTo("/perfil")} type="button">
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
        <button className={isHelpPath ? "sidebar-help-button active" : "sidebar-help-button"} onClick={() => navigateTo("/centro-ayuda")} type="button">
          <HelpCircle size={18} />
          <span>Centro de ayuda</span>
        </button>
      </aside>

      <section className={isRegisterAssetPath || isAssetsPath || isMissionPath || isMissionsPath || isReportsPath || isHelpPath || isActivityPath ? "workspace-no-header register-workspace" : "workspace-no-header"}>
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
        ) : isReportsPath ? (
          <ReportesView assets={assets} />
        ) : user.role === "Jefe de Planta" ? (
          <JefePlantaView assets={assets} missions={missions} onRegisterAsset={() => navigateTo("/registro-activo")} plant={MOCK_PLANT} />
        ) : user.role === "Tecnico de Mantenimiento" ? (
          <InspectionHomeView navigateTo={navigateTo} />
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
};

const inspectionItems = [
  {
    name: "Inspección Silo Norte",
    asset: "Silo Norte",
    datetime: "14/06/2026 - 14:32",
    findings: 14,
    severity: "Crítica",
    severityClass: "critical"
  },
  {
    name: "Inspección Cinta Transportadora 2",
    asset: "Cinta Transportadora 2",
    datetime: "14/06/2026 - 11:15",
    findings: 9,
    severity: "Alta",
    severityClass: "high"
  },
  {
    name: "Inspección Noria Principal",
    asset: "Noria Principal",
    datetime: "13/06/2026 - 16:48",
    findings: 6,
    severity: "Media",
    severityClass: "medium"
  },
  {
    name: "Inspección Techo Almacén 2",
    asset: "Techo Almacén 2",
    datetime: "12/06/2026 - 10:12",
    findings: 0,
    severity: "Sin hallazgos",
    severityClass: "low"
  }
];

function InspectionHomeView({ navigateTo }: InspectionHomeViewProps) {
  const [weather, setWeather] = useState(emptyWeather);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setWeather(await fetchWeather());
      } catch (error) {
        console.error("Error fetching weather:", error);
        setWeather((current) => ({ ...current, desc: "Sin conexión", loading: false }));
      }
    };

    loadWeather();
  }, []);

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
        <main className="inspection-home-main">
          <section className="findings-overview-card" aria-label="Resumen de hallazgos detectados">
            <div className="findings-overview-total">
              <span>Hallazgos detectados</span>
              <strong>126</strong>
              <p>Total</p>
            </div>
            <div className="findings-overview-breakdown">
              <span className="severity-summary critical"><i />8 Críticos</span>
              <span className="severity-summary high"><i />21 Altos</span>
              <span className="severity-summary medium"><i />47 Medios</span>
              <span className="severity-summary low"><i />50 Bajos</span>
            </div>
          </section>

          <section className="inspection-console-card">
            <div className="inspection-console-toolbar">
              <div className="inspection-filter-tabs" aria-label="Filtros de inspecciones">
                <button className="active" type="button">Todas</button>
                <button type="button">Críticas</button>
                <button type="button">Con hallazgos</button>
                <button type="button">Sin hallazgos</button>
              </div>
              <label className="inspection-search-box">
                <Search size={18} />
                <input type="search" placeholder="Buscar inspección..." />
              </label>
            </div>

            <div className="inspection-card-list">
              {inspectionItems.map((inspection) => (
                <article className="inspection-result-card" key={inspection.name}>
                  <div className="inspection-result-main">
                    <div className={`inspection-severity-line ${inspection.severityClass}`} />
                    <div>
                      <h2>{inspection.name}</h2>
                      <p>{inspection.asset}</p>
                    </div>
                  </div>

                  <div className="inspection-result-meta">
                    <span>{inspection.findings} hallazgos detectados</span>
                    <span className={`severity-pill ${inspection.severityClass}`}>{inspection.severity}</span>
                    <span>{inspection.datetime}</span>
                  </div>

                  <div className="inspection-result-actions">
                    <button type="button" onClick={() => navigateTo("/monitorear-mision")}>
                      <Eye size={16} />
                      Ver detalle
                    </button>
                    <button type="button" onClick={() => navigateTo("/reportes")}>
                      <FileText size={16} />
                      Ver reporte
                    </button>
                    <button className="download" type="button">
                      <Download size={16} />
                      Descargar reporte
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="inspection-home-side">
          <section className="inspection-side-card drone-status-card">
            <div className="inspection-side-heading">
              <h2>Estado del dron</h2>
              <span className="side-status ok">Operativo</span>
            </div>
            <img className="inspection-side-image drone" src={droneImage} alt="Drone principal" />
            <div className="side-drone-title">
              <Plane size={22} />
              <strong>Drone principal</strong>
            </div>
            <div className="side-info-row">
              <span>Batería</span>
              <strong>87%</strong>
            </div>
            <div className="inspection-battery-track"><span style={{ width: "87%" }} /></div>
            <div className="side-info-row compact">
              <span><Navigation size={16} /> GPS conectado</span>
            </div>
          </section>

          <section className="inspection-side-card weather-status-card">
            <div className="inspection-side-heading">
              <h2>Clima actual</h2>
            </div>
            <img className="inspection-side-image weather" src={climaImage} alt="Clima actual" />
            <div className="weather-main-value">{weather.temp}°C</div>
            <p className="weather-current-desc">{weather.desc}</p>
            <div className="weather-side-grid">
              <span><Wind size={16} /> Viento: {weather.wind} km/h</span>
              <span><Droplets size={16} /> Humedad: {weather.humidity}%</span>
            </div>
            <div className={`flight-ready-badge ${weather.loading ? "loading" : ""}`}>
              <CheckCircle2 size={16} />
              {weather.loading ? "Consultando clima" : "Apto para vuelo"}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}






