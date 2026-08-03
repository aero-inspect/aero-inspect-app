import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";

const FILTERS = ["Todas", "Misiones", "Activos", "Reportes", "Drones", "Sesiones"];

const ACTIVITY_ITEMS = [
  {
    moment: "Hoy · 14:32",
    title: "Configuró la misión",
    detail: "Inspección Silo Norte",
    fullDate: "14/06/2026 - 14:32"
  },
  {
    moment: "Hoy · 11:15",
    title: "Generó el reporte",
    detail: "Reporte de corrosión",
    fullDate: "14/06/2026 - 11:15"
  },
  {
    moment: "Ayer · 16:48",
    title: "Registró un nuevo activo",
    detail: "Silo Norte",
    fullDate: "13/06/2026 - 16:48"
  },
  {
    moment: "Ayer · 10:12",
    title: "Completó la misión",
    detail: "Inspección Noria Principal",
    fullDate: "13/06/2026 - 10:12"
  },
  {
    moment: "09/06/2026 · 08:30",
    title: "Inició sesión",
    detail: "Acceso a la plataforma",
    fullDate: "09/06/2026 - 08:30"
  }
];

export function ActividadRecienteView() {
  return (
    <section className="activity-dashboard">
      <header className="activity-header">
        <div>
          <h1>Actividad reciente</h1>
          <p>Última acciones realizadas en la plataforma.</p>
        </div>
        <AppTopActions />
      </header>

      <section className="activity-history-card" aria-label="Historial cronológico">
        <div className="activity-history-heading">
          <h2>Historial cronológico</h2>
          <p>Registro de eventos del usuario en AeroInspect.</p>
        </div>

        <div className="activity-filter-tabs" aria-label="Filtros de actividad">
          {FILTERS.map((filter) => (
            <button className={filter === "Todas" ? "active" : undefined} key={filter} type="button">
              {filter}
            </button>
          ))}
        </div>

        <div className="activity-table" role="table" aria-label="Eventos recientes">
          {ACTIVITY_ITEMS.map((item) => (
            <article className="activity-row" key={`${item.title}-${item.fullDate}`} role="row">
              <div className="activity-row-copy">
                <time>{item.moment}</time>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
              <strong>{item.fullDate}</strong>
            </article>
          ))}
        </div>

        <footer className="activity-footer">
          <span>Mostrando 1 a 8 de 48 actividades</span>
          <nav className="activity-pagination" aria-label="Paginación de actividad">
            <button aria-label="Página anterior" type="button">
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            {[1, 2, 3, 4, 5].map((page) => (
              <button className={page === 1 ? "active" : undefined} key={page} type="button">
                {page}
              </button>
            ))}
            <button aria-label="Página siguiente" type="button">
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </footer>
      </section>
    </section>
  );
}
