import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BackendAsset, BackendReport } from "../../api/types";
import { captureAnalytics } from "../../utils/reportInsights";

const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
export function CaptureAnalytics({ assets, reports, selectedId, onSelect }: {
  assets: BackendAsset[]; reports: BackendReport[]; selectedId: number | null; onSelect: (id: number) => void;
}) {
  const { affected, distribution } = useMemo(() => captureAnalytics(assets, reports), [assets, reports]);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(affected.length / 5));
  const currentPage = Math.min(page, pageCount - 1);
  useEffect(() => {
    const index = affected.findIndex(a => a.asset.idAsset === selectedId);
    if (index >= 0) setPage(Math.floor(index / 5));
  }, [affected, selectedId]);
  const pageAssets = affected.slice(currentPage * 5, currentPage * 5 + 5);
  let offset = 0;
  return <section className="capture-analytics" aria-label="Anomalías en las capturas de la planta">
    <section className="capture-donut-section">
      <h2>Activos afectados</h2>
      <div className="capture-donut-layout">
        <div className="capture-donut">
          <svg viewBox="0 0 120 120" role="img" aria-label={`${affected.length} activos afectados. ${distribution.map(d => `${d.label}: ${d.count}`).join(". ")}`}>
            <circle cx="60" cy="60" r="46" fill="none" stroke="#e9edf3" strokeWidth="13" />
            {distribution.filter(d => d.count > 0).map(d => {
              const length = d.count / affected.length * 100, start = offset; offset += length;
              return <circle key={d.label} cx="60" cy="60" r="46" fill="none" stroke={d.color} strokeWidth="13" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"><title>{d.label}: {d.count} activos</title></circle>;
            })}
          </svg>
          <div><strong>{affected.length}</strong><span>activos</span></div>
        </div>
        <ul className="capture-chart-legend">{distribution.map(d => <li key={d.label}><i style={{ background: d.color }}/><span>{d.label}</span><strong>{d.count}</strong></li>)}</ul>
      </div>
    </section>
    <section className="capture-area-section">
      <header><h2>Área afectada por activo</h2><span>Mayor porcentaje por foto · última inspección</span></header>
      <div className="capture-area-legend"><span><i className="corrosion"/>Corrosión</span><span><i className="crack"/>Grietas</span></div>
      <div className="capture-area-scroll">{pageAssets.map(a => <button type="button" key={a.asset.idAsset} className={`capture-area-row${selectedId === a.asset.idAsset ? " selected" : ""}`} onClick={() => onSelect(a.asset.idAsset)} aria-label={`Ver capturas de ${a.asset.name}. Corrosión: ${a.corrosion ? percent(a.corrosionArea) : "sin detecciones"}. Grietas: ${a.crack ? percent(a.crackArea) : "sin detecciones"}`}>
        <strong>{a.asset.name}</strong><div className="capture-area-pair">{[{ key: "corrosion", detected: a.corrosion, value: a.corrosionArea, label: "Corrosión" }, { key: "crack", detected: a.crack, value: a.crackArea, label: "Grietas" }].map(d => <div key={d.key} title={`${d.label}: ${d.detected ? percent(d.value) : "sin detecciones"}`}><span className="capture-area-track"><i className={d.key} style={{ width: `${d.value ?? 0}%` }}/></span><span>{d.detected ? percent(d.value) : "0%"}</span></div>)}</div>
      </button>)}</div>
      {pageCount > 1 && <nav className="capture-chart-pages" aria-label="Páginas de activos del gráfico">
        <span>{currentPage * 5 + 1}–{Math.min((currentPage + 1) * 5, affected.length)} de {affected.length}</span>
        <button type="button" aria-label="Activos anteriores" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17}/></button>
        <button type="button" aria-label="Activos siguientes" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17}/></button>
      </nav>}
      {!affected.length && <p className="capture-chart-empty">Sin hallazgos registrados.</p>}
    </section>
  </section>;
}
