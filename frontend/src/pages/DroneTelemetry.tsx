import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Battery,
  Check,
  Gauge,
  Home,
  Map,
  Mountain,
  Pause,
  PlaneLanding,
  PlaneTakeoff,
  Satellite,
  Thermometer,
  Wrench,
  Wind
} from "lucide-react";
import { AppTopActions } from "../components/AppTopActions";
import droneImage from "../assets/drone-image.png";

export function DroneTelemetryView({
  droneConnected,
  battery
}: {
  onBack: () => void;
  droneConnected: boolean;
  setDroneConnected: Dispatch<SetStateAction<boolean>>;
  battery: number | null;
  setBattery: Dispatch<SetStateAction<number | null>>;
}) {
  const isOnline = droneConnected || true;
  const batteryLevel = battery ?? 87;

  return (
    <section className="drones-dashboard">
      <header className="drones-topbar">
        <div>
          <h1>Drones</h1>
          <p>Monitorea el estado, la telemetria y el historial de tu dron.</p>
        </div>
        <AppTopActions />
      </header>

      <section className="drones-layout">
        <div className="drones-main-column">
          <article className="drone-status-card">
            <div className="drone-card-header">
              <h2>Estado del dron</h2>
              <button className="drone-map-button" type="button">Ver en mapa</button>
            </div>

            <div className="drone-status-content">
              <div className="drone-status-info">
                <p className={isOnline ? "drone-connection online" : "drone-connection offline"}>
                  <span />
                  {isOnline ? "En linea" : "Sin conexion"}
                </p>
                <small>Ultima actualizacion: hace 2 min</small>
                <h3>AeroDrone 01</h3>
                <p className="drone-model">Modelo: DJI Matrice 300 RTK</p>

                <div className="drone-battery-panel">
                  <Battery size={36} aria-hidden="true" />
                  <div className="drone-battery-value">
                    <strong>{batteryLevel}%</strong>
                    <span>Bateria</span>
                  </div>
                  <p>Tiempo restante estimado: 32 min</p>
                </div>
              </div>

              <div className="drones-hero-photo" aria-hidden="true">
                <img src={droneImage} alt="AeroDrone 01" />
              </div>
            </div>
          </article>

          <article className="drone-current-mission">
            <h2>Mision actual</h2>
            <div className="current-mission-top">
              <div className="current-mission-summary">
                <strong>Inspeccion Cinta Transportadora 2</strong>
                <small>MIS-2025-002</small>
                <div className="mission-progress-line">
                  <div>
                    <p>Progreso de la mision</p>
                    <b>60%</b>
                  </div>
                  <span><i /></span>
                </div>
              </div>
              <div className="current-mission-stats">
                <MissionStat label="Tiempo de vuelo" value="12:46" />
                <MissionStat label="Distancia recorrida" value="1.2 km" />
                <MissionStat label="Puntos capturados" value="86 / 210" />
                <MissionStat label="Inicio de mision" value="11:15" />
              </div>
            </div>

            <div className="next-route-point">
              <div className="route-preview" aria-hidden="true">
                <span />
                <i />
              </div>
              <div className="route-point-copy">
                <p>Siguiente punto de ruta</p>
                <strong>Punto 4</strong>
                <span>Altitud: 50 m</span>
                <span>Distancia: 125 m</span>
              </div>
              <button type="button">Ver ruta completa</button>
            </div>
          </article>
        </div>

        <aside className="drones-side-column">
          <article className="drone-panel telemetry-panel">
            <h2>Telemetria en tiempo real</h2>
            <div className="telemetry-grid-live">
              <TelemetryItem icon={<Mountain size={18} />} label="Altitud" value="120 m" />
              <TelemetryItem icon={<Gauge size={18} />} label="Velocidad" value="14.8 m/s" />
              <TelemetryItem icon={<Map size={18} />} label="Distancia al punto" value="350 m" />
              <TelemetryItem icon={<Satellite size={18} />} label="Satelites GPS" value="18" />
              <TelemetryItem icon={<Thermometer size={18} />} label="Temperatura" value="32 °C" />
              <TelemetryItem icon={<Wind size={18} />} label="Viento" value="15 km/h NE" />
            </div>
          </article>

          <article className="drone-panel actions-panel">
            <h2>Acciones rapidas</h2>
            <div className="drone-actions-grid">
              <button className="drone-action takeoff" type="button">
                <PlaneTakeoff size={17} />
                Despegar
              </button>
              <button className="drone-action pause" type="button">
                <Pause size={17} />
                Pausar mision
              </button>
              <button className="drone-action base" type="button">
                <Home size={17} />
                Regresar a base
              </button>
              <button className="drone-action land" type="button">
                <PlaneLanding size={17} />
                Aterrizar
              </button>
            </div>
          </article>

          <article className="drone-panel preflight-panel">
            <h2>Chequeos prevuelo</h2>
            <div className="preflight-content">
              <div className="preflight-list">
                {[
                  "Bateria",
                  "Helices",
                  "Camara",
                  "Sensores",
                  "Senal y GPS"
                ].map((item) => (
                  <div className="preflight-row" key={item}>
                    <Check size={14} />
                    <span>{item}</span>
                    <strong>OK</strong>
                  </div>
                ))}
              </div>
              <div className="drone-ready-box">
                <Check size={16} />
                <strong>Dron listo para operar</strong>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <article className="maintenance-banner">
        <span className="maintenance-icon" aria-hidden="true">
          <Check size={16} />
        </span>
        <div>
          <strong>Mantenimiento preventivo</strong>
          <span>Proximo mantenimiento programado: 10/06/2025 o en 15 horas de vuelo</span>
        </div>
        <button type="button">
          <Wrench size={15} />
          Ver plan de mantenimiento
        </button>
      </article>
    </section>
  );
}

function TelemetryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="telemetry-live-item">
      <span className="telemetry-icon" aria-hidden="true">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function MissionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mission-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
