import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FileText, Search, Trash2 } from "lucide-react";
import { deleteReport, downloadReportPdf, getAssets, getReports } from "../api/client";
import type { BackendAsset, BackendAssetType, BackendReport } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";
import { LoadingState } from "../components/LoadingState";
import { PlantReportDashboard } from "../components/reports/PlantReportDashboard";
import { AssetCaptures } from "../components/reports/AssetCaptures";
import { InspectionOverview } from "../components/reports/InspectionOverview";
import { groupInspections, formatReportDate, localPhotoDay, severityLabels as inspectionSeverityLabels } from "../utils/reportInsights";
import { BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import { useSelectedPlant } from "../data/PlantContext";

const statusLabels: Record<BackendReport["status"], string> = { PROCESSING: "Procesando", PENDING_VALIDATION: "Pendiente de validación", VALIDATED: "Validada", REJECTED: "Rechazada" };
const assetTypes = Object.entries(BACKEND_ASSET_TYPE_LABELS).map(([value,label])=>({value: value as BackendAssetType,label}));
const severityFilters = { Todas: "Todas", CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja", NOT_REPORTED: "No informada" };
const severityLabels: Record<BackendReport["severity"], string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja", NOT_REPORTED: "No informada" };
const severityLabel = (severity: BackendReport["severity"]) => severityLabels[severity];
const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const reportDateLabel = (value: string) => dateFormatter.format(new Date(value));
const compactReportTitle = (report: BackendReport) => report.title.replace(report.code, "").trim() || report.title;

export function ReportesView({ onViewReport }: { onViewReport: (code: string) => void }) {
  const plant=useSelectedPlant();
  const [view,setView]=useState<"dashboard"|"history"|"captures">(()=>{const saved=sessionStorage.getItem(`reportes-view-${plant.id}`);return saved==="history"||saved==="captures" ? saved : "dashboard";});
  const [captureAssetId,setCaptureAssetId]=useState<number|null>(null);
  const [inspectionId,setInspectionId]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const changeView=(next:typeof view)=>{setView(next);setInspectionId(null);sessionStorage.setItem(`reportes-view-${plant.id}`,next);};
  const [reports, setReports] = useState<BackendReport[]>([]), [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<BackendAsset[]>([]);
  const [error, setError] = useState(""), [startDate, setStartDate] = useState(""), [endDate, setEndDate] = useState("");
  const [assetFilter, setAssetFilter] = useState("Todos"), [severityFilter, setSeverityFilter] = useState("Todas");
  const [openFilter, setOpenFilter] = useState<"asset" | "severity" | null>(null), [searchTerm, setSearchTerm] = useState("");
  const [openDate, setOpenDate] = useState<"start" | "end" | null>(null), [deleteCandidate, setDeleteCandidate] = useState<BackendReport | null>(null);
  useEffect(() => {
    let cancelled=false;setLoading(true);setError("");
    Promise.all([getReports(plant),getAssets(plant)]).then(([nextReports,nextAssets])=>{if(!cancelled){setReports(nextReports);setAssets(nextAssets);}}).catch(e=>{if(!cancelled)setError(e instanceof Error ? e.message : "No se pudieron cargar los reportes");}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[plant.id,refresh]);
  const assetTypeById = useMemo(() => new Map(assets.map((asset) => [asset.idAsset, asset.type])), [assets]);
  const filtered = reports.filter((r) => { const day = localPhotoDay(r.createdAt); return (assetFilter === "Todos" || assetTypeById.get(r.idAsset) === assetFilter) && (severityFilter === "Todas" || r.severity === severityFilter) && (!startDate || day >= startDate) && (!endDate || day <= endDate) && `${r.title} ${r.code} ${r.assetName} ${r.missionName}`.toLowerCase().includes(searchTerm.toLowerCase()); });
  const removeReport = async (report: BackendReport) => {
    try { await deleteReport(report.code); setReports((current) => current.filter((item) => item.code !== report.code)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar el reporte"); }
    finally { setDeleteCandidate(null); }
  };
  return <section className="reports-dashboard report-workspace">
    <header className="reports-topbar"><div><h1>Reportes</h1><p>Estado de planta, historial de inspecciones y evidencias por activo.</p></div><AppTopActions /></header>
    <div className="report-workspace-toolbar"><nav className="report-workspace-nav" aria-label="Vistas de reportes">{[{id:"dashboard",label:"Estado de planta"},{id:"history",label:"Reportes históricos"},{id:"captures",label:"Capturas por activo"}].map(tab=><button key={tab.id} type="button" aria-current={view===tab.id ? "page" : undefined} className={view===tab.id ? "selected" : ""} onClick={()=>changeView(tab.id as typeof view)}>{tab.label}</button>)}</nav><div className="report-actions-row"><button className="report-secondary" onClick={()=>setRefresh(v=>v+1)} disabled={loading} title="Vuelve a consultar los reportes y activos guardados. No ejecuta el análisis de IA.">Recargar datos</button></div></div>
    {loading ? <LoadingState text="Cargando reportes y activos..." compact/> : error && view!=="history" ? <div role="alert"><p className="reports-feedback error">{error}</p><button className="report-secondary" onClick={()=>setRefresh(v=>v+1)}>Reintentar</button></div> : view==="dashboard" ? <PlantReportDashboard assets={assets} reports={reports} onCaptures={id=>{setCaptureAssetId(id);changeView("captures");}}/> : view==="captures" ? <AssetCaptures assets={assets} reports={reports} selectedId={captureAssetId} onSelect={setCaptureAssetId} onReport={onViewReport}/> : inspectionId ? <InspectionOverview reports={reports.filter(r=>r.idMission===inspectionId)} onBack={()=>setInspectionId(null)} onReport={onViewReport}/> : <>
    <section className="reports-filters-row"><div className="reports-filters">
      <DateFilter label="Desde" open={openDate === "start"} value={startDate} onToggle={() => setOpenDate(openDate === "start" ? null : "start")} onSelect={(value) => { setStartDate(value); setOpenDate(null); }} />
      <DateFilter label="Hasta" open={openDate === "end"} value={endDate} onToggle={() => setOpenDate(openDate === "end" ? null : "end")} onSelect={(value) => { setEndDate(value); setOpenDate(null); }} />
      <Filter label={assetFilter === "Todos" ? "Activo" : assetTypes.find((type) => type.value === assetFilter)?.label ?? assetFilter} open={openFilter === "asset"} onToggle={() => setOpenFilter(openFilter === "asset" ? null : "asset")} options={["Todos", ...assetTypes.map((type) => type.value)]} labels={{ Todos: "Todos", ...Object.fromEntries(assetTypes.map((type) => [type.value, type.label])) }} value={assetFilter} onSelect={(v) => { setAssetFilter(v); setOpenFilter(null); }} />
      <Filter label={severityFilter === "Todas" ? "Severidad" : severityFilters[severityFilter as keyof typeof severityFilters]} open={openFilter === "severity"} onToggle={() => setOpenFilter(openFilter === "severity" ? null : "severity")} options={Object.keys(severityFilters)} labels={severityFilters} value={severityFilter} onSelect={(v) => { setSeverityFilter(v); setOpenFilter(null); }} />
      <label className="reports-search"><Search size={16} /><input onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar reporte..." value={searchTerm} /></label>
    </div></section>
    {!!filtered.length && <section className="report-card report-inspection-history"><div className="report-section-heading"><div><h2>Inspecciones</h2><p>Abrí una inspección para ver el resumen y las capturas agrupadas por activo.</p></div></div><div className="inspection-history-list">{groupInspections(filtered).map(group=><button key={group.id} type="button" onClick={()=>setInspectionId(group.id)}><div><strong>{group.name}</strong><span>{formatReportDate(group.date)} · {group.assetsCount} activos{filtered.length!==reports.length ? " en el filtro" : ""}</span></div><span className="report-badge gray">{inspectionSeverityLabels[group.severity]}</span><Eye size={17}/></button>)}</div></section>}
    <section className="reports-card reports-table-card"><div className="reports-table-header"><h2>Reportes por activo</h2></div>
      {loading ? <LoadingState text="Cargando reportes..." compact /> : error ? <p className="reports-feedback error">{error}</p> : !reports.length ? <div className="reports-empty"><span><FileText size={34} /></span><h3>Todavía no hay reportes</h3><p>Los reportes aparecerán cuando haya evidencias procesadas de las inspecciones de esta planta.</p></div> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Reporte</th><th>Activo</th><th>Fecha</th><th>Misión</th><th>Hallazgos</th><th>Severidad</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {filtered.map((r) => <tr key={r.code}><td><div className="report-name-cell"><div><strong>{compactReportTitle(r)}</strong></div></div></td><td>{r.assetName}</td><td>{reportDateLabel(r.createdAt)}</td><td>{r.missionName}</td><td>{r.findingsCount}</td><td>{severityLabel(r.severity)}</td><td><span className={`report-status ${r.status === "VALIDATED" ? "done" : "review"}`}>{statusLabels[r.status]}</span></td><td><div className="report-actions"><button onClick={() => onViewReport(r.code)} aria-label="Ver reporte" title="Ver reporte" type="button"><Eye size={15} /></button><button onClick={() => void downloadReportPdf(r.code)} aria-label="Descargar PDF" title="Descargar PDF" type="button"><Download size={15} /></button><button onClick={() => setDeleteCandidate(r)} aria-label="Eliminar reporte" title="Eliminar reporte" type="button"><Trash2 size={15} /></button></div></td></tr>)}
      </tbody></table>{!filtered.length && <div className="reports-empty compact"><span><Search size={26} /></span><h3>Sin resultados</h3><p>No encontramos reportes que coincidan con los filtros seleccionados.</p></div>}</div>}
      <footer className="reports-table-footer"><span>Mostrando {filtered.length} de {reports.length} reportes</span></footer>
    </section>
    </>}
    {deleteCandidate && <div className="modal-backdrop profile-delete-modal-backdrop" role="presentation"><section aria-modal="true" className="profile-delete-modal report-delete-modal" role="dialog"><span className="profile-delete-modal-icon" aria-hidden="true"><AlertTriangle size={31} /></span><h2>Eliminar reporte</h2><p>¿Seguro que querés eliminar el reporte {deleteCandidate.code}? Esta acción no se puede deshacer.</p><div className="profile-delete-modal-actions"><button className="profile-delete-modal-secondary" onClick={() => setDeleteCandidate(null)} type="button">Cancelar</button><button className="profile-delete-modal-primary" onClick={() => void removeReport(deleteCandidate)} type="button">Eliminar</button></div></section></div>}
  </section>;
}

function Filter({ label, open, onToggle, options, labels = {}, value, onSelect }: { label: string; open: boolean; onToggle: () => void; options: string[]; labels?: Record<string, string>; value: string; onSelect: (value: string) => void }) {
  return <div className={value === options[0] ? "assets-filter-select reports-custom-select" : "assets-filter-select selected reports-custom-select"}><button onClick={onToggle} type="button">{label}</button><ChevronDown size={14} />{open && <div className="assets-filter-menu">{options.map((o) => <button className={value === o ? "selected" : undefined} key={o} onClick={() => onSelect(o)} type="button">{labels[o] ?? o}</button>)}</div>}</div>;
}

function DateFilter({ label, open, value, onToggle, onSelect }: { label: string; open: boolean; value: string; onToggle: () => void; onSelect: (value: string) => void }) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  useEffect(() => {
    if (open) setVisibleMonth(selectedDate ?? new Date());
  }, [open, value]);
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  const toValue = (day: Date) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const moveMonth = (offset: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  return <div className="reports-date-filter reports-date-picker"><button onClick={onToggle} type="button"><span>{label}</span><strong>{selectedDate ? selectedDate.toLocaleDateString("es-AR") : "Seleccionar"}</strong><CalendarDays size={15} /></button>{open && <div className="reports-date-menu"><header><button aria-label="Mes anterior" onClick={() => moveMonth(-1)} type="button"><ChevronLeft size={14} /></button><strong>{visibleMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</strong><button aria-label="Mes siguiente" onClick={() => moveMonth(1)} type="button"><ChevronRight size={14} /></button></header><div className="reports-date-weekdays">{["D", "L", "M", "M", "J", "V", "S"].map((day,index) => <span key={index}>{day}</span>)}</div><div className="reports-date-grid">{days.map((day) => <button className={[day.getMonth() !== visibleMonth.getMonth() ? "muted" : "", value === toValue(day) ? "selected" : ""].filter(Boolean).join(" ")} key={toValue(day)} onClick={() => onSelect(toValue(day))} type="button">{day.getDate()}</button>)}</div></div>}</div>;
}
