import React, { CSSProperties, ChangeEvent, FormEvent, useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  Check,
  CircleAlert,
  ChevronDown,
  Wifi,
  WifiOff,
  Battery,
  Edit3,
  UserPlus,
  UserMinus,
  Eye,
  Lock,
  LogOut,
  MapPin,
  Save,
  Trash2,
  Upload,
  X,
  UserRound,
  User
} from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import aeroInspectDrone from "./assets/aeroinspect-drone.png";

type SessionUser = {
  name: string;
  role: string;
};

type MockUser = SessionUser & {
  username: string;
  password: string;
  active: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
};

type LockState = {
  attempts: number;
  lockedUntil: number | null;
};

type AssetType = "Silo" | "Noria" | "Cinta transportadora" | "Tuberia" | "Techo";

type AssetImage = {
  id: number;
  name: string;
  preview: string;
};

type Asset = {
  id: number;
  name: string;
  type: AssetType;
  latitude: string;
  longitude: string;
  description: string;
  imageName?: string;
  imagePreview?: string;
  images?: AssetImage[];
  plantId: string;
};

type MapMarker = {
  id: string | number;
  latitude: string;
  longitude: string;
  label: string;
  type: AssetType;
};

type InspectionPoint = {
  id: number;
  latitude: string;
  longitude: string;
};

type InspectionMission = {
  id: number;
  name: string;
  assetId: number;
  assetName: string;
  routePoints: InspectionPoint[];
  status?: "Pendiente" | "En ejecución" | "Finalizada";
  startedAt?: string;
  finishedAt?: string;
};

