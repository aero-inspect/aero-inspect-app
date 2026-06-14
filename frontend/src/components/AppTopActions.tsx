import { useState } from "react";
import { AlertTriangle, ArrowRight, Bell, Calendar, CheckCircle2, Plane, Sun, UserRound } from "lucide-react";

export function AppTopActions() {
  const [isOpen, setIsOpen] = useState(false);

  const goToProfile = () => {
    window.history.pushState({}, "", "/perfil");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const notifications = [
    { tone: "danger", title: "Hallazgo critico detectado", text: "Se detecto corrosion severa en Silo Norte.", time: "Hace 5 min", icon: <AlertTriangle size={18} /> },
    { tone: "info", title: "Mision en progreso", text: "Inspeccion Cinta Transportadora 2 completada al 40%.", time: "Hace 12 min", icon: <DroneGlyph size={18} /> },
    { tone: "success", title: "Reporte generado", text: "El reporte mensual de mayo esta listo para descargar.", time: "Hace 1 hora", icon: <CheckCircle2 size={18} /> },
    { tone: "warning", title: "Mantenimiento programado", text: "El mantenimiento del dron esta programado para 10/06/2025.", time: "Hace 3 horas", icon: <Calendar size={18} /> },
    { tone: "purple", title: "Nueva mision asignada", text: "Se te asigno la mision Inspeccion Noria Principal.", time: "Hace 1 dia", icon: <Plane size={18} /> }
  ];

  return (
    <div className="app-top-actions">
      <div className="app-weather">
        <Sun size={34} className="weather-icon" />
        <div>
          <strong>23°C</strong>
          <span>Parcialmente nublado</span>
        </div>
      </div>

      <div className="notifications-menu-wrap">
        <button className="tech-notification-button" onClick={() => setIsOpen((current) => !current)} type="button" aria-label="Notificaciones">
          <Bell size={20} />
          <span>3</span>
        </button>

        {isOpen && (
          <section className="notifications-popover" aria-label="Notificaciones">
            <header>
              <h2>Notificaciones</h2>
              <button type="button">Marcar todas como leidas</button>
            </header>
            <div className="notifications-list">
              {notifications.map((item) => (
                <article className="notification-item" key={item.title}>
                  <span className={`notification-icon ${item.tone}`}>{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                    <small>{item.time}</small>
                  </div>
                  <i />
                </article>
              ))}
            </div>
            <button className="notifications-all-button" type="button">
              Ver todas las notificaciones
              <ArrowRight size={14} />
            </button>
          </section>
        )}
      </div>

      <button className="tech-user-button" onClick={goToProfile} type="button" aria-label="Perfil">
        <UserRound size={21} />
      </button>
    </div>
  );
}

export function DroneGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 8h10M12 8v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9.5 13h5l1.6 3H7.9L9.5 13Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="5" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="19" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 5.8V4M19 5.8V4M9.5 18h-2M14.5 18h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
