import { CalendarDays, Check, ChevronDown, Plus, Search } from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";

type CrearReporteViewProps = {
  onBack: () => void;
};

const reportSteps = [
  { number: "1", title: "Datos base", subtitle: "Mision y activo", active: true },
  { number: "2", title: "Hallazgos", subtitle: "Seleccionar evidencia" },
  { number: "3", title: "Observaciones", subtitle: "Comentarios tecnicos" },
  { number: "4", title: "Generar", subtitle: "Vista previa y envio" }
];

const selectedStats = [
  { label: "Hallazgos", value: "14", tone: "blue", icon: <Check size={18} /> },
  { label: "Criticos", value: "2", tone: "red", icon: <span aria-hidden="true">!</span> },
  { label: "Duracion", value: "18 min", tone: "amber", icon: <CalendarDays size={18} /> },
  { label: "Evidencias", value: "32", tone: "green", icon: <Search size={18} /> }
];

const findings = [
  { id: "H-001", type: "Corrosion", severity: "Critico", location: "Cara Norte - Nivel 1", evidence: "3 fotos" },
  { id: "H-002", type: "Grieta", severity: "Critico", location: "Cara Este - Nivel 2", evidence: "2 fotos" },
  { id: "H-003", type: "Corrosion", severity: "Alto", location: "Cara Norte - Nivel 2", evidence: "4 fotos" }
];

export function CrearReporteView({ onBack }: CrearReporteViewProps) {
  return (
    <section className="create-report-dashboard">
      <header className="create-report-topbar">
        <div>
          <h1>Crear Reporte</h1>
          <p>Crear el reporte de una mision realizada</p>
        </div>
        <AppTopActions />
      </header>

      <section className="create-report-stepper" aria-label="Pasos para crear reporte">
        {reportSteps.map((step, index) => (
          <div className="create-report-step" key={step.number}>
            <span className={step.active ? "active" : undefined}>{step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.subtitle}</small>
            </div>
            {index < reportSteps.length - 1 && <i aria-hidden="true" />}
          </div>
        ))}
      </section>

      <div className="create-report-grid">
        <section className="create-report-card report-data-card">
          <h2>Datos del reporte</h2>
          <p>Completa los datos minimos para armar el documento.</p>
          <div className="report-data-form">
            <Field label="Mision inspeccionada" value="MIS-2025-031  Silo Norte" select />
            <Field label="Activo" value="Silo Norte" select />
            <Field label="Nombre del reporte" value="Inspeccion Silo Norte - REP-2025-025" wide />
            <Field label="Inspector responsable" value="Camila Solimano" select />
            <Field label="Fecha del reporte" value="30/06/2026" calendar />
          </div>
        </section>

        <section className="create-report-card mission-selected-card">
          <header>
            <h2>Mision seleccionada</h2>
            <span>Finalizada</span>
          </header>
          <div className="selected-stat-grid">
            {selectedStats.map((stat) => (
              <article className="selected-stat" key={stat.label}>
                <span className={stat.tone}>{stat.icon}</span>
                <div>
                  <small>{stat.label}</small>
                  <strong>{stat.value}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="create-report-card included-findings-card">
          <h2>Hallazgos incluidos</h2>
          <div className="included-findings-table">
            <div className="included-findings-head">
              <span>ID</span>
              <span>Tipo</span>
              <span>Severidad</span>
              <span>Ubicacion</span>
              <span>Evidencia</span>
            </div>
            {findings.map((finding) => (
              <div className="included-finding-row" key={finding.id}>
                <span className="finding-check"><Check size={13} /></span>
                <strong>{finding.id}</strong>
                <span>{finding.type}</span>
                <span className={`finding-pill ${finding.severity === "Critico" ? "critical" : "high"}`}>{finding.severity}</span>
                <span>{finding.location}</span>
                <button type="button">{finding.evidence}</button>
              </div>
            ))}
          </div>
        </section>

        <section className="create-report-card report-options-card">
          <h2>Observaciones y configuracion</h2>
          <div className="report-options-content">
            <textarea placeholder="Agregar observaciones generales para el reporte..." />
            <div className="report-check-options">
              <label>
                <input defaultChecked type="checkbox" />
                <span>Incluir imagenes de evidencia</span>
              </label>
              <label>
                <input defaultChecked type="checkbox" />
                <span>Incluir firma del inspector</span>
              </label>
            </div>
          </div>
        </section>

        <section className="create-report-card preview-generation-card">
          <div>
            <h2>Vista previa y generacion</h2>
            <p>El reporte quedara en estado Generado y podra validarse antes de exportar.</p>
            <div className="preview-actions">
              <button className="secondary" onClick={onBack} type="button">Guardar borrador</button>
              <button className="primary" type="button">
                <Plus size={14} />
                Generar reporte
              </button>
            </div>
          </div>
          <div className="report-preview-mini" aria-label="Vista previa del reporte">
            <strong>REP-2025-025</strong>
            <span />
            <span />
            <i />
          </div>
        </section>
      </div>
    </section>
  );
}

function Field({ calendar, label, select, value, wide }: { calendar?: boolean; label: string; select?: boolean; value: string; wide?: boolean }) {
  return (
    <label className={wide ? "report-form-field wide" : "report-form-field"}>
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        {select && <ChevronDown size={14} />}
        {calendar && <CalendarDays size={18} />}
      </div>
    </label>
  );
}
