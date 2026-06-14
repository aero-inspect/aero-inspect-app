import type { FormEvent } from "react";
import { ArrowRight, Eye, Lock, UserRound } from "lucide-react";
import aeroInspectDrone from "../assets/aeroinspect-drone.png";

export function Login({
  username,
  password,
  error,
  showPassword,
  onUsernameChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit
}: {
  username: string;
  password: string;
  error: string;
  showPassword: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
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

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Usuario</span>
            <div className="input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input
                autoComplete="username"
                maxLength={50}
                onChange={(event) => onUsernameChange(event.target.value)}
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
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Ingresa tu contrasena"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                className="icon-button"
                onClick={onToggleShowPassword}
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
