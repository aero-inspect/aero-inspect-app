import { useMemo, useState } from "react";
import { ArrowRight, Camera, MapPin, Search, X } from "lucide-react";
import type { BackendAsset, BackendReport } from "../../api/types";
import { SelectedPlant3DMap } from "../SelectedPlant3DMap";
import { useSelectedPlant } from "../../data/PlantContext";
import { assetInsights, formatReportDate, severityLabels } from "../../utils/reportInsights";
import { EvidenceGallery } from "./EvidenceGallery";

const colors = { red: "#c74348", amber: "#ba7b17", blue: "#376eb3", violet: "#8062b0", green: "#24845e", gray: "#6d7c90" };
export function PlantReportDashboard({ assets, reports, onReport, onCaptures }: {
  assets: BackendAsset[]; reports: BackendReport[]; onReport: (code: string) => void; onCaptures: (id: number) => void;
}) {
  const plant = useSelectedPlant();
  const insights = useMemo(() => assetInsights(assets, reports), [assets, reports]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const attention = insights.filter(a => a.findings > 0 || a.pending || a.category === "review").length;
  const pending = insights.filter(a => a.pending || a.category === "review").length;
  const inspected = insights.filter(a => a.date !== null).length;
  const coverage = assets.length ? Math.round(inspected / assets.length * 100) : 0;
  const latestDate = Math.max(0, ...insights.map(a => a.date ?? 0));
  const visible = useMemo(() => insights.filter(a =>
    (filter === "all" || (filter === "attention" ? a.findings > 0 || a.pending || a.category === "review"
      : filter === "review" ? a.pending || a.category === "review" : a.category === filter)) &&
    `${a.asset.name} ${a.asset.code}`.toLowerCase().includes(search.toLowerCase())), [insights, filter, search]);
  const selected = insights.find(a => a.asset.idAsset === selectedId);
  const selectedPhotos = useMemo(() => selected?.photos.slice(0, 3) ?? [], [selected]);
  const markers = useMemo(() => Object.fromEntries(visible.map(a => [a.asset.idAsset, {
    color: colors[a.tone as keyof typeof colors], label: a.label
  }])), [visible]);
  const severityRows = [
    { key: "high", label: "Alta / crítica", count: insights.filter(a => a.category === "high").length, color: colors.red },
    { key: "medium", label: "Media", count: insights.filter(a => a.category === "medium").length, color: colors.amber },
    { key: "low", label: "Baja", count: insights.filter(a => a.category === "low").length, color: colors.blue },
    { key: "review", label: "Sin gravedad", count: insights.filter(a => a.category === "review" && a.findings > 0).length, color: colors.violet }
  ];
  const comparison = insights.filter(a => a.findings > 0).slice(0, 8);
  const findingRows = [
    { label: "Corrosión", count: insights.filter(a => a.corrosion > 0).length, color: colors.amber },
    { label: "Grietas", count: insights.filter(a => a.cracks > 0).length, color: colors.violet }
  ];
  const findingMax = Math.max(1, ...findingRows.map(row => row.count));
  const severityColumns = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOT_REPORTED"] as const;
  const severityMax = Math.max(1, ...severityRows.map(row => row.count));
  const changeFilter = (next: string) => { setFilter(next); setSelectedId(null); };
  return <section className="plant-analysis" aria-label="Dashboard de análisis de planta">
    <header className="analysis-heading"><div><span className="reports-eyebrow">ANÁLISIS DE PLANTA</span><h2>{plant.name}</h2></div><div className="analysis-update-note"><span>Última inspección</span><strong>{latestDate ? formatReportDate(latestDate) : "Sin reportes disponibles"}</strong></div></header>
    <div className="analysis-summary-line">
      <div><strong>{assets.length}</strong><span>Activos registrados</span></div>
      <div><strong>{inspected}</strong><span>Con reportes</span></div>
      <button type="button" onClick={() => changeFilter("attention")}><strong>{attention}</strong><span>Requieren atención</span></button>
      <button type="button" onClick={() => changeFilter("review")}><strong>{pending}</strong><span>Pendientes de revisión</span></button>
    </div>
    <div className="analysis-plots">
      <section className="analysis-coverage"><h3 title="Disponibilidad de reportes de la última inspección de cada activo. No indica ausencia de anomalías.">Cobertura de inspección</h3><div className="analysis-coverage-content"><figure aria-label={`${coverage}% de los activos tienen reportes`}><svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="54" fill="none" stroke="#e8edf4" strokeWidth="10"/><circle cx="66" cy="66" r="54" fill="none" stroke="#315c95" strokeWidth="10" strokeDasharray={`${coverage * 3.393} 339.3`} transform="rotate(-90 66 66)"/></svg><figcaption><strong>{assets.length ? `${coverage}%` : "—"}</strong><span>con reportes</span></figcaption></figure><div><p><i style={{ background: "#315c95" }}/><strong>{inspected}</strong> con reportes</p><p><i style={{ background: "#e0e7ef" }}/><strong>{assets.length - inspected}</strong> sin reportes</p></div></div></section>
      <section className="analysis-severity"><h3 title="Activos agrupados por su mayor gravedad informada en la última inspección.">Gravedad de los hallazgos</h3><div className="analysis-bars">{severityRows.map(row => <button type="button" key={row.key} onClick={() => changeFilter(row.key)} aria-label={`${row.label}: ${row.count} activos. Filtrar`} aria-pressed={filter === row.key}><span>{row.label}</span><span className="analysis-bar-track"><i style={{ width: `${row.count / severityMax * 100}%`, background: row.color }}/></span><strong>{row.count}</strong></button>)}</div></section>
      <section className="analysis-findings"><h3 title="Cantidad de activos afectados. Un activo puede presentar corrosión y grietas a la vez.">Tipos de hallazgo</h3><div className="analysis-bars analysis-finding-bars">{findingRows.map(row => <div key={row.label} aria-label={`${row.label}: ${row.count} activos`}><span>{row.label}</span><span className="analysis-bar-track"><i style={{ width: `${row.count / findingMax * 100}%`, background: row.color }}/></span><strong>{row.count}</strong></div>)}</div><p className="analysis-pending-note"><strong>{pending}</strong> activos por revisar.</p></section>
    </div>
    {!reports.length && <p className="analysis-no-data" role="status">Sin reportes de inspección para esta planta.</p>}
    <section className="analysis-comparison"><header><h3 title="Hasta 8 activos con hallazgos, ordenados por prioridad. Cada marca indica su mayor gravedad informada.">Gravedad por activo</h3></header><div className="analysis-heatmap-scroll"><div className="analysis-heatmap"><div className="analysis-heatmap-heading"><span>Activo</span>{severityColumns.map(level => <span key={level}>{level === "NOT_REPORTED" ? "Sin gravedad" : severityLabels[level]}</span>)}</div>{comparison.map(a => <button key={a.asset.idAsset} type="button" aria-label={`Comparar ${a.asset.name}: ${severityLabels[a.severity]}`} onClick={() => setSelectedId(a.asset.idAsset)}><strong>{a.asset.name}{a.pending && <small>Provisional</small>}</strong>{severityColumns.map(level => <span key={level} className={a.severity === level ? "active" : ""} style={a.severity === level ? { background: colors[a.tone as keyof typeof colors] } : undefined}>{a.severity === level ? "●" : ""}</span>)}</button>)}</div></div>{!comparison.length && <p className="analysis-empty">Sin hallazgos para comparar.</p>}</section>
    <section className="analysis-priority"><header><div><h3 title="Activos ordenados de mayor a menor gravedad. Seleccioná uno para consultar la evidencia.">Prioridad por activo</h3></div><label className="report-search"><Search size={16}/><input placeholder="Buscar activo..." aria-label="Buscar activo en el dashboard" value={search} onChange={e => setSearch(e.target.value)}/></label></header>
      <div className="analysis-table-toolbar"><div className="analysis-filters">{[{ key: "all", label: "Todos" }, { key: "attention", label: "Requieren atención" }, { key: "review", label: "Por revisar" }, { key: "unknown", label: "Sin información" }, { key: "clear", label: "Sin anomalías" }].map(item => <button key={item.key} type="button" className={filter === item.key ? "selected" : ""} aria-pressed={filter === item.key} onClick={() => changeFilter(item.key)}>{item.label}</button>)}</div><button type="button" className="analysis-map-toggle" aria-expanded={showMap} onClick={() => setShowMap(value => !value)}><MapPin size={15}/>{showMap ? "Ocultar mapa 3D" : "Consultar mapa 3D"}</button></div>
      <div className="analysis-table-scroll"><table className="analysis-table"><thead><tr><th>Activo</th><th>Resultado / prioridad</th><th title="Cantidad de capturas con corrosión en la última inspección">Corrosión</th><th title="Cantidad de capturas con grietas en la última inspección">Grietas</th><th>Última inspección</th><th><span className="analysis-visually-hidden">Detalle</span></th></tr></thead><tbody>{visible.map(a => <tr key={a.asset.idAsset} className={selectedId === a.asset.idAsset ? "selected" : ""}><td><button type="button" className="analysis-asset-name" onClick={() => setSelectedId(a.asset.idAsset)}><strong>{a.asset.name}</strong><small>{a.asset.code}</small></button></td><td><span className={`analysis-status ${a.tone}`}><i style={{ background: colors[a.tone as keyof typeof colors] }}/>{a.label}</span>{a.pending && a.findings > 0 && <small className="analysis-provisional">Provisional</small>}</td><td>{a.date ? a.corrosion : "—"}</td><td>{a.date ? a.cracks : "—"}</td><td>{a.date ? formatReportDate(a.date) : "Sin inspección"}</td><td><button type="button" className="report-icon-button" aria-label={`Ver detalle de ${a.asset.name}`} onClick={() => setSelectedId(a.asset.idAsset)}><ArrowRight size={16}/></button></td></tr>)}</tbody></table>{!visible.length && <p className="analysis-empty">No hay activos que coincidan con este filtro. Probá otro filtro o búsqueda.</p>}</div><p className="analysis-caption analysis-table-note">{visible.length} de {assets.length} activos</p>
    </section>
    {selected && <section className="analysis-asset-detail"><header className="report-section-heading"><div><span className="reports-eyebrow">EVIDENCIA DEL ACTIVO</span><h2>{selected.asset.name} <small>{selected.asset.code}</small></h2><p>{selected.date ? `Última inspección: ${formatReportDate(selected.date)}` : "Sin inspección registrada"}</p></div><button className="report-icon-button" onClick={() => setSelectedId(null)} aria-label="Cerrar detalle del activo"><X size={20}/></button></header><div className="report-asset-detail-actions"><span className={`report-badge ${selected.tone}`}>{selected.label}</span><button className="report-secondary" onClick={() => onCaptures(selected.asset.idAsset)}><Camera size={16}/> Ver capturas del activo</button>{selected.reports.map(r => <button className="report-link" key={r.code} onClick={() => onReport(r.code)}>Ver reporte {r.code}<ArrowRight size={14}/></button>)}</div>{selectedPhotos.length ? <EvidenceGallery photos={selectedPhotos} onReport={onReport}/> : <p className="report-muted">Todavía no hay evidencia disponible para este activo.</p>}</section>}
    {showMap && <section className="analysis-map-section"><header className="report-section-heading"><div><h3>Ubicación de los activos · {plant.name}</h3></div><button className="report-icon-button" aria-label="Cerrar mapa 3D" onClick={() => setShowMap(false)}><X size={18}/></button></header><div className="report-dashboard-map"><SelectedPlant3DMap assets={assets} onViewAsset={setSelectedId} focusedAssetCode={selected?.asset.code ?? null} inspectionStates={markers}/></div></section>}
  </section>;
}
