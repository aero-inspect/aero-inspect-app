import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Navigation, Clock, CheckCircle2, XCircle, Pause } from "lucide-react";
import type { InspectionMission, Asset, Plant } from "../types";
import { MissionMonitorMap } from "../components/MissionMonitorMap";

type MonitorMissionViewProps = {
  missions: InspectionMission[];
  assets: Asset[];
  plant: Plant;
  onBack: () => void;
};

export function MonitorMissionView({ missions, assets, plant, onBack }: MonitorMissionViewProps) {
  // Find active mission (En ejecución)
  const [simulatedMission, setSimulatedMission] = useState<InspectionMission | null>(null);
  const activeMission = simulatedMission || missions.find((m) => m.status === "En ejecución");
  
  // Simulated drone position (in real app, this would come from telemetry)
  const [dronePosition, setDronePosition] = useState<{ lat: number; lng: number } | null>(null);
  const [completedPoints, setCompletedPoints] = useState<number>(0);
  const [missionProgress, setMissionProgress] = useState<number>(0);

  // Function to simulate an active mission
  const startSimulation = () => {
    const centerLat = parseFloat(plant.center.latitude);
    const centerLng = parseFloat(plant.center.longitude);
    
    // Try to use existing mission first
    let missionToSimulate: InspectionMission | null = null;
    
    // 1. Try pending mission
    const pendingMission = missions.find((m) => m.status === "Pendiente");
    if (pendingMission && pendingMission.routePoints.length > 0) {
      missionToSimulate = {
        ...pendingMission,
        status: "En ejecución",
        startedAt: new Date().toISOString()
      };
    }
    // 2. Try any mission with route points
    else if (missions.length > 0) {
      const missionWithRoute = missions.find((m) => m.routePoints && m.routePoints.length > 0);
      if (missionWithRoute) {
        missionToSimulate = {
          ...missionWithRoute,
          status: "En ejecución",
          startedAt: new Date().toISOString()
        };
      }
    }
    
    // 3. Create demo mission if no suitable mission found
    if (!missionToSimulate) {
      const demoAssetName = assets.length > 0 ? assets[0].name : "Activo Demo";
      const demoAssetId = assets.length > 0 ? assets[0].id : 1;
      
      missionToSimulate = {
        id: 9999,
        name: "Misión de Demostración",
        assetId: demoAssetId,
        assetName: demoAssetName,
        status: "En ejecución",
        startedAt: new Date().toISOString(),
        routePoints: [
          { id: 1, latitude: (centerLat - 0.0002).toString(), longitude: (centerLng - 0.0002).toString() },
          { id: 2, latitude: (centerLat - 0.0001).toString(), longitude: (centerLng - 0.0002).toString() },
          { id: 3, latitude: (centerLat).toString(), longitude: (centerLng - 0.0002).toString() },
          { id: 4, latitude: (centerLat + 0.0001).toString(), longitude: (centerLng - 0.0001).toString() },
          { id: 5, latitude: (centerLat + 0.0002).toString(), longitude: (centerLng).toString() },
          { id: 6, latitude: (centerLat + 0.0001).toString(), longitude: (centerLng + 0.0001).toString() },
          { id: 7, latitude: (centerLat).toString(), longitude: (centerLng + 0.0002).toString() },
          { id: 8, latitude: (centerLat - 0.0001).toString(), longitude: (centerLng + 0.0001).toString() }
        ]
      };
    }
    
    setSimulatedMission(missionToSimulate);
    setCompletedPoints(0);
    setMissionProgress(0);
  };

  const stopSimulation = () => {
    setSimulatedMission(null);
    setCompletedPoints(0);
    setMissionProgress(0);
    setDronePosition(null);
  };

  // Simulate drone movement along the route
  useEffect(() => {
    if (!activeMission || activeMission.routePoints.length === 0) return;

    const interval = setInterval(() => {
      setCompletedPoints((prev) => {
        const next = prev + 1;
        if (next >= activeMission.routePoints.length) {
          clearInterval(interval);
          return activeMission.routePoints.length;
        }
        
        // Update drone position to current point
        const currentPoint = activeMission.routePoints[next];
        setDronePosition({
          lat: parseFloat(currentPoint.latitude),
          lng: parseFloat(currentPoint.longitude)
        });
        
        // Update progress percentage
        const progress = Math.round((next / activeMission.routePoints.length) * 100);
        setMissionProgress(progress);
        
        return next;
      });
    }, 3000); // Move to next point every 3 seconds

    // Initialize drone at first point
    if (activeMission.routePoints.length > 0) {
      const firstPoint = activeMission.routePoints[0];
      setDronePosition({
        lat: parseFloat(firstPoint.latitude),
        lng: parseFloat(firstPoint.longitude)
      });
    }

    return () => clearInterval(interval);
  }, [activeMission]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "Finalizada":
        return <CheckCircle2 size={20} />;
      case "En ejecución":
        return <Navigation size={20} />;
      case "Pendiente":
        return <Clock size={20} />;
      default:
        return <XCircle size={20} />;
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case "Finalizada":
        return "status-completed";
      case "En ejecución":
        return "status-active";
      case "Pendiente":
        return "status-pending";
      default:
        return "status-cancelled";
    }
  };

  return (
    <section className="monitor-mission-container">
      <header className="panel-header">
        <button className="icon-button" onClick={onBack} aria-label="Volver" type="button">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h2>Monitorear Recorrido del Dron</h2>
          <p className="panel-subtitle">Seguimiento en tiempo real de la misión en ejecución</p>
        </div>
      </header>

      {!activeMission ? (
        <div className="no-active-mission">
          <div className="empty-state-icon">
            <Pause size={48} />
          </div>
          <h3>No hay misiones activas</h3>
          <p>No existe una misión en ejecución para monitorear en este momento.</p>
          <p className="hint-text">Las misiones deben estar en estado "En ejecución" para poder visualizar el recorrido del dron.</p>
          <button className="simulate-button" onClick={startSimulation} type="button">
            <Navigation size={20} />
            Simular Misión Activa
          </button>
        </div>
      ) : (
        <div className="monitor-layout">
          {/* Mission Info Panel */}
          <aside className="mission-info-panel">
            <div className="info-card">
              <div className="info-header">
                <div>
                  <h3>Información de Misión</h3>
                  {simulatedMission && (
                    <span className="simulation-badge">Simulación</span>
                  )}
                </div>
                <div className="header-actions-group">
                  <div className={`mission-status-badge ${getStatusClass(activeMission.status)}`}>
                    {getStatusIcon(activeMission.status)}
                    <span>{activeMission.status}</span>
                  </div>
                  {simulatedMission && (
                    <button className="stop-simulation-btn" onClick={stopSimulation} type="button" title="Detener simulación">
                      <XCircle size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="info-details">
                <div className="info-item">
                  <span className="info-label">Misión</span>
                  <strong>{activeMission.name}</strong>
                </div>
                <div className="info-item">
                  <span className="info-label">Activo</span>
                  <strong>{activeMission.assetName}</strong>
                </div>
                {activeMission.startedAt && (
                  <div className="info-item">
                    <span className="info-label">Inicio</span>
                    <strong>{new Date(activeMission.startedAt).toLocaleString('es-AR')}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-header">
                <h3>Progreso de Misión</h3>
                <span className="progress-percentage">{missionProgress}%</span>
              </div>
              
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${missionProgress}%` }}
                />
              </div>

              <div className="progress-stats">
                <div className="progress-stat">
                  <span className="stat-label">Puntos completados</span>
                  <strong>{completedPoints} / {activeMission.routePoints.length}</strong>
                </div>
                <div className="progress-stat">
                  <span className="stat-label">Puntos restantes</span>
                  <strong>{activeMission.routePoints.length - completedPoints}</strong>
                </div>
              </div>
            </div>

            <div className="route-legend">
              <h4>Leyenda del Mapa</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-marker planned"></div>
                  <span>Trayectoria planificada</span>
                </div>
                <div className="legend-item">
                  <div className="legend-marker completed"></div>
                  <span>Recorrido completado</span>
                </div>
                <div className="legend-item">
                  <div className="legend-marker drone"></div>
                  <span>Posición actual del dron</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Map View */}
          <div className="map-container">
            <MissionMonitorMap
              plant={plant}
              routePoints={activeMission.routePoints}
              completedPoints={completedPoints}
              dronePosition={dronePosition}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// Made with Bob
