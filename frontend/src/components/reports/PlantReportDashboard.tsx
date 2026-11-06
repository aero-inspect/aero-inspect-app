import { useMemo, useState } from "react";
import type { BackendAsset, BackendReport } from "../../api/types";
import { assetInsights, severityLabels } from "../../utils/reportInsights";
import { BACKEND_ASSET_TYPE_LABELS } from "../../api/constants";

const colors = { red: "#c74348", amber: "#ba7b17", blue: "#376eb3", violet: "#8062b0", green: "#24845e", gray: "#6d7c90" };
export function PlantReportDashboard({ assets, reports, onCaptures }: {
  assets: BackendAsset[]; reports: BackendReport[]; onCaptures: (id: number) => void;
}) {
  const insights = useMemo(() => assetInsights(assets, reports), [assets, reports]);
  const [filter, setFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState<{ kind: "severity" | "finding"; key: string; label: string } | null>(null);
  const visible = useMemo(() => insights.filter(a =>
    (filter === "all" || a.asset.type === filter) && (!signalFilter || (signalFilter.kind === "severity"
      ? a.category === signalFilter.key
      : signalFilter.key === "corrosion" ? a.corrosion > 0 : signalFilter.key === "cracks" ? a.cracks > 0 : a.deformations > 0))), [insights, filter, signalFilter]);
  const severityRows = [
    { key: "high", label: "Alta / crítica", count: insights.filter(a => a.category === "high").length, color: colors.red },
    { key: "medium", label: "Media", count: insights.filter(a => a.category === "medium").length, color: colors.amber },
    { key: "low", label: "Baja", count: insights.filter(a => a.category === "low").length, color: colors.blue },
    { key: "review", label: "Sin gravedad", count: insights.filter(a => a.category === "review" && a.findings > 0).length, color: colors.violet }
  ];
  const findingRows = [
    { key: "corrosion", label: "Corrosión", count: insights.filter(a => a.corrosion > 0).length, color: "#8b96a5" },
    { key: "cracks", label: "Grietas", count: insights.filter(a => a.cracks > 0).length, color: "#8b96a5" },
    { key: "deformations", label: "Deformaciones", count: insights.filter(a => a.deformations > 0).length, color: "#8b96a5" }
  ];
  const findingMax = Math.max(1, ...findingRows.map(row => row.count));
  const severityMax = Math.max(1, ...severityRows.map(row => row.count));
  const changeFilter = (next: string) => setFilter(next);
  const typeFilters = useMemo(() => [...new Set(assets.map(a => a.type))].map(type => ({ key: type, label: BACKEND_ASSET_TYPE_LABELS[type] ?? type })), [assets]);
  return <section className="plant-analysis" aria-label="Dashboard de análisis de planta">
    <div className="analysis-plots">
      <section className="analysis-severity"><h3 title="Activos agrupados por su mayor gravedad informada en la última inspección.">Gravedad de los hallazgos</h3><div className="analysis-bars">{severityRows.map(row => <button type="button" className={signalFilter?.kind === "severity" && signalFilter.key === row.key ? "selected" : ""} key={row.key} aria-label={`${row.label}: ${row.count} activos`} onClick={() => setSignalFilter(current => current?.kind === "severity" && current.key === row.key ? null : { kind: "severity", key: row.key, label: row.label })}><span>{row.label}</span><span className="analysis-bar-track"><i style={{ width: `${row.count / severityMax * 100}%`, background: row.color }}/></span><strong>{row.count}</strong></button>)}</div></section>
      <section className="analysis-findings"><h3 title="Cantidad de activos afectados. Un activo puede presentar corrosión y grietas a la vez.">Tipos de hallazgo</h3><div className="analysis-bars analysis-finding-bars">{findingRows.map(row => <button type="button" className={signalFilter?.kind === "finding" && signalFilter.key === row.key ? "selected" : ""} key={row.label} aria-label={`${row.label}: ${row.count} activos`} onClick={() => setSignalFilter(current => current?.kind === "finding" && current.key === row.key ? null : { kind: "finding", key: row.key, label: row.label })}><span>{row.label}</span><span className="analysis-bar-track"><i style={{ width: `${row.count / findingMax * 100}%`, background: row.color }}/></span><strong>{row.count}</strong></button>)}</div></section>
    </div>
    <section className="analysis-priority">
      <div className="analysis-table-toolbar"><div className="analysis-filters">{[{ key: "all", label: "Todos" }, ...typeFilters].map(item => <button key={item.key} type="button" className={filter === item.key ? "selected" : ""} aria-pressed={filter === item.key} onClick={() => changeFilter(item.key)}>{item.label}</button>)}{signalFilter && <button className="analysis-signal-filter" onClick={() => setSignalFilter(null)} type="button">{signalFilter.label} ×</button>}</div></div>
      <div className="analysis-table-scroll"><table className="analysis-table analysis-asset-priority"><thead><tr><th>Activo</th><th>Anomalías</th><th>Gravedad</th></tr></thead><tbody>{visible.map(a => <tr key={a.asset.idAsset} onClick={() => onCaptures(a.asset.idAsset)}>
        <td><button type="button" className="analysis-asset-name" aria-label={`Ver capturas de ${a.asset.name}`} onClick={event => { event.stopPropagation(); onCaptures(a.asset.idAsset); }}><strong>{a.asset.name}</strong></button></td>
        <td><div className="analysis-anomaly-tags">{a.corrosion > 0 && <span className="analysis-tag corrosion">Corrosión</span>}{a.cracks > 0 && <span className="analysis-tag crack">Grietas</span>}{a.deformations > 0 && <span className="analysis-tag deformation">Deformaciones</span>}{!a.findings && <span className={`analysis-tag ${a.category === "clear" ? "clear" : a.pending ? "pending" : "unknown"}`} title={a.label}>{a.category === "clear" ? "Sin hallazgos" : a.pending ? "Pendiente de validar" : a.reports.length ? "Sin hallazgos" : "Sin inspeccionar"}</span>}</div></td>
        <td><span className={`analysis-gravity ${a.severity === "CRITICAL" ? "critical" : a.tone}`} title={a.label}>{a.severity !== "NOT_REPORTED" && a.findings > 0 ? severityLabels[a.severity] : a.category === "clear" ? "No aplica" : "Sin determinar"}</span>{a.pending && a.findings > 0 && <small className="analysis-provisional">Provisional</small>}</td>
      </tr>)}</tbody></table>{!visible.length && <p className="analysis-empty">Sin activos en este filtro.</p>}</div>
    </section>
  </section>;
}
