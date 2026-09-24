import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";
import { useActivity, activityTitles, eventDate } from "../data/ActivityContext";

const FILTERS=["Todas","Misiones","Activos"];
export function ActividadRecienteView() {
  const {activity,loading,error}=useActivity();
  const [filter,setFilter]=useState('Todas'),[page,setPage]=useState(1);
  const items=activity.filter(item=>filter==='Todas'||(filter==='Activos'?item.kind==='ASSET_CREATED':item.kind.startsWith('MISSION_')));
  const pages=Math.max(1,Math.ceil(items.length/8)),current=Math.min(page,pages),start=(current-1)*8;
  return <section className="activity-dashboard">
    <header className="activity-header"><div><h1>Actividad reciente</h1><p>Últimas acciones realizadas en la plataforma.</p></div><AppTopActions/></header>
    <section className="activity-history-card" aria-label="Historial cronológico">
      <div className="activity-history-heading"><h2>Historial cronológico</h2><p>Registro de eventos del usuario en AeroInspect.</p></div>
      <div className="activity-filter-tabs" aria-label="Filtros de actividad">
        {FILTERS.map(value=><button key={value} type="button" className={filter===value?'active':undefined} onClick={()=>{setFilter(value);setPage(1);}}>{value}</button>)}
      </div>
      {error && <p role="status">{error}</p>}
      <div className="activity-table" role="table" aria-label="Eventos recientes">
        {!items.length && !error && <p className="activity-empty-message">{loading?'Cargando actividad…':'No existe ninguna actividad reciente.'}</p>}
        {items.slice(start,start+8).map(item=><article className="activity-row" role="row" key={item.id}>
          <div className="activity-row-copy"><time dateTime={item.occurredAt}>{eventDate(item.occurredAt)}</time><h3>{activityTitles[item.kind]}</h3><p>{item.name}</p></div>
        </article>)}
      </div>
      <footer className="activity-footer"><span>Mostrando {items.length?start+1:0} a {Math.min(start+8,items.length)} de {items.length} actividades</span>
        {pages>1 && <nav className="activity-pagination" aria-label="Paginación de actividad">
          <button type="button" aria-label="Página anterior" disabled={current===1} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/></button>
          <span>{current} / {pages}</span>
          <button type="button" aria-label="Página siguiente" disabled={current===pages} onClick={()=>setPage(current+1)}><ChevronRight size={15}/></button>
        </nav>}
      </footer>
    </section>
  </section>;
}
