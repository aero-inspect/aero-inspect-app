import { loadSelectedPlant } from "./data/plants";

// Rutas relativas a la planta. La URL completa es `/:plantId` + la ruta (ver `plantPath`).
export const ROUTES = {
  home: "/home",
  assets: "/assets",
  assetsNew: "/assets/new",
  asset: (idAsset: number | string) => `/assets/${idAsset}`,
  missions: "/missions",
  missionsNew: "/missions/new",
  missionsLaunch: "/missions/launch",
  mission: (idMission: string) => `/missions/${encodeURIComponent(idMission)}`,
  flightPlans: "/flight-plans",
  flightPlansNew: "/flight-plans/new",
  manualInspection: "/manual-inspection",
  drones: "/drones",
  dronesTelemetry: "/drones/telemetry",
  dronesTelemetryTest: "/drones/telemetry/test",
  staff: "/staff",
  reports: "/reports",
  reportsNew: "/reports/new",
  reportsDemoDetail: "/reports/demo-detail",
  reportsManualAnalysis: "/reports/manual-analysis",
  report: (code: string) => `/reports/${encodeURIComponent(code)}`,
  profile: "/profile",
  profileActivity: "/profile/activity",
  help: "/help"
} as const;

// Segmentos que no son un parámetro: /assets/new no es el activo "new", etc.
export const RESERVED_SEGMENTS = {
  assets: ["new"],
  missions: ["new", "launch"],
  reports: ["new", "demo-detail", "manual-analysis"]
} as const;

export const LOGIN_PATH = "/login";

export function plantPath(plantId: string, route: string) {
  return `/${plantId}${route}`;
}

export function defaultHomePath() {
  return plantPath(loadSelectedPlant().id, ROUTES.home);
}

// URLs de antes de tener la planta en la ruta y los nombres en inglés.
const LEGACY_ROUTES: Record<string, string> = {
  "/mis-activos": ROUTES.assets,
  "/registro-activo": ROUTES.assetsNew,
  "/mis-misiones": ROUTES.missions,
  "/configurar-mision": ROUTES.missionsNew,
  "/monitorear-mision": ROUTES.missions,
  "/ejecutar-despegue": ROUTES.missionsLaunch,
  "/generar-plan": ROUTES.flightPlansNew,
  "/inspeccion-manual": ROUTES.manualInspection,
  "/dron": ROUTES.dronesTelemetry,
  "/prueba-telemetria": ROUTES.dronesTelemetryTest,
  "/gestion-drones": ROUTES.drones,
  "/gestion-roles": ROUTES.staff,
  "/reportes": ROUTES.reports,
  "/crear-reporte": ROUTES.reportsNew,
  "/reporte-detalle": ROUTES.reportsDemoDetail,
  "/reporte-detalle-real": ROUTES.reports,
  "/analisis-manual": ROUTES.reportsManualAnalysis,
  "/perfil": ROUTES.profile,
  "/actividad-reciente": ROUTES.profileActivity,
  "/centro-ayuda": ROUTES.help
};

// A dónde mandar una URL cuyo primer segmento no es una planta: una URL vieja se traduce,
// cualquier otra cosa (incluida la raíz) va al inicio de la última planta usada.
export function redirectForUnknownPlant(pathname: string) {
  const first = "/" + (pathname.split("/").filter(Boolean)[0] ?? "");
  const legacy = LEGACY_ROUTES[first];
  return legacy ? plantPath(loadSelectedPlant().id, legacy) : defaultHomePath();
}
