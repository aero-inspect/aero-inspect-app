import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  CircleAlert,
  ChevronDown,
  Eye,
  Lock,
  LogOut,
  MapPin,
  Save,
  UserRound
} from "lucide-react";
import aeroInspectDrone from "./assets/aeroinspect-drone.png";

type SessionUser = {
  name: string;
  role: string;
};

type MockUser = SessionUser & {
  username: string;
  password: string;
  active: boolean;
};

type LockState = {
  attempts: number;
  lockedUntil: number | null;
};

type AssetType = "Silo" | "Noria" | "Cinta transportadora" | "Tuberia" | "Techo";

type Asset = {
  id: number;
  name: string;
  type: AssetType;
  latitude: string;
  longitude: string;
  description: string;
  plantId: string;
};

type MapMarker = {
  id: string | number;
  latitude: string;
  longitude: string;
  label: string;
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
  const [assets, setAssets] = useState<Asset[]>([
    {
      id: 1,
      name: "Silo Norte",
      type: "Silo",
      latitude: "-35.140664",
      longitude: "-60.458214",
      description: "Activo inicial de referencia.",
      plantId: MOCK_PLANT.id
    }
  ]);

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
          <button className="user-menu" type="button">
            <span className="user-avatar">{getUserInitials(user.name)}</span>
            <span>{user.name}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav className="nav-list" aria-label="Principal">
          <button className={!isRegisterAssetPath ? "active" : undefined} onClick={() => navigateTo("/")} type="button">
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
        </nav>
      </aside>

      <section className={isRegisterAssetPath ? "workspace register-workspace" : "workspace"}>
        {!isRegisterAssetPath && (
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

        {user.role === "Jefe de Planta" ? (
          isRegisterAssetPath ? (
            <RegistrarActivoView assets={assets} onBack={() => navigateTo("/")} onCreateAsset={createAsset} plant={MOCK_PLANT} />
          ) : (
            <JefePlantaView assets={assets} onRegisterAsset={() => navigateTo("/registro-activo")} plant={MOCK_PLANT} />
          )
        ) : (
          <TecnicoMantenimientoView />
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

function TecnicoMantenimientoView() {
  return (
    <section className="content-band">
      <div>
        <p className="eyebrow">Vista por rol</p>
        <h2>Tecnico de Mantenimiento</h2>
        <p>Placeholder de la vista tecnica. La armamos cuando definamos el flujo.</p>
      </div>
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
        <StaticSatelliteMap
          markers={assets
            .filter((asset) => asset.plantId === plant.id)
            .map((asset) => ({
              id: asset.id,
              latitude: asset.latitude,
              longitude: asset.longitude,
              label: asset.name
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

function RegistrarActivoView({
  assets,
  onBack,
  onCreateAsset,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onCreateAsset: (asset: Omit<Asset, "id" | "plantId">) => void;
  plant: Plant;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType | "">("");
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "type" | "location" | "description", string>>>({});
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setSuccessMessage("");

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
      type,
      latitude: latitude.trim(),
      longitude: longitude.trim(),
      description: description.trim()
    });

    setName("");
    setType("");
    setLatitude("");
    setLongitude("");
    setDescription("");
    setSuccessMessage("Activo registrado correctamente. Quedo disponible para futuras inspecciones y misiones.");
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
        </section>

        <section className="map-placeholder">
          <div>
            <MapPin size={22} aria-hidden="true" />
            <div>
              <p className="eyebrow">Ubicacion geografica <span className="required-inline">*</span></p>
              <h2>Punto sobre el mapa</h2>
            </div>
          </div>
          <p>Selecciona el punto exacto dentro de la planta. Las coordenadas se completan automaticamente.</p>

          <StaticSatelliteMap
            markers={assets
              .filter((asset) => asset.plantId === plant.id)
              .map((asset) => ({
                id: asset.id,
                latitude: asset.latitude,
                longitude: asset.longitude,
                label: asset.name
              }))}
            onSelect={(location) => {
              setLatitude(location.latitude);
              setLongitude(location.longitude);
              setFieldErrors((current) => ({ ...current, location: undefined }));
            }}
            plant={plant}
            selectedLocation={latitude && longitude ? { latitude, longitude } : undefined}
          />

          <div className="field-grid compact">
            <label>
              <span className="field-label">
                <span>Latitud <small>*</small></span>
              </span>
              <input
                aria-invalid={Boolean(fieldErrors.location)}
                className={fieldErrors.location ? "field-invalid" : undefined}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="-34.3372"
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
                placeholder="-57.2575"
                type="text"
                value={longitude}
              />
            </label>
          </div>
          {fieldErrors.location && <FieldError message={fieldErrors.location} />}
        </section>

        {error && <p className="form-error asset-message">{error}</p>}
        {successMessage && <p className="success-message asset-message">{successMessage}</p>}

        <div className="form-actions">
          <button className="secondary-button" type="submit">
            <Save size={18} aria-hidden="true" />
            Confirmar registro
          </button>
        </div>
      </form>
    </section>
  );
}

function StaticSatelliteMap({
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
  const bounds = getPlantBounds(plant);
  const imageUrl = getStaticMapUrl(bounds);
  const boundaryPoints = plant.bounds.map((point) => `${getLongitudePercent(point.longitude, bounds)}%,${getLatitudePercent(point.latitude, bounds)}%`).join(" ");
  const getMarkerStyle = (latitude: string, longitude: string) => ({
    left: `${getLongitudePercent(longitude, bounds)}%`,
    top: `${getLatitudePercent(latitude, bounds)}%`
  });

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelect) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xPercent = (event.clientX - rect.left) / rect.width;
    const yPercent = (event.clientY - rect.top) / rect.height;
    const longitude = bounds.west + (bounds.east - bounds.west) * xPercent;
    const latitude = bounds.north - (bounds.north - bounds.south) * yPercent;

    onSelect({
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6)
    });
  };

  return (
    <div className={onSelect ? "static-map interactive" : "static-map"} onClick={handleMapClick}>
      <img alt="Mapa satelital de la planta" draggable={false} src={imageUrl} />

      <svg className="plant-zone" aria-hidden="true">
        <polygon points={boundaryPoints} />
      </svg>

      {markers.map((marker) => (
        <span className="asset-marker" key={marker.id} style={getMarkerStyle(marker.latitude, marker.longitude)} title={marker.label}>
          <MapPin size={18} aria-hidden="true" />
        </span>
      ))}

      {selectedLocation && (
        <span className="asset-marker selected" style={getMarkerStyle(selectedLocation.latitude, selectedLocation.longitude)} title="Punto seleccionado">
          <MapPin size={18} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function getPlantBounds(plant: Plant) {
  const latitudes = plant.bounds.map((point) => Number(point.latitude));
  const longitudes = plant.bounds.map((point) => Number(point.longitude));

  return {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    west: Math.min(...longitudes)
  };
}

function getStaticMapUrl(bounds: { north: number; south: number; east: number; west: number }) {
  const padding = 0.00055;
  const bbox = [bounds.west - padding, bounds.south - padding, bounds.east + padding, bounds.north + padding].join(",");

  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=512,512&format=jpg&f=image`;
}

function getLatitudePercent(latitude: string, bounds: { north: number; south: number }) {
  return ((bounds.north - Number(latitude)) / (bounds.north - bounds.south)) * 100;
}

function getLongitudePercent(longitude: string, bounds: { east: number; west: number }) {
  return ((Number(longitude) - bounds.west) / (bounds.east - bounds.west)) * 100;
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="field-error">
      <CircleAlert size={14} aria-hidden="true" />
      {message}
    </p>
  );
}
