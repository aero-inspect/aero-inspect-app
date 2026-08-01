import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  FileText,
  Headphones,
  Mail,
  Phone,
  Route,
  ScrollText
} from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";

const FAQS = [
  {
    title: "¿Cómo configuro una nueva misión?",
    body: "Ingresa en Misiones, selecciona Nueva misión, elige un activo y marca los puntos del recorrido sobre el mapa. Luego define los parámetros de vuelo y guarda.",
    link: "Ver guía completa"
  },
  {
    title: "¿Cómo descargo un reporte?",
    body: "Desde Reportes, selecciona el informe requerido y usa la acción Descargar para guardarlo en tu equipo.",
    link: "Ver guía completa"
  },
  {
    title: "¿Cómo conecto el dron?",
    body: "Verifica batería, GPS y señal desde Drones. Cuando el estado sea operativo, la plataforma habilita la conexión.",
    link: "Ver guía completa"
  }
];

const GUIDES = [
  {
    icon: <Route size={24} />,
    title: "Primeros pasos",
    detail: "Conoce las funciones básicas de la plataforma."
  },
  {
    icon: <ScrollText size={24} />,
    title: "Planificar misión",
    detail: "Aprende a crear y configurar misiones de inspección."
  },
  {
    icon: <BookOpen size={24} />,
    title: "Interpretar hallazgos",
    detail: "Entiende los reportes y los tipos de hallazgos."
  },
  {
    icon: <BarChart3 size={24} />,
    title: "Generar reportes",
    detail: "Aprende a generar y descargar reportes."
  }
];

const QUICK_ACTIONS = [
  { icon: <AlertTriangle size={22} />, label: "Reportar un problema" },
  { icon: <BookOpen size={22} />, label: "Solicitar capacitación" },
  { icon: <FileText size={22} />, label: "Consultar estado del servicio" },
  { icon: <Download size={24} />, label: "Descargar manual de usuario" }
];

export function CentroAyudaView() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <section className="help-dashboard">
      <header className="help-header">
        <div>
          <h1>Centro de Ayuda</h1>
          <p>Encuentra respuestas, guias y canales de soporte.</p>
        </div>
        <AppTopActions />
      </header>

      <div className="help-center-body">
        <main className="help-left-column">
          <section className="help-card help-faq-card">
            <h2>Preguntas frecuentes</h2>
            <div className="help-faq-list">
              {FAQS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <article className={isOpen ? "help-faq-item open" : "help-faq-item"} key={faq.title}>
                    <button onClick={() => setOpenFaq(isOpen ? -1 : index)} type="button">
                      <span>{faq.title}</span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <div className="help-faq-answer">
                        <p>{faq.body}</p>
                        <a href="#" onClick={(event) => event.preventDefault()}>{faq.link} ›</a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="help-card help-guides-card">
            <h2>Guías rápidas</h2>
            <div className="help-guide-grid">
              {GUIDES.map((guide) => (
                <article className="help-guide-card" key={guide.title}>
                  <span>{guide.icon}</span>
                  <h3>{guide.title}</h3>
                  <p>{guide.detail}</p>
                  <a href="#" onClick={(event) => event.preventDefault()}>Ver guía ›</a>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="help-right-column">
          <section className="help-card help-support-card">
            <div className="help-support-icon">
              <Headphones size={30} aria-hidden="true" />
            </div>
            <div className="help-support-copy">
              <h2>Contactar soporte</h2>
              <p>Nuestro equipo está disponible para ayudarte con incidencias técnicas.</p>
              <HelpContact icon={<Mail size={21} />} label="soporte@aeroinspect.com" />
              <HelpContact icon={<Phone size={21} />} label="+54 11 5555 0100" />
              <button className="help-primary-button" type="button">
                <ArrowUpRight size={18} aria-hidden="true" />
                Enviar consulta
              </button>
            </div>
          </section>

          <section className="help-card help-actions-card">
            <h2>Acciones rápidas</h2>
            <div className="help-actions-list">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} type="button">
                  <span>{action.icon}</span>
                  <strong>{action.label}</strong>
                  <ChevronRight size={24} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="help-final-banner">
          <span>
            <CircleHelp size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>¿No encontraste lo que buscabas?</h2>
            <p>Nuestro equipo está listo para ayudarte. Contáctanos y te responderemos a la brevedad.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

function HelpContact({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="help-contact-item">
      <span>{icon}</span>
      <p>{label}</p>
    </div>
  );
}
