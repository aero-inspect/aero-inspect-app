import type { FormEvent } from "react";
import { Eye, Lock, UserRound } from "lucide-react";
import sidebarLogo from "../assets/aeroinspect-sidebar-logo.png";

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
  const fieldStateClass = error ? "input-wrap input-wrap-error" : "input-wrap";

  return (
    <main className="login-shell">
      <section className="login-visual" aria-label="AeroInspect">
        <div className="brand-lockup">
          <img className="hero-logo" src={sidebarLogo} alt="AeroInspect" />
        </div>
      </section>

      <section className="login-panel" aria-label="Inicio de sesión">
        <div className="login-heading">
          <h2>Iniciar sesión</h2>
          <span aria-hidden="true" />
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Usuario</span>
            <div className={fieldStateClass}>
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
            <span>Contraseña</span>
            <div className={fieldStateClass}>
              <Lock size={18} aria-hidden="true" />
              <input
                autoComplete="current-password"
                maxLength={100}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Ingresa tu contraseña"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
          </button>
        </form>
      </section>
    </main>
  );
}

