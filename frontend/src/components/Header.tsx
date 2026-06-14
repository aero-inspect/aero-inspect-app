import { Bell, ChevronDown } from "lucide-react";

export function Header({
  initials,
  name,
  onProfileClick
}: {
  initials: string;
  name: string;
  onProfileClick: () => void;
}) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <img className="app-brand-drone" src="/src/assets/aeroinspect-drone.png" alt="" aria-hidden="true" />
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
        <button className="user-menu" type="button" onClick={onProfileClick}>
          <span className="user-avatar">{initials}</span>
          <span>{name}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
