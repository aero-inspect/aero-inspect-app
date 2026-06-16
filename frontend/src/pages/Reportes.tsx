import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Download, Eye, FileDown, FileText, Search, Trash2, ClipboardCheck, AlertTriangle } from "lucide-react";
import type { Asset } from "../types";
import { AppTopActions } from "../components/AppTopActions";

type ReportStatus = "Completado" | "En revision";

type MockReport = {
  id: string;
  title: string;
  assetName: string;
  date: string;
  time: string;
  missions: number;
  findings: number;
  critical: number;
  status: ReportStatus;
};

const MOCK_REPORTS: MockReport[] = [
  { id: "REP-2025-024", title: "Inspeccion Silo Norte", assetName: "Silo Norte", date: "2025-05-28", time: "09:45", missions: 1, findings: 12, critical: 2, status: "Completado" },
  { id: "REP-2025-023", title: "Inspeccion Cinta Transportadora 2", assetName: "Cinta Transportadora 2", date: "2025-05-28", time: "11:30", missions: 1, findings: 8, critical: 1, status: "Completado" },
  { id: "REP-2025-022", title: "Inspeccion Noria Principal", assetName: "Noria Principal", date: "2025-05-27", time: "16:20", missions: 1, findings: 15, critical: 3, status: "En revision" },
  { id: "REP-2025-021", title: "Inspeccion Tuberia de Vapor", assetName: "Tuberia de Vapor", date: "2025-05-27", time: "14:15", missions: 1, findings: 6, critical: 0, status: "Completado" },
  { id: "REP-2025-020", title: "Inspeccion Techo Almacen 2", assetName: "Techo Almacen 2", date: "2025-05-26", time: "10:50", missions: 1, findings: 5, critical: 0, status: "Completado" }
];

const FINDING_TYPES = [
  { label: "Corrosion", value: 22 },
  { label: "Grietas", value: 14 },
  { label: "Deformaciones", value: 8 },
  { label: "Acumulacion de polvo", value: 7 },
  { label: "Otros", value: 2 }
];

export function ReportesView({ assets }: { assets: Asset[] }) {
  const [startDate, setStartDate] = useState("2025-05-01");
  const [endDate, setEndDate] = useState("2025-05-28");
  const [assetFilter, setAssetFilter] = useState("Todos los activos");
  const [statusFilter, setStatusFilter] = useState<"Todos los estados" | ReportStatus>("Todos los estados");
  const [searchTerm, setSearchTerm] = useState("");

  const assetOptions = useMemo(() => {
    const names = assets.map((asset) => asset.name);
    const mockNames = MOCK_REPORTS.map((report) => report.assetName);
    return Array.from(new Set([...names, ...mockNames]));
  }, [assets]);

  const filteredReports = MOCK_REPORTS.filter((report) => {
    const matchesAsset = assetFilter === "Todos los activos" || report.assetName === assetFilter;
    const matchesStatus = statusFilter === "Todos los estados" || report.status === statusFilter;
    const matchesSearch = !searchTerm.trim() || `${report.title} ${report.assetName} ${report.id}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = report.date >= startDate && report.date <= endDate;
    return matchesAsset && matchesStatus && matchesSearch && matchesDate;
  });

  return (
    <section className="reports-dashboard">
      <header className="reports-topbar">
        <div>
          <h1>Reportes</h1>
          <p>Descarga reportes de inspecciones y hallazgos.</p>
        </div>

        <AppTopActions />
      </header>

      <section className="reports-stats">
        <ReportMetric icon={<FileText size={20} />} label="Reportes generados" tone="green" value="24" />
        <ReportMetric icon={<ClipboardCheck size={20} />} label="Hallazgos detectados" tone="amber" value="58" />
        <ReportMetric icon={<AlertTriangle size={20} />} label="Hallazgos criticos" tone="red" value="7" />
        <ReportMetric icon={<CalendarDays size={20} />} label="Misiones inspeccionadas" tone="blue" value="18" />
      </section>

      <section className="reports-filters">
        <label className="reports-date-filter">
          <span>Desde</span>
          <input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </label>
        <label className="reports-date-filter">
          <span>Hasta</span>
          <input onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>
        <label className="reports-select-filter">
          <select onChange={(event) => setAssetFilter(event.target.value)} value={assetFilter}>
            <option>Todos los activos</option>
            {assetOptions.map((assetName) => (
              <option key={assetName}>{assetName}</option>
            ))}
          </select>
        </label>
        <label className="reports-select-filter">
          <select onChange={(event) => setStatusFilter(event.target.value as "Todos los estados" | ReportStatus)} value={statusFilter}>
            <option>Todos los estados</option>
            <option>Completado</option>
            <option>En revision</option>
          </select>
        </label>
        <label className="reports-search">
          <Search size={14} />
          <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar reporte..." value={searchTerm} />
        </label>
        <button className="reports-export-button" type="button">
          <FileDown size={15} />
          Exportar
        </button>
      </section>

      <section className="reports-analytics">
        <article className="reports-card severity-card">
          <h2>Hallazgos por severidad</h2>
          <div className="severity-content">
            <div className="severity-donut">
              <strong>58</strong>
              <span>Total</span>
            </div>
            <div className="severity-legend">
              <ReportLegend color="#ef4444" label="Criticos" value="7 (12%)" />
              <ReportLegend color="#f97316" label="Altos" value="16 (28%)" />
              <ReportLegend color="#facc15" label="Medios" value="20 (34%)" />
              <ReportLegend color="#22c55e" label="Bajos" value="15 (26%)" />
            </div>
          </div>
        </article>

        <article className="reports-card finding-type-card">
          <h2>Hallazgos por tipo</h2>
          <div className="finding-bars">
            {FINDING_TYPES.map((finding) => (
              <div className="finding-row" key={finding.label}>
                <span>{finding.label}</span>
                <div>
                  <i style={{ width: `${(finding.value / 22) * 100}%` }} />
                </div>
                <strong>{finding.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="reports-card reports-table-card">
        <div className="reports-table-header">
          <h2>Todos los reportes</h2>
          <span>Mostrando {filteredReports.length} de {MOCK_REPORTS.length} reportes</span>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Reporte</th>
                <th>Activo</th>
                <th>Fecha</th>
                <th>Misiones</th>
                <th>Hallazgos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div className="report-name-cell">
                      <span><FileText size={15} /></span>
                      <div>
                        <strong>{report.title}</strong>
                        <small>{report.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{report.assetName}</td>
                  <td>{formatDate(report.date)}<small>{report.time}</small></td>
                  <td>{report.missions}</td>
                  <td>{report.findings} <small>{report.critical} criticos</small></td>
                  <td><span className={`report-status ${report.status === "Completado" ? "done" : "review"}`}>{report.status}</span></td>
                  <td>
                    <div className="report-actions">
                      <button type="button" aria-label="Ver reporte"><Eye size={14} /></button>
                      <button type="button" aria-label="Descargar reporte"><Download size={14} /></button>
                      <button type="button" aria-label="Eliminar reporte"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ReportMetric({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: "green" | "amber" | "red" | "blue"; value: string }) {
  return (
    <article className="report-metric">
      <span className={`report-metric-icon ${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function ReportLegend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="severity-legend-row">
      <span style={{ background: color }} />
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

