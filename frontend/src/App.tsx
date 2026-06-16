import { useEffect, useState, type FormEvent } from "react";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { validateLoginFields, getMockLoginResult } from "./utils/auth";
import { loadStoredAssets, loadStoredMissions } from "./utils/assets";
import { REGISTERED_USERS } from "./data/mockUsers";
import type { Asset, InspectionMission, LockState, MockUser, SessionUser } from "./types";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lockByUser, setLockByUser] = useState<Record<string, LockState>>({});
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
    }

    const mockUser = getMockLoginResult(normalizedUsername, password);
    if (mockUser) {
      handleSuccessfulLogin(normalizedUsername, mockUser);
      return;
    }

    handleFailedLogin(normalizedUsername, currentLock);
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


