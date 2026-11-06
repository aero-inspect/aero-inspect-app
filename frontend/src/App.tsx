import { useEffect, useState, type ComponentProps, type FormEvent } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { setApiAuthToken } from "./api/client";
import { setPlanBuilderAuthToken } from "./api/planBuilder";
import { mapBackendRole } from "./utils/auth";
import { loadStoredAssets, loadStoredMissions } from "./utils/assets";
import { REGISTERED_USERS } from "./data/mockUsers";
import { PLANTS } from "./data/plants";
import { LOGIN_PATH, defaultHomePath, redirectForUnknownPlant } from "./routes";
import type { Asset, InspectionMission, MockUser, SessionUser } from "./types";

type LoginErrorResponse = {
  message: string;
  fieldErrors: Record<string, string> | null;
};

const NO_AUTH_SESSION: SessionUser = {
  username: "no-auth",
  name: "Desarrollo no-auth",
  role: "Técnico de Mantenimiento",
  token: ""
};

const isNoAuthMode = import.meta.env.VITE_AUTH_MODE === "no-auth";

export function App() {
  const [user, setUser] = useState<SessionUser | null>(() =>
    isNoAuthMode ? NO_AUTH_SESSION : null
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>(loadStoredAssets);
  const [missions, setMissions] = useState<InspectionMission[]>(loadStoredMissions);
  const [users, setUsers] = useState<MockUser[]>(REGISTERED_USERS);
  const [droneConnected, setDroneConnected] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);

  useEffect(() => {
    if (!isNoAuthMode && location.pathname === LOGIN_PATH) {
      setUser(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    window.localStorage.setItem("aeroinspect.assets", JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    window.localStorage.setItem("aeroinspect.missions", JSON.stringify(missions));
  }, [missions]);

  const handleLogout = () => {
    setApiAuthToken("");
    setPlanBuilderAuthToken("");
    navigate(LOGIN_PATH);
    setUser(isNoAuthMode ? NO_AUTH_SESSION : null);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        setApiAuthToken(data.token);
        setPlanBuilderAuthToken(data.token);
        setUser({
          username: data.user.username,
          name: data.user.name,
          role: mapBackendRole(data.user.role),
          token: data.token,
          profileImage: data.user.profileImage ?? ""
        });
        // Con un link directo (p. ej. a una misión) se vuelve a esa URL; sólo desde /login se va al inicio.
        if (location.pathname === LOGIN_PATH) navigate(defaultHomePath(), { replace: true });
        return;
      }

      const errorBody: LoginErrorResponse = await response.json();
      setError(
        errorBody.fieldErrors
          ? Object.values(errorBody.fieldErrors).join(" ")
          : errorBody.message
      );
    } catch {
      setError("No se pudo conectar con el servidor. Intenta nuevamente.");
    }
  };

  if (!user) {
    return (
      <div className="app-scale-root">
        <Login
          username={username}
          password={password}
          error={error}
          showPassword={showPassword}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onToggleShowPassword={() => setShowPassword((current) => !current)}
          onSubmit={handleLogin}
        />
      </div>
    );
  }

  return (
    <div className="app-scale-root app-native-scale">
      <Routes>
        <Route
          path="/:plantId/*"
          element={
            <PlantRoute
              user={user}
              onLogout={handleLogout}
              assets={assets}
              missions={missions}
              users={users}
              droneConnected={droneConnected}
              battery={battery}
              setDroneConnected={setDroneConnected}
              setBattery={setBattery}
              setAssets={setAssets}
              setMissions={setMissions}
              setUsers={setUsers}
              setUser={setUser}
            />
          }
        />
        <Route path="*" element={<Navigate to={redirectForUnknownPlant(location.pathname)} replace />} />
      </Routes>
    </div>
  );
}

// Resuelve la planta de la URL (`/:plantId/...`). Si no existe, redirige: una URL vieja se traduce a la nueva.
function PlantRoute(props: Omit<ComponentProps<typeof Home>, "plant">) {
  const { plantId } = useParams();
  const location = useLocation();
  const plant = PLANTS.find((candidate) => candidate.id === plantId);
  if (!plant) return <Navigate to={redirectForUnknownPlant(location.pathname)} replace />;
  return <Home {...props} plant={plant} />;
}
