import {
  Activity,
  ArrowLeft,
  ClipboardCheck,
  FileText,
  LogIn,
  PackagePlus,
  Plane,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";

const SUMMARY_CARDS = [
  { label: "Actividades", value: "128", icon: <Activity size={20} /> },
  { label: "Misiones", value: "12", icon: <Plane size={20} /> },
  { label: "Reportes", value: "8", icon: <FileText size={20} /> },
  { label: "Activos", value: "4", icon: <PackagePlus size={20} /> }
];

const ACTIVITY_ITEMS = [
  {
    action: "Configuro la mision",
    item: "Inspeccion Silo Norte",
    datetime: "Hoy - 14:32",
    fullDate: "14/06/2026 - 14:32",
    icon: <Plane size={18} />
  },
  {
    action: "Genero el reporte",
    item: "Reporte de corrosion",
    datetime: "Hoy - 11:15",
    fullDate: "14/06/2026 - 11:15",
    icon: <FileText size={18} />
  },
  {
    action: "Registro un nuevo activo",
    item: "Silo Norte",
    datetime: "Ayer - 16:48",
    fullDate: "13/06/2026 - 16:48",
    icon: <PackagePlus size={18} />
  },
  {
    action: "Completo la mision",
    item: "Inspeccion Noria Principal",
    datetime: "Ayer - 10:12",
    fullDate: "13/06/2026 - 10:12",
    icon: <ClipboardCheck size={18} />
  },
  {
    action: "Inicio sesion",
    item: "Acceso a la plataforma",
    datetime: "09/06/2026 - 08:30",
    fullDate: "09/06/2026 - 08:30",
    icon: <LogIn size={18} />
  }
];

const FILTERS = ["Todas", "Misiones", "Activos", "Reportes", "Drones", "Sesiones"];

export function ActividadRecienteView() {
  return (
    <section className="activity-dashboard">
      <header className="assets-dashboard-header activity-header">
        <div className="activity-title-group">
          <button
            aria-label="Volver al perfil"
            className="activity-back-button"
            onClick={() => {
              window.history.pushState({}, "", "/perfil");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            type="button"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <h1>Actividad reciente</h1>
            <p>Ultimas acciones realizadas en la plataforma.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      <section className="activity-summary-row" aria-label="Resumen de actividad">
        {SUMMARY_CARDS.map((card) => (
          <article className="activity-summary-card" key={card.label}>
            <span>{card.icon}</span>
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="activity-layout">
        <main className="activity-main-card">
          <div className="activity-toolbar">
            <div>
              <h2>Historial cronologico</h2>
              <p>Registro de eventos del usuario en AeroInspect.</p>
            </div>
          </div>

          <div className="activity-filter-tabs" aria-label="Filtros de actividad">
            {FILTERS.map((filter) => (
              <button className={filter === "Todas" ? "active" : undefined} key={filter} type="button">
                {filter}
              </button>
            ))}
          </div>

          <div className="activity-timeline">
            {ACTIVITY_ITEMS.map((item) => (
              <article className="activity-timeline-item" key={`${item.action}-${item.datetime}`}>
                <span className="activity-dot" />
                <div className="activity-item-card">
                  <span className="activity-item-icon">{item.icon}</span>
                  <div>
                    <time>{item.datetime}</time>
                    <h3>{item.action}</h3>
                    <p>{item.item}</p>
                  </div>
                  <small>{item.fullDate}</small>
                </div>
              </article>
            ))}
          </div>

          <footer className="activity-list-footer">
            <div className="activity-pagination">
              <button type="button" aria-label="Pagina anterior">
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button className="active" type="button">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button" aria-label="Pagina siguiente">
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
            <span>Mostrando 1 - 5 de 128 actividades</span>
          </footer>
        </main>
      </section>
    </section>
  );
}

