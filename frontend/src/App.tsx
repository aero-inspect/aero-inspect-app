import { CSSProperties, ChangeEvent, FormEvent, useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  Check,
  CircleAlert,
  ChevronDown,
  Eye,
  Lock,
  LogOut,
  MapPin,
  Save,
  Trash2,
  Upload,
  X,
  UserRound
} from "lucide-react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
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
const ASSETS_STORAGE_KEY = "aeroinspect.assets";
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
  const [assets, setAssets] = useState<Asset[]>(loadStoredAssets);
  const userCanConsultAssets = canConsultAssets(user.role);

  useEffect(() => {
    window.localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
  }, [assets]);

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
          <button className={!isRegisterAssetPath && !isAssetsPath ? "active" : undefined} onClick={() => navigateTo("/")} type="button">
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
            <button className={isAssetsPath ? "active" : undefined} onClick={() => navigateTo("/mis-activos")} type="button">
              Mis activos
            </button>
          )}
        </nav>
      </aside>

      <section className={isRegisterAssetPath || isAssetsPath ? "workspace register-workspace" : "workspace"}>
        {!isRegisterAssetPath && !isAssetsPath && (
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

        {isAssetsPath && userCanConsultAssets ? (
          <MisActivosView assets={assets} onBack={() => navigateTo("/")} plant={MOCK_PLANT} />
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

function MisActivosView({ assets, onBack, plant }: { assets: Asset[]; onBack: () => void; plant: Plant }) {
  const [typeFilter, setTypeFilter] = useState<AssetType | "Todos">("Todos");
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
