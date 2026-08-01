import { Pause, X } from "lucide-react";
import type { ReactNode } from "react";
import type { InspectionMission, Asset, Plant, InspectionPoint } from "../types";
import { MissionMonitorMap } from "../components/MissionMonitorMap";
import { AppTopActions } from "../components/AppTopActions";
import droneImage from "../assets/drone-image.png";

type MonitorMissionViewProps = {
  missions: InspectionMission[];
  assets: Asset[];
  plant: Plant;
  onBack: () => void;
};

const DEMO_ROUTE: InspectionPoint[] = [
  { id: 1, latitude: "-35.140110", longitude: "-60.458900" },
  { id: 2, latitude: "-35.140410", longitude: "-60.458520" },
  { id: 3, latitude: "-35.140205", longitude: "-60.457920" },
  { id: 4, latitude: "-35.140760", longitude: "-60.457710" },
  { id: 5, latitude: "-35.141045", longitude: "-60.458240" },
  { id: 6, latitude: "-35.140820", longitude: "-60.458760" }
];

const telemetryRows = [
  ["Bateria", "72 %"],
  ["Altitud", "28 m"],
  ["Velocidad", "4.8 m/s"],
  ["Senal GPS", "Excelente"],
  ["Viento", "2.3 m/s"],
  ["Temperatura", `24${String.fromCharCode(176)}C`]
];

export function MonitorMissionView({ missions, assets, plant, onBack }: MonitorMissionViewProps) {
  const mission = missions.find((item) => item.status !== "Pendiente") ?? missions[0];
  const asset = mission ? assets.find((item) => item.id === mission.assetId) : assets[0];
  const routePoints = mission?.routePoints?.length ? mission.routePoints : DEMO_ROUTE;
  const dronePosition = routePoints[2]
    ? { lat: Number(routePoints[2].latitude), lng: Number(routePoints[2].longitude) }
    : null;

  return (
    <section className="monitor-mission-dashboard">
      <header className="monitor-topbar">
        <div>
          <h1>Monitorear mision</h1>
          <p>Seguimiento en vivo de las inspecciones a los activos.</p>
        </div>
        <AppTopActions />
      </header>

      <section className="monitor-body-grid">
        <article className="monitor-live-card">
          <div className="monitor-live-title">
            <h2>{mission?.name || "Inspeccion Silo Norte"}</h2>
            <span>En vivo</span>
          </div>
          <p className="monitor-map-label">MAPA SATELITAL - AREA DE PLANTA</p>

          <div className="monitor-map-frame">
            <MissionMonitorMap
              plant={plant}
              routePoints={routePoints}
              completedPoints={3}
              dronePosition={dronePosition}
            />
          </div>

          <div className="monitor-main-actions">
            <button className="monitor-pause" type="button">
              <Pause size={17} />
              Pausar
            </button>
            <button className="monitor-cancel" type="button" onClick={onBack}>
              <X size={17} />
              Cancelar
            </button>
          </div>
        </article>

        <aside className="monitor-side-column">
          <article className="monitor-side-card monitor-progress-card">
            <h2>Progreso de mision</h2>
            <strong>Punto 3 de {routePoints.length}</strong>
            <div className="monitor-progress-track"><span /></div>
            <p>58% completado</p>
            <ProgressLine label="Tiempo transcurrido" value="00:08:00" />
            <ProgressLine label="Tiempo restante estimado" value="00:11:15" />
          </article>

          <article className="monitor-side-card monitor-telemetry-card">
            <h2>Telemetria</h2>
            <div className="monitor-telemetry-list">
              {telemetryRows.map(([label, value]) => (
                <ProgressLine key={label} label={label} value={value} />
              ))}
            </div>
          </article>

          <article className="monitor-side-card monitor-captures-card">
            <h2>Capturas recientes</h2>
            <div className="monitor-capture-row">
              {[1, 2, 3].map((item) => (
                <div className="monitor-capture" key={item}>
                  <img src={droneImage} alt={`Captura ${item}`} />
                  <span />
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
}

function ProgressLine({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="monitor-data-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
