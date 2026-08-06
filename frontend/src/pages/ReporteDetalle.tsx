import { BarChart3, Check, Download, Share2, Trash2, RotateCcw } from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";

type ReporteDetalleViewProps = {
  onBack: () => void;
};

const generalData = [
  ["Activo inspeccionado", "Silo Norte"],
  ["Ubicacion", "Area de Silos"],
  ["Fecha de inspeccion", "28/05/2025"],
  ["Mision", "MIS-2025-031"],
  ["Inspector", "Camila Solimano"]
];

const operationData = [
  ["Dron utilizado", "Drone 01"],
  ["Duracion de mision", "18 min"],
  ["Condiciones climaticas", "Despejado - 0 C"],
  ["Tipo de inspeccion", "Programada"],
  ["Estado del reporte", "Pendiente"]
];

const findings = [
  { id: "H-001", type: "Corrosion", severity: "Critico", desc: "Corrosion avanzada en union de placa inferior. Perdida de material.", place: "Cara Norte - Nivel 1", thumbs: 1 },
  { id: "H-002", type: "Grieta", severity: "Critico", desc: "Grieta longitudinal de 15 cm en costura vertical.", place: "Cara Este - Nivel 2", thumbs: 2 },
  { id: "H-003", type: "Corrosion", severity: "Alto", desc: "Corrosion moderada en soporte lateral.", place: "Cara Norte - Nivel 2", thumbs: 3 },
  { id: "H-004", type: "Acumulacion", severity: "Medio", desc: "Acumulacion de polvo en respiradero superior.", place: "Tapa superior", thumbs: 2 },
  { id: "H-005", type: "Corrosion", severity: "Bajo", desc: "Oxidacion leve en baranda de acceso.", place: "Plataforma - Nivel 3", thumbs: 2 }
];

const summary = [
  { label: "Totales", value: "14", tone: "total" },
  { label: "Criticos", value: "2", tone: "critical" },
  { label: "Medios", value: "5", tone: "medium" },
  { label: "Bajos", value: "3", tone: "low" }
];

const approvalSteps = [
  { title: "Inspeccion finalizada", subtitle: "28/05 - 09:12", done: true },
  { title: "Reporte generado", subtitle: "28/05 - 09:30", done: true },
  { title: "Validacion tecnica", subtitle: "", warning: true },
  { title: "Listo para exportar", subtitle: "", warning: true }
];

export function ReporteDetalleView({ onBack }: ReporteDetalleViewProps) {
  return (
    <section className="report-detail-dashboard">
      <header className="report-detail-topbar">
        <div>
          <h1>Reportes</h1>
          <p>Visualizacion de reportes de tus misiones.</p>
        </div>
        <AppTopActions />
      </header>

      <div className="report-detail-body">
        <section className="report-detail-hero">
          <div className="report-hero-title">
            <span><BarChart3 size={25} /></span>
            <div>
              <h2>Reporte de inspeccion</h2>
              <p>REP-2025-024</p>
            </div>
          </div>
          <div className="report-hero-meta">
            <small>Fecha del reporte</small>
            <strong>28/05/2025</strong>
            <small>Hora</small>
            <strong>09:30</strong>
          </div>
          <div className="report-hero-actions">
            <button className="report-asset-link" onClick={onBack} type="button">Ver activo inspeccionado</button>
            <div>
              <button type="button" aria-label="Eliminar reporte"><Trash2 size={15} /></button>
              <button type="button" aria-label="Descargar reporte"><Download size={15} /></button>
              <button type="button" aria-label="Compartir reporte"><Share2 size={15} /></button>
            </div>
          </div>
        </section>

        <section className="report-detail-card detail-info-card">
          <h2>Datos generales</h2>
          <InfoList items={generalData} />
        </section>

        <section className="report-detail-card detail-info-card">
          <h2>Operacion y condiciones</h2>
          <InfoList items={operationData} highlightLast />
        </section>

        <section className="report-detail-card report-summary-card">
          <h2>Resumen</h2>
          <div className="report-summary-grid">
            {summary.map((item) => (
              <article className={`summary-box ${item.tone}`} key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="report-detail-card detected-findings-card">
          <h2>Hallazgos detectados</h2>
          <div className="detected-table">
            <div className="detected-head">
              <span>ID</span>
              <span>Tipo</span>
              <span>Severidad</span>
              <span>Descripcion</span>
              <span>Ubicacion</span>
              <span>Evidencia</span>
            </div>
            {findings.map((finding) => (
              <div className="detected-row" key={finding.id}>
                <strong>{finding.id}</strong>
                <span>{finding.type}</span>
                <span className={`detail-severity-pill ${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                <p>{finding.desc}</p>
                <span>{finding.place}</span>
                <div className="evidence-thumbs">
                  {Array.from({ length: finding.thumbs }).map((_, index) => <i key={index} />)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="report-detail-card validation-card">
          <h2>Validacion tecnica</h2>
          <label>
            <span>Comentarios del validador</span>
            <textarea placeholder="Agregar observaciones, correcciones o aprobacion tecnica..." />
          </label>
          <div className="signature-row">
            <span>Firma digital</span>
            <div className="signature-box" />
            <button className="request-fix" type="button">
              <RotateCcw size={15} />
              Solicitar correccion
            </button>
          </div>
          <button className="validate-button" type="button">
            <Check size={15} />
            Validar
          </button>
        </section>

        <section className="report-detail-card report-flow-card">
          <h2>Estado del reporte</h2>
          <div className="report-flow-steps">
            {approvalSteps.map((step) => (
              <article className={step.done ? "done" : "warning"} key={step.title}>
                <span>{step.done ? <Check size={13} /> : "!"}</span>
                <div>
                  <strong>{step.title}</strong>
                  {step.subtitle && <small>{step.subtitle}</small>}
                </div>
                <i />
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function InfoList({ highlightLast, items }: { highlightLast?: boolean; items: string[][] }) {
  return (
    <dl className="report-info-list">
      {items.map(([label, value], index) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={highlightLast && index === items.length - 1 ? "pending" : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