type Plant = {
  id: string;
  name: string;
  province: string;
  center: {
    latitude: string;
    longitude: string;
  };
  bounds: Array<{
    latitude: string;
    longitude: string;
  }>;
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const ASSET_TYPES: AssetType[] = ["Silo", "Noria", "Cinta transportadora", "Tuberia", "Techo"];
const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  Silo: "#d94b4b",
  Noria: "#e7b416",
  "Cinta transportadora": "#8f5cc2",
  Tuberia: "#d8782c",
  Techo: "#5f6672"
};
const DRONE_OPERATION_ROLES = ["Tecnico de Mantenimiento"];
const ASSETS_STORAGE_KEY = "aeroinspect.assets";
const MISSIONS_STORAGE_KEY = "aeroinspect.missions";
const ASSET_CONSULT_ROLES = ["Jefe de Planta", "Tecnico de Mantenimiento"];
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const SATELLITE_LAYER = MAPTILER_KEY
  ? {
      attribution: "Imagery MapTiler",
      maxNativeZoom: 22,
      maxZoom: 22,
      tileSize: 512,
      url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
      zoomOffset: -1
    }
  : MAPBOX_TOKEN
  ? {
      attribution: "Imagery Mapbox",
      maxNativeZoom: 22,
      maxZoom: 22,
      tileSize: 512,
      url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${MAPBOX_TOKEN}`,
      zoomOffset: -1
    }
  : {
      attribution: "Tiles Esri",
      maxNativeZoom: 19,
      maxZoom: 19,
      tileSize: 256,
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      zoomOffset: 0
    };
function createAssetMarkerIcon(type: AssetType) {
  const color = ASSET_TYPE_COLORS[type];

  return L.divIcon({
    className: "leaflet-asset-marker",
    html: `<span style="background:${color}; border-color:${color}; box-shadow:0 5px 12px rgba(2,18,30,0.28);"></span>`,
    iconAnchor: [5, 5],
    iconSize: [10, 10]
  });
}
const selectedMarkerIcon = L.divIcon({
  className: "leaflet-asset-marker selected",
  html: "<span></span>",
  iconAnchor: [4, 4],
  iconSize: [8, 8]
});
const missionRoutePointIcon = L.divIcon({
  className: "leaflet-route-marker",
  html: "<span></span>",
  iconAnchor: [5, 5],
  iconSize: [10, 10]
});

const MOCK_PLANT: Plant = {
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

const REGISTERED_USERS: MockUser[] = [
  {
    username: "tecnico",
    password: "Tecnico#123",
    name: "Tecnico de Mantenimiento",
    role: "Tecnico de Mantenimiento",
    active: true
  },
  {
    username: "jefe",
    password: "Jefe#123",
    name: "Jefe de Planta",
    role: "Jefe de Planta",
    active: true
  },
  {
    username: "tecnico_inactivo",
    password: "Tecnico#999",
    name: "Tecnico Inactivo",
    role: "Tecnico de Mantenimiento",
    active: false
  }
];

function validateLoginFields(username: string, password: string) {
  const isUsernameMissing = !username.trim();
  const isPasswordMissing = !password.trim();

  if (isUsernameMissing && isPasswordMissing) {
    return "Ingrese su usuario y contrasena.";
  }

  if (isUsernameMissing) {
    return "Ingrese su usuario.";
  }

  if (isPasswordMissing) {
    return "Ingrese su contrasena.";
  }

  if (username.length > 50) {
    return "El nombre de usuario no puede superar los 50 caracteres.";
  }

  if (password.length > 100) {
    return "La contrasena no puede superar los 100 caracteres.";
  }

  return "";
}

function getMockLoginResult(username: string, password: string) {
  const registeredUser = REGISTERED_USERS.find((item) => item.username === username);

  if (!registeredUser?.active || registeredUser.password !== password) {
    return null;
  }

  return {
    name: registeredUser.name,
    role: registeredUser.role
  };
}

function getRoleHomeTitle(role: string) {
  if (role === "Jefe de Planta") {
    return "Vista Jefe de Planta";
  }

  return "Vista Tecnico de Mantenimiento";
}

function canConsultAssets(role: string) {
  return ASSET_CONSULT_ROLES.includes(role);
}

function loadStoredAssets() {
  try {
    const storedAssets = window.localStorage.getItem(ASSETS_STORAGE_KEY);

    if (!storedAssets) return [];

    return JSON.parse(storedAssets) as Asset[];
  } catch {
    return [];
  }
}

function loadStoredMissions() {
  try {
    const storedMissions = window.localStorage.getItem(MISSIONS_STORAGE_KEY);

    if (!storedMissions) return [];

    return JSON.parse(storedMissions) as InspectionMission[];
  } catch {
    return [];
  }
}

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lockByUser, setLockByUser] = useState<Record<string, LockState>>({});
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  const handleFailedLogin = (normalizedUsername: string, currentLock: LockState | undefined) => {
    const failedAttempts = (currentLock?.attempts || 0) + 1;
    const shouldLock = failedAttempts >= MAX_LOGIN_ATTEMPTS;

    setLockByUser((current) => ({
      ...current,
      [normalizedUsername]: {
        attempts: shouldLock ? 0 : failedAttempts,
        lockedUntil: shouldLock ? Date.now() + LOCK_TIME_MS : null
      }
    }));

    setError(
      shouldLock
        ? "Usuario o contrasena incorrectos. La cuenta quedo bloqueada por 15 minutos."
        : "Usuario o contrasena incorrectos"
    );
  };

  const handleSuccessfulLogin = (normalizedUsername: string, sessionUser: SessionUser) => {
    setUser(sessionUser);
    setLockByUser((current) => ({
      ...current,
      [normalizedUsername]: { attempts: 0, lockedUntil: null }
    }));
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const fieldError = validateLoginFields(username, password);

    if (fieldError) {
      setError(fieldError);
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    const currentLock = lockByUser[normalizedUsername];
    const now = Date.now();

    if (currentLock?.lockedUntil && currentLock.lockedUntil > now) {
      const minutesLeft = Math.ceil((currentLock.lockedUntil - now) / 60000);
      setError(`La cuenta esta bloqueada temporalmente. Intenta nuevamente en ${minutesLeft} minutos.`);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        handleSuccessfulLogin(normalizedUsername, data.user);
        return;
      }
    } catch {
      // If the API is not running yet, the local mock keeps the visual flow testable.
    }

    const mockUser = getMockLoginResult(normalizedUsername, password);

    if (mockUser) {
      handleSuccessfulLogin(normalizedUsername, mockUser);
      return;
    }

    handleFailedLogin(normalizedUsername, currentLock);
  };

  if (user) {
    return <Home currentPath={currentPath} navigateTo={navigateTo} user={user} onLogout={() => setUser(null)} />;
  }

  return (
    <main className="login-shell">
      <section className="login-visual" aria-label="AeroInspect">
        <div className="brand-lockup">
          <img className="hero-drone" src={aeroInspectDrone} alt="" aria-hidden="true" />
          <p className="hero-brand">
            <span>Aero</span>
            <strong>Inspect</strong>
          </p>
          <h1>Sistema de Monitoreo con Drones para Infraestructura Externa Agroindustrial</h1>
        </div>
      </section>

      <section className="login-panel" aria-label="Inicio de sesion">
        <div className="login-heading">
          <h2>Iniciar sesion</h2>
          <span aria-hidden="true" />
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <label>
            <span>Usuario</span>
            <div className="input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input
                autoComplete="username"
                maxLength={50}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="usuario@empresa.com"
                type="text"
                value={username}
              />
            </div>
          </label>

          <label>
            <span>Contrasena</span>
            <div className="input-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                autoComplete="current-password"
                maxLength={100}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contrasena"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                className="icon-button"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <Eye size={18} aria-hidden="true" />
              </button>
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary-button" type="submit">
            Entrar
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}

function Home({
  currentPath,
  navigateTo,
  user,
  onLogout
}: {
  currentPath: string;
  navigateTo: (path: string) => void;
  user: SessionUser;
  onLogout: () => void;
}) {
  const isRegisterAssetPath = currentPath === "/registro-activo";
  const isAssetsPath = currentPath === "/mis-activos";
  const isMissionPath = currentPath === "/configurar-mision";
  const isMissionsPath = currentPath === "/mis-misiones";
  const isDronePath = currentPath === "/dron";
  const isLaunchPath = currentPath === "/ejecutar-despegue";
  const isProfilePath = currentPath === "/perfil";
  const isRoleMgmtPath = currentPath === "/gestion-roles";
  const [assets, setAssets] = useState<Asset[]>(loadStoredAssets);
  const [missions, setMissions] = useState<InspectionMission[]>(loadStoredMissions);
  const [users, setUsers] = useState<MockUser[]>(REGISTERED_USERS);
  const [droneConnected, setDroneConnected] = useState<boolean>(false);
  const [battery, setBattery] = useState<number | null>(null);
  const userCanConsultAssets = canConsultAssets(user.role);

  useEffect(() => {
    window.localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    window.localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions));
  }, [missions]);

  const createAsset = (asset: Omit<Asset, "id" | "plantId">) => {
    setAssets((current) => [
      ...current,
      {
        ...asset,
        id: Date.now(),
        plantId: MOCK_PLANT.id
      }
    ]);
  };

  const updateAsset = (nextAsset: Asset) => {
    setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)));
  };

  const createMission = (mission: Omit<InspectionMission, "id">) => {
    setMissions((current) => [
      ...current,
      {
        ...mission,
        id: Date.now(),
        status: "Pendiente"
      }
    ]);
  };

  return (
    <main className="home-shell">
      <header className="app-header">
        <div className="app-brand">
          <img className="app-brand-drone" src={aeroInspectDrone} alt="" aria-hidden="true" />
          <span className="app-brand-text">
            <span>Aero</span>
            <strong>Inspect</strong>
          </span>
        </div>

        <div className="header-actions">
          <button className="notification-button" aria-label="Notificaciones" type="button">
            <Bell size={18} aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <button className="user-menu" type="button" onClick={() => navigateTo("/perfil")}>
            <span className="user-avatar">{getUserInitials(user.name)}</span>
            <span>{user.name}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav className="nav-list" aria-label="Principal">
          <button
            className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath ? "active" : undefined}
            onClick={() => navigateTo("/")}
            type="button"
          >
            Inicio
          </button>
          {user.role === "Jefe de Planta" && (
            <button
              className={isRegisterAssetPath ? "active" : undefined}
              onClick={() => navigateTo("/registro-activo")}
              type="button"
            >
              Registrar Activo
            </button>
          )}
          {userCanConsultAssets && (
            <>
              <button className={isAssetsPath ? "active" : undefined} onClick={() => navigateTo("/mis-activos")} type="button">
                Mis activos
              </button>
              <button className={isMissionsPath ? "active" : undefined} onClick={() => navigateTo("/mis-misiones")} type="button">
                Mis misiones
              </button>
            </>
          )}
          {DRONE_OPERATION_ROLES.includes(user.role) && (
            <>
              <button className={isDronePath ? "active" : undefined} onClick={() => navigateTo("/dron")} type="button">
                Dron
              </button>
              <button className={isLaunchPath ? "active" : undefined} onClick={() => navigateTo("/ejecutar-despegue")} type="button">
                Ejecutar despegue
              </button>
            </>
          )}
          
          {user.role === "Tecnico de Mantenimiento" && (
            <button className={isMissionPath ? "active" : undefined} onClick={() => navigateTo("/configurar-mision")} type="button">
              Configurar misión
            </button>
          )}
        </nav>
      </aside>

      <section className={isRegisterAssetPath || isAssetsPath || isMissionPath || isMissionsPath ? "workspace register-workspace" : "workspace"}>
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
        ) : isRoleMgmtPath && user.role === "Jefe de Planta" ? (
          <RoleManagementView users={users} setUsers={setUsers} onBack={() => navigateTo("/")} />
        ) : isMissionsPath ? (
          <MisMisionesView
            missions={missions}
            assets={assets}
            onBack={() => navigateTo("/")}
            plant={MOCK_PLANT}
          />
        ) : isMissionPath && user.role === "Tecnico de Mantenimiento" ? (
          <ConfigurarMisionView
            assets={assets}
            missions={missions}
            onBack={() => navigateTo("/")}
            onCreateMission={createMission}
            plant={MOCK_PLANT}
          />
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
          <DroneTelemetryView
            onBack={() => navigateTo("/")}
            droneConnected={droneConnected}
            setDroneConnected={setDroneConnected}
            battery={battery}
            setBattery={setBattery}
          />
        ) : isAssetsPath && userCanConsultAssets ? (
          <MisActivosView assets={assets} onBack={() => navigateTo("/")} onUpdateAsset={updateAsset} plant={MOCK_PLANT} />
        ) : user.role === "Jefe de Planta" ? (
          isRegisterAssetPath ? (
            <RegistrarActivoView
              assets={assets}
              onBack={() => navigateTo("/")}
              onCreateAsset={createAsset}
              onGoHome={() => navigateTo("/")}
              onViewAssets={() => navigateTo("/mis-activos")}
              plant={MOCK_PLANT}
            />
          ) : (
            <JefePlantaView assets={assets} onRegisterAsset={() => navigateTo("/registro-activo")} plant={MOCK_PLANT} />
          )
        ) : (
          <section className="content-band">
            <div>
              <p className="eyebrow">Bienvenido</p>
              <h2>Sistema AeroInspect</h2>
              <p>Seleccione una opción en la barra lateral para comenzar.</p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function getUserInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TecnicoMantenimientoView({ onCreateMission }: { onCreateMission: () => void }) {
  return (
    <section className="content-band">
      <div>
        <p className="eyebrow">Vista por rol</p>
        <h2>Tecnico de Mantenimiento</h2>
        <p>Planifica misiones de inspeccion sobre activos registrados.</p>
      </div>
      <button className="secondary-button" onClick={onCreateMission} type="button">
        Configurar misión
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </section>
  );
}

function JefePlantaView({
  assets,
  onRegisterAsset,
  plant
}: {
  assets: Asset[];
  onRegisterAsset: () => void;
  plant: Plant;
}) {
  return (
    <section className="plant-view">
      <div className="plant-summary">
        <div>
          <p className="eyebrow">Mapa de planta</p>
          <h2>{plant.name}</h2>
          <p>{plant.province}</p>
        </div>
        <button className="secondary-button" onClick={onRegisterAsset} type="button">
          Registrar Activo
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="plant-map-shell">
        <LeafletSatelliteMap
          markers={assets
            .filter((asset) => asset.plantId === plant.id)
            .map((asset) => ({
              id: asset.id,
              latitude: asset.latitude,
              longitude: asset.longitude,
              label: asset.name,
              type: asset.type
            }))}
          plant={plant}
        />
        <div className="plant-map-info">
          <span>Centro: {plant.center.latitude}, {plant.center.longitude}</span>
          <span>Activos registrados: {assets.filter((asset) => asset.plantId === plant.id).length}</span>
        </div>
      </div>
    </section>
  );
}

function ConfigurarMisionView({
  assets,
  missions,
  onBack,
  onCreateMission,
  plant
}: {
  assets: Asset[];
  missions: InspectionMission[];
  onBack: () => void;
  onCreateMission: (mission: Omit<InspectionMission, "id">) => void;
  plant: Plant;
}) {
  const plantAssets = assets.filter((asset) => asset.plantId === plant.id);
  const [missionName, setMissionName] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(plantAssets[0]?.id ?? null);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [routePoints, setRoutePoints] = useState<InspectionPoint[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "asset" | "route", string>>>({});
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const selectedAsset = plantAssets.find((asset) => asset.id === selectedAssetId) ?? null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setIsSuccessOpen(false);

    if (plantAssets.length === 0) {
      setFieldErrors({ asset: "No hay activos disponibles para configurar una mision." });
      return;
    }

    const nextFieldErrors: Partial<Record<"name" | "asset" | "route", string>> = {};

    if (!missionName.trim()) nextFieldErrors.name = "Ingrese nombre de la mision.";
    if (!selectedAsset) nextFieldErrors.asset = "Seleccione un activo a inspeccionar.";
    if (routePoints.length === 0) nextFieldErrors.route = "Defina al menos un punto de inspeccion.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (missionName.length > 100) {
      setFieldErrors({ name: "El nombre de la mision no puede superar los 100 caracteres." });
      return;
    }

    const missionExists = missions.some(
      (mission) => mission.assetId === selectedAsset?.id && mission.name.trim().toLowerCase() === missionName.trim().toLowerCase()
    );

    if (missionExists) {
      setFieldErrors({ name: "Ya existe una mision con ese nombre para el activo seleccionado." });
      return;
    }

    onCreateMission({
      name: missionName.trim(),
      assetId: selectedAsset!.id,
      assetName: selectedAsset!.name,
      routePoints
    });

    setMissionName("");
    setSelectedAssetId(plantAssets[0]?.id ?? null);
    setRoutePoints([]);
    setIsSuccessOpen(true);
  };

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Configurar misión</p>
          <p>Crear una planificacion de vuelo asociada a un activo registrado para su posterior ejecucion.</p>
        </div>
      </header>

      <form className="asset-form" onSubmit={handleSubmit}>
        <section className="form-panel">
          {plantAssets.length === 0 && <p className="empty-assets">No hay activos registrados. Primero debe darse de alta un activo.</p>}

          <div className="field-grid">
            <label>
              <span className="field-label">
                <span>Nombre de la misión <small>*</small></span>
              </span>
              <input
                aria-invalid={Boolean(fieldErrors.name)}
                className={fieldErrors.name ? "field-invalid" : undefined}
                disabled={plantAssets.length === 0}
                maxLength={100}
                onChange={(event) => setMissionName(event.target.value)}
                placeholder="Ej: Inspeccion Silo Sur"
                type="text"
                value={missionName}
              />
              {fieldErrors.name && <FieldError message={fieldErrors.name} />}
            </label>

            <label>
              <span className="field-label">
                <span>Activo a inspeccionar <small>*</small></span>
              </span>
              <div className="asset-select">
                <button
                  aria-expanded={isAssetOpen}
                  aria-haspopup="listbox"
                  className={fieldErrors.asset ? "asset-select-trigger field-invalid" : "asset-select-trigger"}
                  disabled={plantAssets.length === 0}
                  onClick={() => setIsAssetOpen((current) => !current)}
                  type="button"
                >
                  <span className={selectedAsset ? undefined : "select-placeholder"}>{selectedAsset?.name || "Seleccionar activo"}</span>
                  <ChevronDown size={17} aria-hidden="true" />
                </button>

                {isAssetOpen && plantAssets.length > 0 && (
                  <div className="asset-select-menu" role="listbox">
                    {plantAssets.map((asset) => (
                      <button
                        className={selectedAssetId === asset.id ? "selected" : undefined}
                        key={asset.id}
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          setIsAssetOpen(false);
                          setRoutePoints([]);
                        }}
                        role="option"
                        type="button"
                      >
                        {asset.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldErrors.asset && <FieldError message={fieldErrors.asset} />}
            </label>
          </div>
        </section>

        <section className="map-placeholder">
          <div>
            <div>
              <p className="map-field-label">Recorrido de inspección</p>
            </div>
          </div>
          <p className="map-help">Selecciona uno o mas puntos sobre el mapa para definir el recorrido de la mision.</p>

          <div className="mission-layout">
            <MissionRouteMap
              asset={selectedAsset}
              disabled={plantAssets.length === 0}
              onAddPoint={(point) => {
                setRoutePoints((current) => [...current, { ...point, id: Date.now() + current.length }]);
                setFieldErrors((current) => ({ ...current, route: undefined }));
              }}
              plant={plant}
              routePoints={routePoints}
            />

            <div className="mission-route-panel">
              <div>
                <p className="map-field-label">Puntos definidos</p>
                <p>{routePoints.length} puntos de inspeccion</p>
              </div>

              {routePoints.length === 0 ? (
                <p className="mission-empty">No hay puntos definidos.</p>
              ) : (
                <div className="mission-point-list">
                  {routePoints.map((point, index) => (
                    <div className="mission-point-row" key={point.id}>
                      <span>{index + 1}</span>
                      <p>{point.latitude}, {point.longitude}</p>
                      <button
                        aria-label="Quitar punto"
                        onClick={() => setRoutePoints((current) => current.filter((item) => item.id !== point.id))}
                        type="button"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {routePoints.length > 0 && (
                <button className="modal-link-button" onClick={() => setRoutePoints([])} type="button">
                  Limpiar recorrido
                </button>
              )}
            </div>
          </div>
          {fieldErrors.route && <FieldError message={fieldErrors.route} />}
        </section>

        <div className="form-actions">
          <button className="register-button" disabled={plantAssets.length === 0} type="submit">
            <Save size={18} aria-hidden="true" />
            Registrar misión
          </button>
        </div>
      </form>

      {isSuccessOpen && (
        <MissionSuccessModal
          onClose={() => setIsSuccessOpen(false)}
          onGoHome={() => {
            setIsSuccessOpen(false);
            navigateTo("/");
          }}
          onViewMissions={() => {
            setIsSuccessOpen(false);
            navigateTo("/mis-misiones");
          }}
        />
      )}
    </section>
  );
}

function RegistrarActivoView({
  assets,
  onBack,
  onCreateAsset,
  onGoHome,
  onViewAssets,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onCreateAsset: (asset: Omit<Asset, "id" | "plantId">) => void;
  onGoHome: () => void;
  onViewAssets: () => void;
  plant: Plant;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType | "">("");
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const [assetImages, setAssetImages] = useState<AssetImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showRegisteredAssets, setShowRegisteredAssets] = useState(false);
  const [registeredAssetTypeFilters, setRegisteredAssetTypeFilters] = useState<AssetType[]>(ASSET_TYPES);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "type" | "location" | "description", string>>>({});
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setIsSuccessOpen(false);

    const nextFieldErrors: Partial<Record<"name" | "type" | "location" | "description", string>> = {};

    if (!name.trim()) nextFieldErrors.name = "Ingrese nombre del activo.";
    if (!type) nextFieldErrors.type = "Seleccione tipo de activo.";
    if (!latitude.trim() || !longitude.trim()) nextFieldErrors.location = "Ingrese ubicacion geografica.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (name.length > 100) {
      setFieldErrors({ name: "El nombre del activo no puede superar los 100 caracteres." });
      return;
    }

    if (description.length > 500) {
      setFieldErrors({ description: "La descripcion no puede superar los 500 caracteres." });
      return;
    }

    const assetExists = assets.some(
      (asset) => asset.plantId === plant.id && asset.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

    if (assetExists) {
      setFieldErrors({ name: "Ya existe un activo con ese nombre dentro de la misma planta." });
      return;
    }

    onCreateAsset({
      name: name.trim(),
      type: type as AssetType,
      latitude: latitude.trim(),
      longitude: longitude.trim(),
      description: description.trim(),
      images: assetImages
    });

    setName("");
    setType("");
    setLatitude("");
    setLongitude("");
    setDescription("");
    setAssetImages([]);
    setSelectedImageIndex(null);
    setIsSuccessOpen(true);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    Promise.all(
      files.map(
        (file, index) =>
          new Promise<AssetImage>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: Date.now() + index,
                name: file.name,
                preview: String(reader.result ?? "")
              });
            reader.readAsDataURL(file);
          })
      )
    ).then((nextImages) => setAssetImages((current) => [...current, ...nextImages]));

    event.target.value = "";
  };

  const selectedImage = selectedImageIndex !== null ? assetImages[selectedImageIndex] : null;

  const deleteSelectedImage = () => {
    if (selectedImageIndex === null) return;

    setAssetImages((current) => current.filter((_, index) => index !== selectedImageIndex));
    setSelectedImageIndex(null);
  };

  const registeredAssetMarkers = assets
    .filter((asset) => asset.plantId === plant.id)
    .filter((asset) => registeredAssetTypeFilters.includes(asset.type))
    .map((asset) => ({
      id: asset.id,
      latitude: asset.latitude,
      longitude: asset.longitude,
      label: asset.name,
      type: asset.type
    }));
  const registeredAssetFilterOptions = ASSET_TYPES;

  const toggleRegisteredAssetType = (assetType: AssetType) => {
    setRegisteredAssetTypeFilters((current) =>
      current.includes(assetType) ? current.filter((typeItem) => typeItem !== assetType) : [...current, assetType]
    );
  };

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Alta de activo</p>
          <p>Crear una nueva estructura en {plant.name} para ubicarla en el mapa y asociarla a futuras inspecciones.</p>
        </div>
      </header>

      <form className="asset-form" onSubmit={handleSubmit}>
        <section className="form-panel">
          <div className="field-grid">
            <label>
              <span className="field-label">
                <span>Nombre del activo <small>*</small></span>
              </span>
              <input
                aria-invalid={Boolean(fieldErrors.name)}
                className={fieldErrors.name ? "field-invalid" : undefined}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Silo Sur"
                type="text"
                value={name}
              />
              {fieldErrors.name && <FieldError message={fieldErrors.name} />}
            </label>

            <label>
              <span className="field-label">
                <span>Tipo de activo <small>*</small></span>
              </span>
              <div className="asset-select">
                <button
                  aria-expanded={isTypeOpen}
                  aria-haspopup="listbox"
                  className={fieldErrors.type ? "asset-select-trigger field-invalid" : "asset-select-trigger"}
                  onClick={() => setIsTypeOpen((current) => !current)}
                  type="button"
                >
                  <span className={type ? undefined : "select-placeholder"}>{type || "Seleccionar tipo"}</span>
                  <ChevronDown size={17} aria-hidden="true" />
                </button>

                {isTypeOpen && (
                  <div className="asset-select-menu" role="listbox">
                    {ASSET_TYPES.map((assetType) => (
                      <button
                        className={type === assetType ? "selected" : undefined}
                        key={assetType}
                        onClick={() => {
                          setType(assetType);
                          setIsTypeOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        {assetType}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldErrors.type && <FieldError message={fieldErrors.type} />}
            </label>
          </div>

          <div className="asset-media-grid">
            <label>
              <span className="field-label">
                <span>Descripcion</span>
              </span>
              <textarea
                aria-invalid={Boolean(fieldErrors.description)}
                className={fieldErrors.description ? "field-invalid" : undefined}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Detalle opcional del activo, referencia visual o condicion inicial."
                value={description}
              />
              {fieldErrors.description && <FieldError message={fieldErrors.description} />}
            </label>

            <div className="asset-image-field">
              <span className="field-label">
                <span>Imagenes del activo</span>
              </span>
              <input accept="image/*" className="asset-upload-input" id="asset-images" multiple onChange={handleImageChange} type="file" />
              <label className="asset-upload-button" htmlFor="asset-images">
                <Upload size={17} aria-hidden="true" />
                Subir imagen
              </label>

              {assetImages.length > 0 && (
                <div className="asset-thumbnails">
                  {assetImages.map((image, index) => (
                    <button key={image.id} onClick={() => setSelectedImageIndex(index)} type="button">
                      <img alt={image.name} src={image.preview} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="map-placeholder">
          <div>
            <div>
              <p className="map-field-label">Ubicacion geografica</p>
            </div>
          </div>
          <p className="map-help">Selecciona el punto exacto dentro de la planta. Las coordenadas se completan automaticamente.</p>

          <div className="location-layout">
            <LeafletSatelliteMap
              markers={showRegisteredAssets ? registeredAssetMarkers : []}
              onSelect={(location) => {
                setLatitude(location.latitude);
                setLongitude(location.longitude);
                setFieldErrors((current) => ({ ...current, location: undefined }));
              }}
              plant={plant}
              selectedLocation={latitude && longitude ? { latitude, longitude } : undefined}
            />

            <div className="location-fields">
              <label>
                <span className="field-label">
                  <span>Latitud <small>*</small></span>
                </span>
                <input
                  aria-invalid={Boolean(fieldErrors.location)}
                  className={fieldErrors.location ? "field-invalid" : undefined}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="-35.140664"
                  type="text"
                  value={latitude}
                />
              </label>
              <label>
                <span className="field-label">
                  <span>Longitud <small>*</small></span>
                </span>
                <input
                  aria-invalid={Boolean(fieldErrors.location)}
                  className={fieldErrors.location ? "field-invalid" : undefined}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="-60.458214"
                  type="text"
                  value={longitude}
                />
              </label>
              <div className="map-filter-panel">
                <button className="map-toggle-button" onClick={() => setShowRegisteredAssets((current) => !current)} type="button">
                  {showRegisteredAssets ? "Ocultar activos registrados" : "Ver activos registrados"}
                </button>
                {showRegisteredAssets && (
                  <div className="map-type-options" aria-label="Filtrar activos registrados por tipo">
                    {registeredAssetFilterOptions.map((assetType) => (
                      <button
                        className={registeredAssetTypeFilters.includes(assetType) ? "selected" : undefined}
                        key={assetType}
                        onClick={() => toggleRegisteredAssetType(assetType)}
                        style={{ "--asset-type-color": ASSET_TYPE_COLORS[assetType] } as CSSProperties}
                        type="button"
                      >
                        <span aria-hidden="true" />
                        {assetType}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {fieldErrors.location && <FieldError message={fieldErrors.location} />}
        </section>

        {error && <p className="form-error asset-message">{error}</p>}
        <div className="form-actions">
          <button className="register-button" type="submit">
            <Save size={18} aria-hidden="true" />
            Registrar
          </button>
        </div>
      </form>

      {isSuccessOpen && (
        <SuccessModal
          message="Ya esta disponible para futuras inspecciones y misiones."
          onGoHome={onGoHome}
          onViewAssets={onViewAssets}
        />
      )}

      {selectedImage && (
        <div className="image-modal-backdrop" role="presentation">
          <section aria-modal="true" className="image-modal" role="dialog">
            <div className="image-modal-actions">
              <button aria-label="Cerrar vista previa" onClick={() => setSelectedImageIndex(null)} type="button">
                <X size={18} aria-hidden="true" />
              </button>
              <button aria-label="Eliminar imagen" onClick={deleteSelectedImage} type="button">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <img alt={selectedImage.name} src={selectedImage.preview} />
          </section>
        </div>
      )}
    </section>
  );
}

function MisActivosView({
  assets,
  onBack,
  onUpdateAsset,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onUpdateAsset: (asset: Asset) => void;
  plant: Plant;
}) {
  const [typeFilter, setTypeFilter] = useState<AssetType | "Todos">("Todos");
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const plantAssets = assets.filter((asset) => asset.plantId === plant.id);
  const filteredAssets = typeFilter === "Todos" ? plantAssets : plantAssets.filter((asset) => asset.type === typeFilter);
  const markers = filteredAssets.map((asset) => ({
    id: asset.id,
    latitude: asset.latitude,
    longitude: asset.longitude,
    label: asset.name,
    type: asset.type
  }));

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Mis activos</p>
          <p>Cada marcador indica una estructura disponible para futuras inspecciones.</p>
        </div>
      </header>

      <section className="assets-consult">
        <div className="assets-map-panel">
          <div className="assets-map-heading">
            <div>
              <p className="map-field-label">Mapa de planta</p>
              <p>{filteredAssets.length} activos visibles</p>
            </div>
          </div>
          <LeafletSatelliteMap markers={markers} plant={plant} />
        </div>

        <div className="assets-table-panel">
          <div className="assets-table-toolbar">
            <div>
              <p className="map-field-label">Activos registrados</p>
              <p>Cantidad: {plantAssets.length}</p>
            </div>
            <label className="filter-field">
              <select onChange={(event) => setTypeFilter(event.target.value as AssetType | "Todos")} value={typeFilter}>
                <option value="Todos">Todos</option>
                {ASSET_TYPES.map((assetType) => (
                  <option key={assetType} value={assetType}>
                    {assetType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {plantAssets.length === 0 ? (
            <p className="empty-assets">No hay activos disponibles.</p>
          ) : filteredAssets.length === 0 ? (
            <p className="empty-assets">No hay activos disponibles para el tipo seleccionado.</p>
          ) : (
            <div className="assets-table-wrap">
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Ubicacion</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td>{asset.name}</td>
                      <td>
                        <span className="asset-type-cell">
                          <span style={{ "--asset-type-color": ASSET_TYPE_COLORS[asset.type] } as CSSProperties} />
                          {asset.type}
                        </span>
                      </td>
                      <td>
                        <span className="asset-location">
                          {asset.latitude}, {asset.longitude}
                        </span>
                      </td>
                      <td>
                        <button className="table-detail-button" onClick={() => setDetailAsset(asset)} type="button">
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {detailAsset && (
        <AssetDetailModal
          asset={detailAsset}
          onClose={() => setDetailAsset(null)}
          onUpdateAsset={(nextAsset) => {
            setDetailAsset(nextAsset);
            onUpdateAsset(nextAsset);
          }}
        />
      )}
    </section>
  );
}

function AssetDetailModal({
  asset,
  onClose,
  onUpdateAsset
}: {
  asset: Asset;
  onClose: () => void;
  onUpdateAsset: (asset: Asset) => void;
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const assetImages = asset.images ?? [];
  const selectedImage = selectedImageIndex !== null ? assetImages[selectedImageIndex] : null;

  const deleteSelectedImage = () => {
    if (selectedImageIndex === null) return;

    onUpdateAsset({
      ...asset,
      images: assetImages.filter((_, index) => index !== selectedImageIndex)
    });
    setSelectedImageIndex(null);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="asset-detail-modal" role="dialog">
        <div className="asset-detail-header">
          <div>
            <h2>{asset.name}</h2>
          </div>
          <button aria-label="Cerrar detalle" className="modal-link-button" onClick={onClose} type="button">
            <X size={17} aria-hidden="true" />
            Cerrar
          </button>
        </div>

        <div className="asset-detail-section">
          <h3>Descripcion</h3>
          <p>{asset.description || "Sin descripcion cargada."}</p>
        </div>

        <div className="asset-detail-section">
          <h3>Imagenes asociadas</h3>
          {assetImages.length > 0 ? (
            <div className="asset-detail-images">
              {assetImages.map((image, index) => (
                <button key={image.id} onClick={() => setSelectedImageIndex(index)} type="button">
                  <img alt={image.name} src={image.preview} />
                </button>
              ))}
            </div>
          ) : (
            <p>Sin imagenes cargadas.</p>
          )}
        </div>
      </section>

      {selectedImage && (
        <div className="image-modal-backdrop" role="presentation">
          <section aria-modal="true" className="image-modal" role="dialog">
            <div className="image-modal-actions">
              <button aria-label="Cerrar vista previa" onClick={() => setSelectedImageIndex(null)} type="button">
                <X size={18} aria-hidden="true" />
              </button>
              <button aria-label="Eliminar imagen" onClick={deleteSelectedImage} type="button">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <img alt={selectedImage.name} src={selectedImage.preview} />
          </section>
        </div>
      )}
    </div>
  );
}

function MisMisionesView({
  missions,
  assets,
  onBack,
  plant
}: {
  missions: InspectionMission[];
  assets: Asset[];
  onBack: () => void;
  plant: Plant;
}) {
  const [detailMission, setDetailMission] = useState<InspectionMission | null>(null);
  const plantAssetIds = assets.filter((a) => a.plantId === plant.id).map((a) => a.id);
  const plantMissions = missions.filter((m) => plantAssetIds.includes(m.assetId));

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Mis misiones</p>
          <p>Listado de misiones de inspección registradas para esta planta.</p>
        </div>
      </header>

      <section className="assets-consult">
        <div className="assets-table-panel">
          <div className="assets-table-toolbar">
            <div>
              <p className="map-field-label">Misiones registradas</p>
              <p>Cantidad: {plantMissions.length}</p>
            </div>
          </div>

          {plantMissions.length === 0 ? (
            <p className="empty-assets">No hay misiones registradas.</p>
          ) : (
            <div className="assets-table-wrap">
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Activo</th>
                    <th>Puntos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plantMissions.map((mission) => (
                    <tr key={mission.id}>
                      <td>{mission.name}</td>
                      <td>{mission.assetName}</td>
                      <td>{mission.routePoints.length}</td>
                      <td>
                        <button className="table-detail-button" onClick={() => setDetailMission(mission)} type="button">
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {detailMission && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-detail-modal" role="dialog">
            <div className="asset-detail-header">
              <div>
                <h2>{detailMission.name}</h2>
                <p>Activo: {detailMission.assetName}</p>
                <p>Puntos definidos: {detailMission.routePoints.length}</p>
              </div>
              <button aria-label="Cerrar detalle" className="modal-link-button" onClick={() => setDetailMission(null)} type="button">
                <X size={17} aria-hidden="true" />
                Cerrar
              </button>
            </div>

            <div className="asset-detail-section">
              <MissionRouteMap
                asset={assets.find((a) => a.id === detailMission.assetId) ?? null}
                disabled={true}
                onAddPoint={() => {}}
                plant={plant}
                routePoints={detailMission.routePoints}
              />
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function DroneTelemetryView({
  onBack,
  droneConnected,
  setDroneConnected,
  battery,
  setBattery
}: {
  onBack: () => void;
  droneConnected: boolean;
  setDroneConnected: (v: boolean) => void;
  battery: number | null;
  setBattery: (v: number | null) => void;
}) {
  const [showAlert, setShowAlert] = useState<string | null>(null);

  // Simulate telemetry updates when connected
  useEffect(() => {
    let interval: number | undefined;

    if (droneConnected) {
      setShowAlert(null);
      if (battery === null) setBattery(100);
      interval = window.setInterval(() => {
        setBattery((b) => {
          if (b === null) return 100;
          const next = Math.max(0, b - 1);
          if (next === 0) {
            // simulate connection loss when battery drains
            setDroneConnected(false);
            setShowAlert("El dron ha perdido la conexion (bateria 0%).");
            return 0;
          }
          return next;
        });
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [droneConnected]);

  useEffect(() => {
    if (!droneConnected) {
      // while disconnected telemetry shouldn't update
      setShowAlert((s) => s ?? "Dron desconectado. Telemetria no disponible.");
    }
  }, [droneConnected]);

  const generalStatus = !droneConnected ? "No disponible para operar" : battery !== null && battery >= 30 ? "Listo para operar" : "No disponible para operar";

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Telemetría del dron</p>
          <p>Visualiza el estado del dron antes del despegue.</p>
        </div>
      </header>

      <section className="drone-telemetry">
        <div className="telemetry-card">
          <div className="telemetry-row">
            <strong>Estado de conexión:</strong>
            <span className={droneConnected ? "status-connected" : "status-disconnected"}>
              {droneConnected ? (
                <>
                  <Wifi size={16} aria-hidden="true" /> Conectado
                </>
              ) : (
                <>
                  <WifiOff size={16} aria-hidden="true" /> Desconectado
                </>
              )}
            </span>
          </div>

          <div className="telemetry-row">
            <strong>Nivel de batería:</strong>
            <span>{battery === null ? "—" : `${battery}%`}</span>
          </div>

          <div className="telemetry-row">
            <strong>Estado general:</strong>
            <span>{generalStatus}</span>
          </div>

          {showAlert && (
            <div className="telemetry-alert">
              <CircleAlert size={16} aria-hidden="true" /> {showAlert}
            </div>
          )}

          <div className="telemetry-actions">
            <button className="modal-link-button" onClick={() => setDroneConnected((c) => !c)} type="button">
              {droneConnected ? "Simular desconexion" : "Simular conexion"}
            </button>
            <button
              className="register-button"
              onClick={() => {
                setBattery(100);
                setShowAlert(null);
              }}
              type="button"
            >
              Reset bateria
            </button>
          </div>
        </div>

        {!droneConnected && (
          <p className="empty-assets">No hay dispositivos disponibles para monitoreo.</p>
        )}
      </section>
    </section>
  );
}

function LaunchMissionView({
  missions,
  assets,
  droneConnected,
  battery,
  setMissions,
  onBack,
  plant
}: {
  missions: InspectionMission[];
  assets: Asset[];
  droneConnected: boolean;
  battery: number | null;
  setMissions: React.Dispatch<React.SetStateAction<InspectionMission[]>>;
  onBack: () => void;
  plant: Plant;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  const plantAssetIds = assets.filter((a) => a.plantId === plant.id).map((a) => a.id);
  const plantMissions = missions.filter((m) => plantAssetIds.includes(m.assetId));

  const selectedMission = plantMissions.find((m) => m.id === selectedMissionId) ?? null;

  const MIN_BATTERY = 30;

  const handleStart = () => {
    setError(null);

    if (!selectedMission) {
      setError("No hay ninguna misión seleccionada.");
      return;
    }

    if (!droneConnected) {
      setError("El dron no está conectado. Imposible iniciar la misión.");
      return;
    }

    if (battery === null || battery < MIN_BATTERY) {
      setError("Batería insuficiente para iniciar la misión.");
      return;
    }

    // start mission
    setRunning(true);
    const startTime = new Date().toISOString();
    setMissions((current) => current.map((m) => (m.id === selectedMission.id ? { ...m, status: "En ejecución", startedAt: startTime } : m)));

    // simulate mission duration then finish
    setTimeout(() => {
      const endTime = new Date().toISOString();
      setMissions((current) => current.map((m) => (m.id === selectedMission.id ? { ...m, status: "Finalizada", finishedAt: endTime } : m)));
      setRunning(false);
    }, 5000);
  };

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Ejecutar despegue</p>
          <p>Seleccione una misión y ejecute el despegue si el dron está disponible.</p>
        </div>
      </header>

      <section className="launch-mission">
        <div className="assets-table-panel">
          <div className="assets-table-toolbar">
            <div>
              <p className="map-field-label">Misión a ejecutar</p>
              <p>Cantidad: {plantMissions.length}</p>
            </div>
          </div>

          {plantMissions.length === 0 ? (
            <p className="empty-assets">No hay misiones configuradas.</p>
          ) : (
            <div className="assets-table-wrap">
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Activo</th>
                    <th>Estado</th>
                    <th>Seleccionar</th>
                  </tr>
                </thead>
                <tbody>
                  {plantMissions.map((mission) => (
                    <tr key={mission.id} className={selectedMissionId === mission.id ? "selected-row" : undefined}>
                      <td>{mission.name}</td>
                      <td>{mission.assetName}</td>
                      <td>{mission.status ?? "Pendiente"}</td>
                      <td>
                        <button className="table-detail-button" onClick={() => setSelectedMissionId(mission.id)} type="button">
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mission-preview">
          {selectedMission ? (
            <>
              <h3>Preview: {selectedMission.name}</h3>
              <MissionRouteMap
                asset={assets.find((a) => a.id === selectedMission.assetId) ?? null}
                disabled={true}
                onAddPoint={() => {}}
                plant={plant}
                routePoints={selectedMission.routePoints}
              />

              {error && <p className="form-error">{error}</p>}

              <div className="form-actions">
                <button className="register-button" disabled={running} onClick={handleStart} type="button">
                  {running ? "En ejecución..." : "Iniciar despegue"}
                </button>
              </div>
            </>
          ) : (
            <p className="empty-assets">Selecciona una misión para ver su recorrido.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function ProfileView({ user, users, setUsers, onBack, onAssignRoles, onLogout }: { user: SessionUser; users: MockUser[]; setUsers: React.Dispatch<React.SetStateAction<MockUser[]>>; onBack: () => void; onAssignRoles: () => void; onLogout: () => void }) {
  const userEntry = users.find((u) => u.name === user.name) ?? null;
  const firstName = userEntry?.firstName ?? user.name.split(" ")[0] ?? user.name;
  const lastName = userEntry?.lastName ?? user.name.split(" ").slice(1).join(" ") ?? "";
  const phone = userEntry?.phone ?? "";
  const email = userEntry?.email ?? (userEntry ? `${userEntry.username}@example.com` : "");
  const company = userEntry?.company ?? "Mi Empresa";
  const location = userEntry?.location ?? "Ubicación";
  const jefe = users.find((u) => u.role === "Jefe de Planta")?.name ?? "-";
  const [showChange, setShowChange] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
      </header>

      <section className="profile-view">
      <div className="profile-card">

        <div className="profile-header">
          <div className="profile-avatar">
            <User size={50} />
          </div>

          <h2>{firstName} {lastName}</h2>

          <span className="profile-role">
            {user.role}
          </span>
        </div>

        <div className="profile-section">
          <h3>Información personal</h3>

          <div className="profile-field">
            <label>Nombre</label>
            <span>{firstName}</span>
          </div>

          <div className="profile-field">
            <label>Apellido</label>
            <span>{lastName}</span>
          </div>

          <div className="profile-field">
            <label>Teléfono</label>
            <span>{phone || "—"}</span>
          </div>

          <div className="profile-field">
            <label>Email</label>
            <span>{email}</span>
          </div>

          <div className="profile-field">
            <label>Empresa</label>
            <span>{company}</span>
          </div>

          <div className="profile-field">
            <label>Ubicación</label>
            <span>{location}</span>
          </div>

          {user.role === "Tecnico de Mantenimiento" && (
            <div className="profile-field">
              <label>Jefe de Planta</label>
              <span>{jefe}</span>
            </div>
          )}
        </div>

        <div className="profile-actions">
          <button
            className="secondary-button"
            onClick={() => setShowChange((s) => !s)}
            type="button"
          >
            Cambiar contraseña
          </button>

          {user.role === "Jefe de Planta" && (
            <button
              className="secondary-button"
              onClick={onAssignRoles}
              type="button"
            >
              Asignar roles
            </button>
          )}

          <button
            className="logout-button"
            onClick={onLogout}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>

          {showChange && (
            <div className="change-password">
              <label>Contraseña actual<input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} /></label>
              <label>Nueva contraseña<input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></label>
              <label>Confirmar contraseña<input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} /></label>
              {pwdMessage && <p className="form-error">{pwdMessage}</p>}
              <div>
                <button className="register-button" onClick={() => {
                  setPwdMessage(null);
                  if (!userEntry) { setPwdMessage("Cuenta local no encontrada."); return; }
                  if (userEntry.password !== currentPwd) { setPwdMessage("Contraseña actual incorrecta."); return; }
                  if (!newPwd || newPwd !== confirmPwd) { setPwdMessage("Las contraseñas no coinciden."); return; }
                  // update user password
                  setUsers((u) => u.map(x => x.username === userEntry.username ? { ...x, password: newPwd } : x));
                  setPwdMessage("Contraseña actualizada.");
                  setShowChange(false);
                  setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
                }} type="button">Guardar</button>
                <button className="modal-link-button" onClick={() => setShowChange(false)} type="button">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {user.role === "Jefe de Planta" && (
          <div className="profile-list">
            <h3>Técnicos de Mantenimiento a cargo</h3>
            <ul>
              {users.filter((u) => u.role === "Tecnico de Mantenimiento").map((t) => (
                <li key={t.username}>{t.name} — {t.active ? "Activo" : "Inactivo"}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </section>
  );
}

function RoleManagementView({ users, setUsers, onBack }: { users: MockUser[]; setUsers: React.Dispatch<React.SetStateAction<MockUser[]>>; onBack: () => void }) {
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "Tecnico de Mantenimiento", active: true });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.name) return;
    setUsers((current) => [...current, { username: form.username, password: form.password, name: form.name, role: form.role as any, active: form.active }]);
    setForm({ username: "", password: "", name: "", role: "Tecnico de Mantenimiento", active: true });
  };

  const handleDelete = (username: string) => {
    setUsers((current) => current.filter((u) => u.username !== username));
  };

  const handleRoleChange = (username: string, role: string) => {
    setUsers((current) => current.map((u) => (u.username === username ? { ...u, role } : u)));
  };

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Gestión de usuarios</p>
          <p>Crear, editar y asignar roles a cuentas del sistema.</p>
        </div>
      </header>

      <section className="role-management">
        <div className="create-user">
          <h3>Crear cuenta</h3>
          <label>Usuario<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Clave<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label>Rol<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>Tecnico de Mantenimiento</option><option>Jefe de Planta</option></select></label>
          <label>Activo<input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /></label>
          <div><button className="register-button" onClick={handleCreate} type="button">Crear cuenta</button></div>
        </div>

        <div className="users-table">
          <h3>Usuarios registrados</h3>
          <table className="assets-table">
            <thead>
              <tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.name}</td>
                  <td>
                    <select value={u.role} onChange={(e) => handleRoleChange(u.username, e.target.value)}>
                      <option>Jefe de Planta</option>
                      <option>Tecnico de Mantenimiento</option>
                    </select>
                  </td>
                  <td>{u.active ? "Sí" : "No"}</td>
                  <td>
                    <button className="modal-link-button" onClick={() => handleDelete(u.username)} type="button"><UserMinus size={16} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function SuccessModal({
  message,
  onGoHome,
  onViewAssets
}: {
  message: string;
  onGoHome: () => void;
  onViewAssets: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <Check size={24} aria-hidden="true" />
        </div>
        <h2>Activo registrado</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="modal-link-button" onClick={onGoHome} type="button">
            <ArrowLeft size={18} aria-hidden="true" />
            Volver a Home
          </button>
          <button className="register-button" onClick={onViewAssets} type="button">
            Ver mis activos
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}

function MissionSuccessModal({ onClose, onGoHome, onViewMissions }: { onClose: () => void; onGoHome: () => void; onViewMissions: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <Check size={24} aria-hidden="true" />
        </div>
        <h2>Misión registrada</h2>
        <p>Ya esta disponible para su posterior ejecucion.</p>
        <div className="modal-actions">
          <button className="modal-link-button" onClick={onGoHome} type="button">
            <ArrowLeft size={18} aria-hidden="true" />
            Volver a Home
          </button>
          <button className="register-button" onClick={onViewMissions} type="button">
            Ver misiones
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}

function MissionRouteMap({
  asset,
  disabled,
  onAddPoint,
  plant,
  routePoints
}: {
  asset: Asset | null;
  disabled: boolean;
  onAddPoint: (point: { latitude: string; longitude: string }) => void;
  plant: Plant;
  routePoints: InspectionPoint[];
}) {
  const center: [number, number] = asset
    ? [Number(asset.latitude), Number(asset.longitude)]
    : [Number(plant.center.latitude), Number(plant.center.longitude)];
  const routePositions: Array<[number, number]> = routePoints.map((point) => [Number(point.latitude), Number(point.longitude)]);

  return (
    <div className="leaflet-map-shell">
      <MapContainer center={center} className="leaflet-map" maxZoom={SATELLITE_LAYER.maxZoom} minZoom={16} scrollWheelZoom zoom={18} zoomControl>
        <TileLayer
          attribution={SATELLITE_LAYER.attribution}
          maxNativeZoom={SATELLITE_LAYER.maxNativeZoom}
          maxZoom={SATELLITE_LAYER.maxZoom}
          tileSize={SATELLITE_LAYER.tileSize}
          url={SATELLITE_LAYER.url}
          zoomOffset={SATELLITE_LAYER.zoomOffset}
        />

        {asset && (
          <Marker
            bubblingMouseEvents={false}
            icon={createAssetMarkerIcon(asset.type)}
            position={[Number(asset.latitude), Number(asset.longitude)]}
            title={asset.name}
          />
        )}

        {routePositions.length > 1 && <Polyline color="#111827" positions={routePositions} weight={2} />}

        {routePoints.map((point) => (
          <Marker
            bubblingMouseEvents={false}
            icon={missionRoutePointIcon}
            key={point.id}
            position={[Number(point.latitude), Number(point.longitude)]}
            title="Punto de inspeccion"
          />
        ))}

        {!disabled && <MapClickHandler onSelect={onAddPoint} />}
      </MapContainer>
    </div>
  );
}

function LeafletSatelliteMap({
  markers,
  onSelect,
  plant,
  selectedLocation
}: {
  markers: MapMarker[];
  onSelect?: (location: { latitude: string; longitude: string }) => void;
  plant: Plant;
  selectedLocation?: { latitude: string; longitude: string };
}) {
  const center: [number, number] = [Number(plant.center.latitude), Number(plant.center.longitude)];

  return (
    <div className="leaflet-map-shell">
      <MapContainer center={center} className="leaflet-map" maxZoom={SATELLITE_LAYER.maxZoom} minZoom={16} scrollWheelZoom zoom={18} zoomControl>
        <TileLayer
          attribution={SATELLITE_LAYER.attribution}
          maxNativeZoom={SATELLITE_LAYER.maxNativeZoom}
          maxZoom={SATELLITE_LAYER.maxZoom}
          tileSize={SATELLITE_LAYER.tileSize}
          url={SATELLITE_LAYER.url}
          zoomOffset={SATELLITE_LAYER.zoomOffset}
        />
        {markers.map((marker) => (
          <Marker
            bubblingMouseEvents={false}
            icon={createAssetMarkerIcon(marker.type)}
            key={marker.id}
            position={[Number(marker.latitude), Number(marker.longitude)]}
            title={marker.label}
          />
        ))}

        {selectedLocation && (
          <Marker
            bubblingMouseEvents={false}
            icon={selectedMarkerIcon}
            position={[Number(selectedLocation.latitude), Number(selectedLocation.longitude)]}
            title="Punto seleccionado"
          />
        )}

        {onSelect && <MapClickHandler onSelect={onSelect} />}
      </MapContainer>
    </div>
  );
}

function MapClickHandler({ onSelect }: { onSelect: (location: { latitude: string; longitude: string }) => void }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat.toFixed(6),
        longitude: event.latlng.lng.toFixed(6)
      });
    }
  });

  return null;
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="field-error">
      <CircleAlert size={14} aria-hidden="true" />
      {message}
    </p>
  );
}
