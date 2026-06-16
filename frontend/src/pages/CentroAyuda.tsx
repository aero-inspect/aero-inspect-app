import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  GraduationCap,
  Lightbulb,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  Timer,
  Wrench
} from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";

const HELP_STATS = [
  { icon: <Phone size={20} />, label: "Soporte", value: "Disponible", detail: "24/7", tone: "green" },
  { icon: <MessageCircle size={20} />, label: "Chat", value: "Tiempo prom.", detail: "5 min", tone: "green" },
  { icon: <BookOpen size={20} />, label: "Guias", value: "18 articulos", detail: "Operativas", tone: "blue" },
  { icon: <GraduationCap size={20} />, label: "Tutorial", value: "Primer uso", detail: "Paso a paso", tone: "amber" }
];

const FAQS = [
  {
    title: "Como crear una mision?",
    body: "Ingresá a Misiones, seleccioná Nueva mision, elegí un activo y marcá los puntos de inspeccion sobre el mapa."
  },
  {
    title: "Como registrar un activo?",
    body: "Desde Activos, usá Nuevo activo, completá nombre, tipo, estado, fotos y seleccioná su ubicacion exacta en el mapa."
  },
  {
    title: "Como conectar un dron?",
    body: "Verificá bateria, GPS y señal en Drones. Cuando el estado sea operativo, la plataforma habilita la telemetria."
  },
  {
    title: "Como generar un reporte?",
    body: "En Reportes podés filtrar por activo, estado y fecha. Por ahora los botones Ver, Descargar y Exportar quedan mockup."
  },
  {
    title: "Que significan los estados?",
    body: "Operativo indica disponible; Mantenimiento requiere revision; Fuera de servicio bloquea su uso para inspecciones."
  }
];

const QUICK_GUIDES = [
  "Registrar un nuevo activo",
  "Configurar una mision",
  "Ejecutar una inspeccion",
  "Analizar hallazgos IA",
  "Exportar reportes"
];

const SYSTEM_ITEMS = ["Plataforma", "Servicios IA", "Mapa satelital", "Base de datos"];

export function CentroAyudaView() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <section className="help-dashboard">
      <header className="assets-dashboard-header help-header">
        <div>
          <h1>Centro de ayuda</h1>
          <p>Soporte tecnico, documentacion y asistencia operativa.</p>
        </div>
        <AppTopActions />
      </header>

      <section className="help-stats-row" aria-label="Resumen de soporte">
        {HELP_STATS.map((item) => (
          <article className="help-stat-card" key={item.label}>
            <span className={`help-stat-icon ${item.tone}`}>{item.icon}</span>
            <div>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <span>{item.detail}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="help-main-layout">
        <div className="help-left-column">
          <article className="help-card">
            <div className="help-card-heading">
              <h2>Preguntas frecuentes</h2>
              <span>Operacion diaria</span>
            </div>
            <div className="help-faq-list">
              {FAQS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div className={isOpen ? "help-faq-item open" : "help-faq-item"} key={faq.title}>
                    <button onClick={() => setOpenFaq(isOpen ? -1 : index)} type="button">
                      <span>{faq.title}</span>
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    {isOpen && <p>{faq.body}</p>}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="help-card">
            <div className="help-card-heading">
              <h2>Guias rapidas</h2>
              <span>Tutoriales operativos</span>
            </div>
            <div className="help-guide-grid">
              {QUICK_GUIDES.map((guide) => (
                <button className="help-guide-card" key={guide} type="button">
                  <span>
                    <BookOpen size={17} aria-hidden="true" />
                  </span>
                  <strong>{guide}</strong>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </article>
        </div>

        <aside className="help-right-column">
          <article className="help-card support-card">
            <h2>Contactar soporte</h2>
            <div className="support-brand">
              <Wrench size={18} aria-hidden="true" />
              <strong>Soporte AeroInspect</strong>
            </div>
            <HelpContact icon={<Mail size={16} />} label="soporte@aeroinspect.com" />
            <HelpContact icon={<Phone size={16} />} label="+54 11 5555 5555" />
            <HelpContact icon={<Timer size={16} />} label="Lunes a Viernes 08:00 - 18:00" />
            <button className="help-primary-button" type="button">
              <Send size={15} aria-hidden="true" />
              Contactar soporte
            </button>
          </article>

          <article className="help-card quick-actions-card">
            <h2>Acciones rapidas</h2>
            <button type="button">
              <Bug size={16} aria-hidden="true" />
              Reportar problema
            </button>
            <button type="button">
              <Lightbulb size={16} aria-hidden="true" />
              Sugerir mejora
            </button>
            <button type="button">
              <FileText size={16} aria-hidden="true" />
              Ver documentacion
            </button>
            <button type="button">
              <Download size={16} aria-hidden="true" />
              Descargar manual PDF
            </button>
          </article>
        </aside>
      </section>
    </section>
  );
}

function HelpContact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="help-contact-item">
      <span>{icon}</span>
      <p>{label}</p>
    </div>
  );
}

