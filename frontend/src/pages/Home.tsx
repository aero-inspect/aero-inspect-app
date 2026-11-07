import { Fragment, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, LogOut, Package, MapPin, Radio, CheckCircle2, Clock, AlertCircle, Home as HomeIcon, Plane, ChevronLeft, ChevronRight, UsersRound, Route as RouteIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { MockUser, InspectionMission, Asset, Plant, SessionUser } from "../types";
import type { BackendAsset, BackendMission } from "../api/types";
import { getAssets, getMissions, getReports } from "../api/client";
import { canConsultAssets, getRoleHomeTitle } from "../utils/helpers";
import { DRONE_OPERATION_ROLES, PLAN_CREATION_ROLES } from "../constants";
import { AssetsOverviewMap } from "../components/AssetsOverviewMap";
import { MisActivosView } from "./MisActivos";
import { ConfigurarMisionView } from "./ConfigurarMision";
import { GenerarPlanVueloView } from "./GenerarPlanVuelo";
import { InspeccionManualView } from "./InspeccionManual";
import { MisMisionesView } from "./MisMisiones";
import { PlanesVueloView } from "./PlanesVuelo";
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
import { TemporaryManualAnalysisShortcut } from "../components/TemporaryManualAnalysisShortcut";
import { ReporteDetalleRealView } from "./ReporteDetalleReal";
import { CentroAyudaView } from "./CentroAyuda";
import { ActividadRecienteView } from "./ActividadReciente";
import { AppTopActions, SharedHeaderContext, DroneGlyph } from "../components/AppTopActions";
import { LoadingState } from "../components/LoadingState";
import sidebarLogo from "../assets/aeroinspect-sidebar-logo.png";

import { PLANTS, PLANT_STORAGE_KEY } from "../data/plants";
import { ROUTES, RESERVED_SEGMENTS, plantPath } from "../routes";
import { PlantContext } from "../data/PlantContext";
import { ActivityProvider } from "../data/ActivityContext";
import { setApiPlant } from "../api/client";


const ManualAnalysisView = lazy(() => import("./ManualAnalysis").then(module => ({ default: module.ManualAnalysisView })));

export function Home({
  plant: selectedPlant,
  user,
  onLogout,
  assets: allAssets,
  missions: allMissions,
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
  plant: Plant;
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // La planta viene de la URL: se deja lista para las llamadas a la API antes de renderizar las vistas.
  setApiPlant(selectedPlant);
  useEffect(() => {
    try { localStorage.setItem(PLANT_STORAGE_KEY, selectedPlant.id); } catch { /* Selection still works without storage. */ }
  }, [selectedPlant.id]);

  // Ruta sin el prefijo de la planta, p. ej. "/missions/new".
  const currentPath = location.pathname.slice(`/${selectedPlant.id}`.length).replace(/\/+$/, "") || ROUTES.home;
  const navigateTo = (route: string) => navigate(plantPath(selectedPlant.id, route));
  const detailOf = (base: string, reserved: readonly string[]) => {
    if (!currentPath.startsWith(`${base}/`)) return null;
    const segment = currentPath.slice(base.length + 1);
    return segment && !segment.includes("/") && !reserved.includes(segment) ? segment : null;
  };

  // Lo que antes se guardaba en estado ahora viaja en la URL.
  const searchKey = searchParams.toString();
  const selectedFlightPlanIds = useMemo(
    () => searchParams.getAll("planId").map(Number).filter(Number.isInteger),
    [searchKey]
  );
  const recordingParam = Number(searchParams.get("recordingId"));
  const selectedRecordingId = searchParams.get("recordingId") && Number.isInteger(recordingParam) ? recordingParam : null;
  const captureParam = Number(searchParams.get("assetId"));
  const reportCaptureAssetId = searchParams.get("assetId") && Number.isInteger(captureParam) ? captureParam : null;
  const viewAssetHistory = (idAsset: number) => navigate({ pathname: plantPath(selectedPlant.id, ROUTES.reports), search: `?assetId=${idAsset}` });

  const assets = allAssets.filter(asset => asset.plantId === selectedPlant.id);
  const missions = allMissions.filter(mission => assets.some(asset => asset.id === mission.assetId));
  const selectedAssetParam = detailOf(ROUTES.assets, RESERVED_SEGMENTS.assets);
  const selectedAssetId = selectedAssetParam !== null && Number.isInteger(Number(selectedAssetParam)) ? Number(selectedAssetParam) : null;
  const isRegisterAssetPath = currentPath === ROUTES.assetsNew;
  const isAssetsPath = currentPath === ROUTES.assets || selectedAssetParam !== null;
  const isMissionPath = currentPath === ROUTES.missionsNew;
  const isMissionsPath = currentPath === ROUTES.missions;
  const isPlansPath = currentPath === ROUTES.flightPlans;
  const isGeneratePlanPath = currentPath === ROUTES.flightPlansNew;
  const isManualInspectionPath = currentPath === ROUTES.manualInspection;
  const isDronePath = currentPath === ROUTES.dronesTelemetry;
  const isDronesAbmPath = currentPath === ROUTES.drones;
  const isLaunchPath = currentPath === ROUTES.missionsLaunch;
  const isProfilePath = currentPath === ROUTES.profile;
  const isRoleMgmtPath = currentPath === ROUTES.staff;
  const isMonitorPath = detailOf(ROUTES.missions, RESERVED_SEGMENTS.missions) !== null;
  const isReportsPath = currentPath === ROUTES.reports;
  const isCreateReportPath = currentPath === ROUTES.reportsNew;
  const isReportDetailPath = currentPath === ROUTES.reportsDemoDetail;
  const isSavedReportPath = detailOf(ROUTES.reports, RESERVED_SEGMENTS.reports) !== null;
  const isTemporaryAnalysisPath = currentPath === ROUTES.reportsManualAnalysis;
  const isReportDetailRealPath = isSavedReportPath || isTemporaryAnalysisPath;
  const isHelpPath = currentPath === ROUTES.help;
  const isActivityPath = currentPath === ROUTES.profileActivity;
  const isPruebaTelemetriaPath = currentPath === ROUTES.dronesTelemetryTest;
  const userCanConsultAssets = canConsultAssets(user.role);
  const currentProfileImage = user.profileImage ?? "";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [assetsViewKey, setAssetsViewKey] = useState(0);
  const rel = (route: string) => route.slice(1);
  const navigateWithSearch = (route: string, search: string) => navigate({ pathname: plantPath(selectedPlant.id, route), search: search ? `?${search}` : "" });
  // Una vista que el rol no puede usar vuelve al inicio en vez de quedar en blanco.
  const only = (allowed: boolean, element: JSX.Element) => allowed ? element : <Navigate to={plantPath(selectedPlant.id, ROUTES.home)} replace />;
  const sidebarRoleLabel = user.role === "Técnico de Mantenimiento" ? "Técnico de Mantenimiento" : user.role;
  return (
    <SharedHeaderContext.Provider value={true}>
    <PlantContext.Provider value={selectedPlant}>
    <ActivityProvider key={`${user.username}:${selectedPlant.id}`} username={user.username} plantId={selectedPlant.id} token={user.token}>
    <main className={isSidebarCollapsed ? "home-shell-no-header sidebar-collapsed" : "home-shell-no-header"}>
      <aside className="sidebar-full">
        <button className="sidebar-collapse-button" onClick={() => setIsSidebarCollapsed((current) => !current)} type="button" aria-label={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}>
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <div className="sidebar-brand">
          <img className="sidebar-brand-logo" src={sidebarLogo} alt="AeroInspect" />
        </div>
        <nav className="nav-list" aria-label="Principal">
          <button className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isPlansPath && !isGeneratePlanPath && !isManualInspectionPath && !isDronePath && !isDronesAbmPath && !isLaunchPath && !isMonitorPath && !isReportsPath && !isCreateReportPath && !isReportDetailPath && !isReportDetailRealPath && !isRoleMgmtPath && !isHelpPath && !isActivityPath ? "active" : undefined} onClick={() => navigateTo(ROUTES.home)} aria-label="Inicio" title="Inicio" type="button">
            <HomeIcon size={20} />
            {!isSidebarCollapsed && <span>Inicio</span>}
          </button>

          {userCanConsultAssets && (
            <button className={isRegisterAssetPath || isAssetsPath ? "active" : undefined} onClick={() => { setAssetsViewKey(value => value + 1); navigateTo(ROUTES.assets); }} aria-label="Activos" title="Activos" type="button">
              <Package size={20} />
              {!isSidebarCollapsed && <span>Activos</span>}
            </button>
          )}

          {DRONE_OPERATION_ROLES.includes(user.role) && (
            <button className={isDronePath ? "active" : undefined} onClick={() => navigateTo(ROUTES.dronesTelemetry)} aria-label="Drones" title="Drones" type="button">
              <DroneGlyph />
              {!isSidebarCollapsed && <span>Drones</span>}
            </button>
          )}

          {user.role === "Jefe de Planta" && (
            <button className={isDronesAbmPath ? "active" : undefined} onClick={() => navigateTo(ROUTES.drones)} aria-label="Gestión de Drones" title="Gestión de Drones" type="button">
              <DroneGlyph />
              {!isSidebarCollapsed && <span>Gestión de Drones</span>}
            </button>
          )}

          {userCanConsultAssets && (
            <button className={isPlansPath || isGeneratePlanPath || isManualInspectionPath ? "active" : undefined} onClick={() => navigateTo(ROUTES.flightPlans)} aria-label="Planes" title="Planes" type="button">
              <RouteIcon size={20} />
              {!isSidebarCollapsed && <span>Planes</span>}
            </button>
          )}

          {(userCanConsultAssets || user.role === "Técnico de Mantenimiento") && (
            <button className={isMissionsPath || isMissionPath ? "active" : undefined} onClick={() => navigateTo(ROUTES.missions)} aria-label="Misiones" title="Misiones" type="button">
              <Plane size={20} />
              {!isSidebarCollapsed && <span>Misiones</span>}
            </button>
          )}

          <button className={isReportsPath || isCreateReportPath || isReportDetailPath || isReportDetailRealPath ? "active" : undefined} onClick={() => navigateTo(ROUTES.reports)} aria-label="Reportes" title="Reportes" type="button">
            <CheckCircle2 size={20} />
            {!isSidebarCollapsed && <span>Reportes</span>}
          </button>
          {user.role === "Jefe de Planta" && (
            <button className={isRoleMgmtPath ? "active" : undefined} onClick={() => navigateTo(ROUTES.staff)} aria-label="Gestión de personal" title="Gestión de personal" type="button">
              <UsersRound size={20} />
              {!isSidebarCollapsed && <span>Gestión de personal</span>}
            </button>
          )}
        </nav>
        <button className="sidebar-user" aria-label="Mi perfil" onClick={() => navigateTo(ROUTES.profile)} type="button">
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
        </button>
      </aside>

      <section key={selectedPlant.id} className={isRegisterAssetPath || isAssetsPath || isMissionPath || isMissionsPath || isPlansPath || isGeneratePlanPath || isManualInspectionPath || isReportsPath || isCreateReportPath || isReportDetailPath || isReportDetailRealPath || isRoleMgmtPath || isHelpPath || isActivityPath ? "workspace-no-header register-workspace" : "workspace-no-header"}>
        <header className="shared-app-header"><AppTopActions shared><div className="plant-switcher">
          <label htmlFor="selected-plant"><span className="sr-only">Cambiar planta</span>
            <select id="selected-plant" value={selectedPlant.id} onChange={(event) => {
              const next = PLANTS.find(plant => plant.id === event.target.value);
              if (!next) return;
              navigate(plantPath(next.id, ROUTES.home));
            }}>
              {PLANTS.map(plant => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </select>
          </label>
          {isMissionPath && <div id="mission-plan-slot" className="mission-plan-slot" />}
        </div></AppTopActions></header>
        {!isRegisterAssetPath && !isAssetsPath && !isMissionPath && !isMissionsPath && !isPlansPath && !isGeneratePlanPath && !isManualInspectionPath && !isHelpPath && !isActivityPath && user.role !== "Técnico de Mantenimiento" && user.role !== "Jefe de Planta" && (
          <header className="topbar">
            <div>
              <p className="eyebrow">Bienvenida, {user.name}</p>
              <h1 data-page-title="true">{getRoleHomeTitle(user.role)}</h1>
            </div>
            <button
              className="ghost-button"
              onClick={() => {
                onLogout();
              }}
              type="button"
            >
              <LogOut size={18} aria-hidden="true" />
              Salir
            </button>
          </header>
        )}

        <Routes>
          <Route path={rel(ROUTES.dronesTelemetryTest)} element={<PruebaTelemetriaView token={user.token} onBack={() => navigateTo(ROUTES.dronesTelemetry)} />} />
          <Route path={rel(ROUTES.profile)} element={<ProfileView user={user} setUser={setUser} onBack={() => navigateTo(ROUTES.home)} onAssignRoles={() => navigateTo(ROUTES.staff)} onViewActivity={() => navigateTo(ROUTES.profileActivity)} onLogout={onLogout} />} />
          <Route path={rel(ROUTES.assetsNew)} element={only(userCanConsultAssets,
            <MisActivosView initialCreate assets={assets} onBack={() => navigateTo(ROUTES.assets)} onDeleteAsset={id=>setAssets(current=>current.filter(a=>a.id!==id))} onRegisterAsset={()=>{}} onUpdateAsset={()=>{}} plant={selectedPlant} onViewAssetHistory={viewAssetHistory} />
          )} />
          <Route path={rel(ROUTES.staff)} element={only(user.role === "Jefe de Planta", <RoleManagementView user={user} onBack={() => navigateTo(ROUTES.profile)} />)} />
          <Route path={rel(ROUTES.drones)} element={only(user.role === "Jefe de Planta", <DronesAbmView />)} />
          <Route path={`${rel(ROUTES.missions)}/:missionId`} element={only(userCanConsultAssets, <MissionMonitorRoute token={user.token} onBack={() => navigateTo(ROUTES.missions)} />)} />
          <Route path={rel(ROUTES.missions)} element={
            <MisMisionesView
              user={user}
              onCreateMission={(idFlightPlans) => navigateWithSearch(ROUTES.missionsNew, idFlightPlans.map((id) => `planId=${id}`).join("&"))}
              onViewMission={(idMission) => navigateTo(ROUTES.mission(idMission))}
            />
          } />
          <Route path={rel(ROUTES.flightPlans)} element={only(userCanConsultAssets,
            <PlanesVueloView
              onGeneratePlan={PLAN_CREATION_ROLES.includes(user.role) ? () => navigateTo(ROUTES.flightPlansNew) : undefined}
              onCreateMission={(idFlightPlan) => navigateWithSearch(ROUTES.missionsNew, `planId=${idFlightPlan}`)}
            />
          )} />
          <Route path={rel(ROUTES.flightPlansNew)} element={only(userCanConsultAssets,
            <GenerarPlanVueloView
              initialRecordingId={selectedRecordingId}
              onBack={() => navigateTo(ROUTES.flightPlans)}
              onPlanConfirmed={(idFlightPlan) => navigateWithSearch(ROUTES.missionsNew, `planId=${idFlightPlan}`)}
              onStartManualInspection={() => navigateTo(ROUTES.manualInspection)}
            />
          )} />
          <Route path={rel(ROUTES.manualInspection)} element={only(DRONE_OPERATION_ROLES.includes(user.role),
            <InspeccionManualView
              onBack={() => navigateTo(ROUTES.home)}
              onGeneratePlan={(idFlightRecording) => navigateWithSearch(ROUTES.flightPlansNew, `recordingId=${idFlightRecording}`)}
            />
          )} />
          <Route path={rel(ROUTES.missionsNew)} element={only(userCanConsultAssets,
            <ConfigurarMisionView initialFlightPlanIds={selectedFlightPlanIds} onBack={() => navigateTo(ROUTES.missions)} onViewMissions={() => navigateTo(ROUTES.missions)} />
          )} />
          <Route path={rel(ROUTES.missionsLaunch)} element={only(DRONE_OPERATION_ROLES.includes(user.role),
            <LaunchMissionView
              missions={missions}
              assets={assets}
              droneConnected={droneConnected}
              battery={battery}
              setMissions={setMissions}
              onBack={() => navigateTo(ROUTES.home)}
              plant={selectedPlant}
            />
          )} />
          <Route path={rel(ROUTES.dronesTelemetry)} element={only(DRONE_OPERATION_ROLES.includes(user.role), <DroneTelemetryView />)} />
          {[rel(ROUTES.assets), `${rel(ROUTES.assets)}/:assetId`].map((path) => (
            <Route key={path} path={path} element={only(userCanConsultAssets,
              <MisActivosView key={assetsViewKey} assets={assets} onBack={() => navigateTo(ROUTES.home)} onDeleteAsset={(assetId) => setAssets((current) => current.filter((asset) => asset.id !== assetId))} onRegisterAsset={() => navigateTo(ROUTES.assetsNew)} onUpdateAsset={(nextAsset) => setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)))} selectedAssetId={selectedAssetId} plant={selectedPlant} onViewAssetHistory={viewAssetHistory} />
            )} />
          ))}
          <Route path={rel(ROUTES.reportsNew)} element={<CrearReporteView onBack={() => navigateTo(ROUTES.reports)} />} />
          <Route path={rel(ROUTES.reportsDemoDetail)} element={<ReporteDetalleView onBack={() => navigateTo(ROUTES.reports)} />} />
          <Route path={rel(ROUTES.reportsManualAnalysis)} element={
            <Suspense fallback={<LoadingState text="Cargando herramienta manual..." compact />}><ManualAnalysisView onBack={() => navigateTo(ROUTES.reports)} onViewReport={code => navigateTo(ROUTES.report(code))} /></Suspense>
          } />
          <Route path={`${rel(ROUTES.reports)}/:reportCode`} element={<ReportDetailRoute onBack={() => navigateTo(ROUTES.reports)} onViewAsset={viewAssetHistory} />} />
          <Route path={rel(ROUTES.help)} element={<CentroAyudaView />} />
          <Route path={rel(ROUTES.profileActivity)} element={<ActividadRecienteView />} />
          <Route path={rel(ROUTES.reports)} element={
            <div className="reports-route-shell"><TemporaryManualAnalysisShortcut onOpen={() => navigateTo(ROUTES.reportsManualAnalysis)} /><ReportesView initialAssetId={reportCaptureAssetId} onViewReport={(code) => navigateTo(ROUTES.report(code))} /></div>
          } />
          <Route path={rel(ROUTES.home)} element={
            user.role === "Jefe de Planta" || user.role === "Técnico de Mantenimiento" ? (
              <InspectionHomeView
                navigateTo={navigateTo}
                onViewAsset={(idAsset) => navigateTo(ROUTES.asset(idAsset))}
                onViewMission={(idMission) => navigateTo(ROUTES.mission(idMission))}
                plant={selectedPlant}
              />
            ) : (
          <Fragment>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">Bienvenido, {user.name}</p>
                <h1 data-page-title="true">Panel de Control</h1>
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
                    <button className="view-all-link" onClick={() => navigateTo(ROUTES.missions)}>
                      Ver todas <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                <div className="missions-list missions-table-wrap home-missions-table-wrap">
                  <table className="missions-table home-missions-table"><thead><tr><th>Activo</th><th>Estado</th></tr></thead><tbody>
                  {missions.slice(0, 3).map((mission) => (
                    <tr key={mission.id}><td><strong>{mission.assetName}</strong><small>{mission.name || "Misión de inspección"}</small></td><td><span className={`mission-status status-${mission.status?.toLowerCase().replace(" ", "-") || "pendiente"}`}>{mission.status || "Pendiente"}</span></td></tr>
                  ))}
                  {missions.length === 0 && (
                    <tr className="mission-empty-row"><td colSpan={2}>No hay misiones registradas</td></tr>
                  )}
                  </tbody></table>
                </div>
              </div>
              <div className="dashboard-card actions-card">
                <div className="card-header">
                  <h3>Acciones Rápidas</h3>
                </div>
                <div className="quick-actions">
                  {user.role === "Jefe de Planta" && (
                    <button className="action-button" onClick={() => navigateTo(ROUTES.assetsNew)}>
                      <Package size={20} />
                      <span>Registrar Activo</span>
                    </button>
                  )}
                  {userCanConsultAssets && (
                    <>
                      <button className="action-button" onClick={() => navigateTo(ROUTES.assets)}>
                        <Package size={20} />
                        <span>Ver Activos</span>
                      </button>
                      <button className="action-button" onClick={() => navigateTo(ROUTES.missions)}>
                        <MapPin size={20} />
                        <span>Ver Misiones</span>
                      </button>
                    </>
                  )}
                  {user.role === "Técnico de Mantenimiento" && (
                    <button className="action-button" onClick={() => navigateTo(ROUTES.missionsNew)}>
                      <MapPin size={20} />
                      <span>Configurar Misión</span>
                    </button>
                  )}
                  {DRONE_OPERATION_ROLES.includes(user.role) && (
                    <>
                      <button className="action-button" onClick={() => navigateTo(ROUTES.dronesTelemetry)}>
                        <Radio size={20} />
                        <span>Telemetría Dron</span>
                      </button>
                      <button className="action-button" onClick={() => navigateTo(ROUTES.missionsLaunch)}>
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
                    <strong>{selectedPlant.name}</strong>
                  </div>
                  <div className="plant-detail">
                    <span className="plant-label">Ubicación</span>
                    <strong>{selectedPlant.province}</strong>
                  </div>
                  <div className="plant-detail">
                    <span className="plant-label">Coordenadas</span>
                    <strong>{selectedPlant.center.latitude}, {selectedPlant.center.longitude}</strong>
                  </div>
                </div>
              </div>
            </div>
          </Fragment>
            )
          } />
          <Route path="*" element={<Navigate to={plantPath(selectedPlant.id, ROUTES.home)} replace />} />
        </Routes>
      </section>
    </main>
    </ActivityProvider>
    </PlantContext.Provider>
    </SharedHeaderContext.Provider>
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

const missionStatusClasses: Record<BackendMission["status"], string> = {
  PLANNED: "planned",
  UPLOADING: "medium",
  IN_PROGRESS: "in-progress",
  COMPLETED: "low",
  CANCELLED: "cancelled",
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
  const [pendingReviews, setPendingReviews] = useState<number | null>(null);
  const openMission=(id:string)=>onViewMission(id);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError("");

    getReports(plant).then(items=>{if(active)setPendingReviews(new Set(items.filter(r=>r.status==="PENDING_VALIDATION").map(r=>r.idMission)).size);}).catch(()=>{if(active)setPendingReviews(null);});
    Promise.all([getAssets(plant), getMissions(plant)])
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
  }, [plant]);

  const latestMissions = useMemo(
    () => [...missions].sort((left, right) => missionSortTime(right) - missionSortTime(left)).slice(0, 4),
    [missions]
  );

  const nextMission = [...missions].filter(m=>m.status==="IN_PROGRESS" || m.status==="PLANNED" || m.status==="UPLOADING")
    .sort((a,b)=>Number(b.status==="IN_PROGRESS")-Number(a.status==="IN_PROGRESS") || missionSortTime(a)-missionSortTime(b))[0];

  return (
    <div className="tech-dashboard inspection-home">
      <div className="inspection-home-header"><h1 data-page-title="true">Inicio</h1></div>
      <div className="home-attention" aria-label="Pendientes de la planta">
        <button type="button" onClick={()=>nextMission ? openMission(nextMission.idMission) : navigateTo(ROUTES.missions)}>
          <span>{nextMission?.status === "IN_PROGRESS" ? "En curso" : nextMission && missionSortTime(nextMission)<Date.now() ? "Misión pendiente" : "Próxima misión"}</span>
          <strong>{isLoading ? "Cargando…" : loadError ? "No disponible" : nextMission?.name ?? "Sin misiones programadas"}</strong>
          <small>{nextMission ? missionDisplayDate(nextMission) : "Ver misiones"} →</small>
        </button>
        <button type="button" onClick={()=>navigateTo(ROUTES.reports)}>
          <span>Inspecciones por revisar</span><strong>{pendingReviews === null ? "Consultar reportes" : pendingReviews === 0 ? "Sin revisiones pendientes" : `${pendingReviews} ${pendingReviews === 1 ? "pendiente" : "pendientes"}`}</strong>
          <small>Ver reportes →</small>
        </button>
      </div>
      <div className="inspection-home-layout">
        <section className="inspection-latest-card">
          <header>
            <h2>Últimas misiones</h2>
            <button type="button" onClick={() => navigateTo(ROUTES.missions)}>Ver todas</button>
          </header>
          <div className="inspection-latest-list">
            {isLoading ? (
              <LoadingState text="Cargando misiones..." compact />
            ) : loadError ? (
              <p className="inspection-home-feedback error">{loadError}</p>
            ) : latestMissions.length ? (
              latestMissions.map((mission) => (
              <button className="inspection-latest-row" key={mission.idMission} onClick={() => openMission(mission.idMission)} type="button">
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
              <div className="inspection-empty"><p>Todavía no hay misiones en esta planta.</p></div>
            )}
          </div>
        </section>

        <section className="inspection-map-card" aria-label={`Vista de ${plant.name}`}>
          <div className="inspection-map-shell">
            <AssetsOverviewMap assets={assets} onViewAsset={onViewAsset} plant={plant} />
          </div>
        </section>


      </div>
    </div>
  );
}

function MissionMonitorRoute({ token, onBack }: { token: string; onBack: () => void }) {
  const { missionId } = useParams();
  return <MonitorMissionView missionId={missionId ?? null} token={token} onBack={onBack} />;
}

function ReportDetailRoute({ onBack, onViewAsset }: { onBack: () => void; onViewAsset: (idAsset: number) => void }) {
  const { reportCode } = useParams();
  return <ReporteDetalleRealView reportCode={reportCode ?? null} onBack={onBack} onViewAsset={onViewAsset} />;
}
