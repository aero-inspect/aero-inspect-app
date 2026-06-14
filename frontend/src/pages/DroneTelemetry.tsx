import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Battery,
  Bell,
  Check,
  CheckCircle2,
  Gauge,
  Home,
  Map,
  Mountain,
  Pause,
  Play,
  Radio,
  Route,
  Satellite,
  ShieldCheck,
  Sun,
  Thermometer,
  UserRound,
  Wind
} from "lucide-react";

export function DroneTelemetryView({
  droneConnected,
  setDroneConnected,
  battery,
  setBattery
}: {
  onBack: () => void;
  droneConnected: boolean;
  setDroneConnected: Dispatch<SetStateAction<boolean>>;
  battery: number | null;
  setBattery: Dispatch<SetStateAction<number | null>>;
}) {
  useEffect(() => {
    let interval: number | undefined;

    if (droneConnected) {
      if (battery === null) setBattery(98);
      interval = window.setInterval(() => {
        setBattery((current) => {
          if (current === null) return 98;
          const next = Math.max(0, current - 1);
          if (next === 0) {
            setDroneConnected(false);
            return 0;
          }
          return next;
        });
      }, 6000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [battery, droneConnected, setBattery, setDroneConnected]);

  const batteryLevel = battery ?? 0;
  const connected = droneConnected && batteryLevel > 0;

  return (
    <section className="drones-dashboard">
      <header className="drones-topbar">
        <div>
          <h1>Drones</h1>
          <p>Monitorea el estado, la telemetria y el historial de tu dron.</p>
        </div>
        <div className="drones-top-actions">
          <div className="drones-weather">
            <Sun size={31} />
            <div>
              <strong>23°C</strong>
              <span>Parcialmente nublado</span>
            </div>
          </div>
          <button className="tech-notification-button" type="button" aria-label="Notificaciones">
            <Bell size={20} />
            <span>3</span>
          </button>
          <button className="tech-user-button" type="button" aria-label="Perfil">
            <UserRound size={21} />
          </button>
        </div>
      </header>

      <section className="drones-layout">
        <div className="drones-main-column">
          <article className="drone-status-card">
            <div className="drone-card-header">
              <h2>Estado del dron</h2>
              <button type="button">
                <Map size={15} />
                Ver en mapa
              </button>
            </div>

            <div className="drone-status-content">
              <div className="drone-status-info">
                <p className={connected ? "drone-connection online" : "drone-connection offline"}>
                  <span />
                  {connected ? "Conectado" : "Desconectado"}
                </p>
                <small>Ultima conexion: hace 1 min</small>
                <h3>AeroDrone 01</h3>
                <p className="drone-model">Modelo: DJI Matrice 300 RTK</p>

                <div className="drone-battery-panel">
                  <Battery size={34} />
                  <div>
                    <strong>{batteryLevel || 0}%</strong>
                    <span>Bateria</span>
                  </div>
                  <small>Tiempo restante estimado</small>
                  <b>{connected ? "28 min" : "0 min"}</b>
                </div>
              </div>

              <div className="drones-hero-photo">
                <img src="https://images.unsplash.com/photo-1508444845599-5c89863b1c44?w=760&h=360&fit=crop&auto=format" alt="AeroDrone 01" />
              </div>
            </div>

            <div className="drone-status-footer">
              <DroneFooterItem label="Piloto asignado" value="Emilia Andersen" />
              <DroneFooterItem label="Ubicacion actual" value="Plataforma de despegue" />
              <div className="drone-systems-row">
                <DroneSystem label="GPS" value="Conectado" />
                <DroneSystem label="Senal" value="Fuerte" />
                <DroneSystem label="Estado" value="Listo" />
                <DroneSystem label="Sensores" value="OK" />
              </div>
            </div>
          </article>

          <article className="drone-current-mission">
            <div className="drone-card-header">
              <h2>Mision actual</h2>
              <span>En progreso</span>
            </div>
            <div className="current-mission-grid">
              <div className="current-mission-summary">
                <strong>Inspeccion Cinta Transportadora 2</strong>
                <small>MIS-2025-002</small>
                <div className="mission-progress-line">
                  <div>
                    <p>Progreso de la mision</p>
                    <b>40%</b>
                  </div>
                  <span><i /></span>
                </div>
              </div>
              <div className="current-mission-stats">
                <MissionStat label="Tiempo de vuelo" value="12:45" />
                <MissionStat label="Distancia recorrida" value="1.2 km" />
                <MissionStat label="Puntos capturados" value="86 / 210" />
                <MissionStat label="Inicio de mision" value="11:15" />
              </div>
              <div className="next-route-point">
                <img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=180&h=120&fit=crop" alt="Siguiente punto de ruta" />
                <div>
                  <p>Siguiente punto de ruta</p>
                  <strong>Punto 4</strong>
                  <span>Altitud: 50 m</span>
                  <span>Distancia: 125 m</span>
                </div>
                <button type="button">Ver ruta completa</button>
              </div>
            </div>
          </article>
        </div>

        <aside className="drones-side-column">
          <article className="drone-panel">
            <div className="drone-card-header">
              <h2>Telemetria en tiempo real</h2>
              <button className="link-button" type="button">Ver detalles</button>
            </div>
            <div className="telemetry-grid-live">
              <TelemetryItem icon={<Mountain size={20} />} label="Altitud" value="48 m" />
              <TelemetryItem icon={<Gauge size={20} />} label="Velocidad" value="14.2 m/s" />
              <TelemetryItem icon={<Route size={20} />} label="Distancia al punto" value="125 m" />
              <TelemetryItem icon={<Satellite size={20} />} label="Satelites GPS" value="18" />
              <TelemetryItem icon={<Thermometer size={20} />} label="Temperatura" value="34 °C" />
              <TelemetryItem icon={<Wind size={20} />} label="Viento" value="12 km/h NE" />
            </div>
          </article>

          <article className="drone-panel">
            <h2>Acciones rapidas</h2>
            <div className="drone-actions-grid">
              <button className="drone-action primary" type="button">
                <Play size={15} />
                Despegar
              </button>
              <button className="drone-action neutral" type="button">
                <Pause size={15} />
                Pausar mision
              </button>
              <button className="drone-action neutral" type="button">
                <Home size={15} />
                Regresar a base
              </button>
              <button className="drone-action danger" type="button">Aterrizar</button>
            </div>
          </article>

          <article className="drone-panel preflight-panel">
            <div className="drone-card-header">
              <h2>Chequeos prevuelo</h2>
              <button className="link-button" type="button">Ver checklist</button>
            </div>
            {["Bateria", "Helices", "Camara y gimbal", "Sensores", "Senal y GPS"].map((item) => (
              <div className="preflight-row" key={item}>
                <Check size={15} />
                <span>{item}</span>
                <strong>OK</strong>
              </div>
            ))}
            <div className="drone-ready-box">
              <ShieldCheck size={25} />
              <div>
                <strong>Dron listo para operar</strong>
                <span>Todos los sistemas funcionan correctamente.</span>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <article className="maintenance-banner">
        <ShieldCheck size={22} />
        <div>
          <strong>Mantenimiento preventivo</strong>
          <span>Proximo mantenimiento programado: 10/06/2025 o en 15 horas de vuelo</span>
        </div>
        <button type="button">Ver plan de mantenimiento</button>
      </article>
    </section>
  );
}

function DroneFooterItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="drone-footer-item">
      <UserRound size={18} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DroneSystem({ label, value }: { label: string; value: string }) {
  return (
    <div className="drone-system">
      <CheckCircle2 size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TelemetryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="telemetry-live-item">
      {icon}
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
