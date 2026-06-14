import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 4000;
const maxLoginAttempts = 5;
const lockTimeMs = 15 * 60 * 1000;

const registeredUsers = [
  {
    username: "tecnico",
    password: "Tecnico#123",
    name: "María Emilia Andersen",
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

const loginLocks = new Map();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "aero-inspect-api" });
});

function validateLoginFields(username = "", password = "") {
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

function registerFailedAttempt(username) {
  const currentLock = loginLocks.get(username);
  const failedAttempts = (currentLock?.attempts || 0) + 1;

  if (failedAttempts >= maxLoginAttempts) {
    loginLocks.set(username, {
      attempts: 0,
      lockedUntil: Date.now() + lockTimeMs
    });

    return true;
  }

  loginLocks.set(username, {
    attempts: failedAttempts,
    lockedUntil: null
  });

  return false;
}

app.post("/api/auth/login", (req, res) => {
  const { username = "", password = "" } = req.body;
  const fieldError = validateLoginFields(username, password);

  if (fieldError) {
    return res.status(400).json({ message: fieldError });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const lock = loginLocks.get(normalizedUsername);
  const now = Date.now();

  if (lock?.lockedUntil && lock.lockedUntil > now) {
    const minutesLeft = Math.ceil((lock.lockedUntil - now) / 60000);
    return res.status(423).json({
      message: `La cuenta esta bloqueada temporalmente. Intenta nuevamente en ${minutesLeft} minutos.`
    });
  }

  const user = registeredUsers.find((item) => item.username === normalizedUsername);
  const canLogin = user?.active && user.password === password;

  if (!canLogin) {
    const locked = registerFailedAttempt(normalizedUsername);

    return res.status(401).json({
      message: locked
        ? "Usuario o contraseña incorrectos. La cuenta quedo bloqueada por 15 minutos."
        : "Usuario o contraseña incorrectos"
    });
  }

  loginLocks.set(normalizedUsername, { attempts: 0, lockedUntil: null });

  return res.json({
    token: "mock-session-token",
    user: {
      name: user.name,
      role: user.role
    }
  });
});

app.listen(port, () => {
  console.log(`AeroInspect API listening on http://localhost:${port}`);
});
