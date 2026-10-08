import { useMemo, useState } from "react";
import type { BackendAsset, BackendReport } from "../../api/types";
import { assetInsights, severityLabels } from "../../utils/reportInsights";

const colors = { red: "#c74348", amber: "#ba7b17", blue: "#376eb3", violet: "#8062b0", green: "#24845e", gray: "#6d7c90" };
export function PlantReportDashboard({ assets, reports, onCaptures }: {
  assets: BackendAsset[]; reports: BackendReport[]; onCaptures: (id: number) => void;
}) {
  const insights = useMemo(() => assetInsights(assets, reports), [assets, reports]);
  const [filter, setFilter] = useState("all");
  const attention = insights.filter(a => a.findings > 0 || a.pending || a.category === "review").length;
  const pending = insights.filter(a => a.pending || a.category === "review").length;
  const inspected = insights.filter(a => a.date !== null).length;
  const coverage = assets.length ? Math.round(inspected / assets.length * 100) : 0;
  const visible = useMemo(() => insights.filter(a =>
    filter === "all" || (filter === "attention" ? a.findings > 0 || a.pending || a.category === "review"
      : filter === "review" ? a.pending || a.category === "review" : a.category === filter)), [insights, filter]);
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
  const changeFilter = (next: string) => setFilter(next);
  return <section className="plant-analysis" aria-label="Dashboard de análisis de planta">
    <div className="analysis-summary-line">
      <div><strong>{assets.length}</strong><span>Activos registrados</span></div>
      <div><strong>{inspected}</strong><span>Con reportes</span></div>
      <button type="button" onClick={() => changeFilter("attention")}><strong>{attention}</strong><span>Requieren atención</span></button>
      <button type="button" onClick={() => changeFilter("review")}><strong>{pending}</strong><span>Pendientes de revisión</span></button>
    </div>
    <div className="analysis-plots">
      <section className="analysis-coverage"><h3 title="Disponibilidad de reportes de la última inspección de cada activo. No indica ausencia de anomalías.">Cobertura de inspección</h3><div className="analysis-coverage-content"><figure aria-label={`${coverage}% de los activos tienen reportes`}><svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="54" fill="none" stroke="#e8edf4" strokeWidth="10"/><circle cx="66" cy="66" r="54" fill="none" stroke="#315c95" strokeWidth="10" strokeDasharray={`${coverage * 3.393} 339.3`} transform="rotate(-90 66 66)"/></svg><figcaption><strong>{assets.length ? `${coverage}%` : "—"}</strong><span>con reportes</span></figcaption></figure><div><p><i style={{ background: "#315c95" }}/><strong>{inspected}</strong> con reportes</p><p><i style={{ background: "#e0e7ef" }}/><strong>{assets.length - inspected}</strong> sin reportes</p></div></div></section>
      <section className="analysis-severity"><h3 title="Activos agrupados por su mayor gravedad informada en la última inspección.">Gravedad de los hallazgos</h3><div className="analysis-bars">{severityRows.map(row => <button type="button" key={row.key} onClick={() => changeFilter(row.key)} aria-label={`${row.label}: ${row.count} activos. Filtrar`} aria-pressed={filter === row.key}><span>{row.label}</span><span className="analysis-bar-track"><i style={{ width: `${row.count / severityMax * 100}%`, background: row.color }}/></span><strong>{row.count}</strong></button>)}</div></section>
      <section className="analysis-findings"><h3 title="Cantidad de activos afectados. Un activo puede presentar corrosión y grietas a la vez.">Tipos de hallazgo</h3><div className="analysis-bars analysis-finding-bars">{findingRows.map(row => <div key={row.label} aria-label={`${row.label}: ${row.count} activos`}><span>{row.label}</span><span className="analysis-bar-track"><i style={{ width: `${row.count / findingMax * 100}%`, background: row.color }}/></span><strong>{row.count}</strong></div>)}</div></section>
    </div>
    {comparison.length > 0 && <section className="analysis-comparison"><header><h3 title="Hasta 8 activos con hallazgos, ordenados por prioridad. Cada marca indica su mayor gravedad informada.">Gravedad por activo</h3></header><div className="analysis-heatmap-scroll"><div className="analysis-heatmap"><div className="analysis-heatmap-heading"><span>Activo</span>{severityColumns.map(level => <span key={level}>{level === "NOT_REPORTED" ? "Sin gravedad" : severityLabels[level]}</span>)}</div>{comparison.map(a => <button key={a.asset.idAsset} type="button" aria-label={`Ver capturas de ${a.asset.name}: ${severityLabels[a.severity]}`} onClick={() => onCaptures(a.asset.idAsset)}><strong>{a.asset.name}{a.pending && <small>Provisional</small>}</strong>{severityColumns.map(level => <span key={level} className={a.severity === level ? "active" : ""} style={a.severity === level ? { background: colors[a.tone as keyof typeof colors] } : undefined}>{a.severity === level ? "●" : ""}</span>)}</button>)}</div></div></section>}
    <section className="analysis-priority"><header><h3>Prioridad por activo</h3></header>
      <div className="analysis-table-toolbar"><div className="analysis-filters">{[{ key: "all", label: "Todos" }, { key: "attention", label: "Requieren atención" }, { key: "review", label: "Por revisar" }, { key: "unknown", label: "Sin información" }, { key: "clear", label: "Sin anomalías" }].map(item => <button key={item.key} type="button" className={filter === item.key ? "selected" : ""} aria-pressed={filter === item.key} onClick={() => changeFilter(item.key)}>{item.label}</button>)}</div></div>
      <div className="analysis-table-scroll"><table className="analysis-table analysis-asset-priority"><thead><tr><th>Activo</th><th>Anomalías</th><th>Gravedad máxima</th></tr></thead><tbody>{visible.map(a => <tr key={a.asset.idAsset} onClick={() => onCaptures(a.asset.idAsset)}>
        <td><button type="button" className="analysis-asset-name" aria-label={`Ver capturas de ${a.asset.name}`} onClick={event => { event.stopPropagation(); onCaptures(a.asset.idAsset); }}><strong>{a.asset.name}</strong><small>{a.asset.code}</small></button></td>
        <td><div className="analysis-anomaly-tags">{a.corrosion > 0 && <span className="analysis-tag corrosion">Corrosión</span>}{a.cracks > 0 && <span className="analysis-tag crack">Grietas</span>}{!a.findings && <span className={`analysis-tag ${a.category === "clear" ? "clear" : a.pending ? "pending" : "unknown"}`} title={a.label}>{a.category === "clear" ? "Sin anomalías" : a.pending ? "Pendiente" : "Sin resultados"}</span>}</div></td>
        <td><span className={`analysis-gravity ${a.severity === "CRITICAL" ? "critical" : a.tone}`} title={a.label}>{a.severity !== "NOT_REPORTED" && a.findings > 0 ? severityLabels[a.severity] : a.category === "clear" ? "No aplica" : "Sin determinar"}</span>{a.pending && a.findings > 0 && <small className="analysis-provisional">Provisional</small>}</td>
      </tr>)}</tbody></table>{!visible.length && <p className="analysis-empty">Sin activos en este filtro.</p>}</div>
    </section>
  </section>;
}
