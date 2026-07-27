import { useEffect, useState, type FormEvent } from "react";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { mapBackendRole } from "./utils/auth";
import { loadStoredAssets, loadStoredMissions } from "./utils/assets";
import { REGISTERED_USERS } from "./data/mockUsers";
import type { Asset, InspectionMission, MockUser, SessionUser } from "./types";

type LoginErrorResponse = {
  message: string;
  fieldErrors: Record<string, string> | null;
};

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [assets, setAssets] = useState<Asset[]>(loadStoredAssets);
  const [missions, setMissions] = useState<InspectionMission[]>(loadStoredMissions);
  const [users, setUsers] = useState<MockUser[]>(REGISTERED_USERS);
  const [droneConnected, setDroneConnected] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("aeroinspect.assets", JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    window.localStorage.setItem("aeroinspect.missions", JSON.stringify(missions));
  }, [missions]);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
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
        setUser({
          name: data.user.name,
          role: mapBackendRole(data.user.role),
          token: data.token
        });
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
    <div className="app-scale-root">
      <Home
        currentPath={currentPath}
        navigateTo={navigateTo}
        user={user}
        onLogout={() => setUser(null)}
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
      />
    </div>
  );
}
