import { useState, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft } from "lucide-react";
import type { Asset, InspectionMission, Plant } from "../types";
import { MissionRouteMap } from "../components/MissionRouteMap";

export function LaunchMissionView({
  missions,
  assets,
  droneConnected,
  battery,
  setMissions,
  onBack,
  plant
}: {
  missions: InspectionMission[];
  assets: Asset[];
  droneConnected: boolean;
  battery: number | null;
  setMissions: Dispatch<SetStateAction<InspectionMission[]>>;
  onBack: () => void;
  plant: Plant;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const plantAssetIds = assets.filter((a) => a.plantId === plant.id).map((a) => a.id);
  const plantMissions = missions.filter((m) => plantAssetIds.includes(m.assetId));
  const selectedMission = plantMissions.find((m) => m.id === selectedMissionId) ?? null;
  const MIN_BATTERY = 30;

  const handleStart = () => {
    setError(null);

    if (!selectedMission) {
      setError("No hay ninguna misión seleccionada.");
      return;
    }

    if (!droneConnected) {
      setError("El dron no está conectado. Imposible iniciar la misión.");
      return;
    }

    if (battery === null || battery < MIN_BATTERY) {
      setError("Batería insuficiente para iniciar la misión.");
      return;
    }

    setRunning(true);
    const startTime = new Date().toISOString();
    setMissions((current) => current.map((m) => (m.id === selectedMission.id ? { ...m, status: "En ejecución", startedAt: startTime } : m)));

    setTimeout(() => {
      const endTime = new Date().toISOString();
      setMissions((current) => current.map((m) => (m.id === selectedMission.id ? { ...m, status: "Finalizada", finishedAt: endTime } : m)));
      setRunning(false);
    }, 5000);
  };

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Ejecutar despegue</p>
          <p>Seleccione una misión y ejecute el despegue si el dron está disponible.</p>
        </div>
      </header>

      <section className="launch-mission">
        <div className="assets-table-panel">
          <div className="assets-table-toolbar">
            <div>
              <p className="map-field-label">Misión a ejecutar</p>
              <p>Cantidad: {plantMissions.length}</p>
            </div>
          </div>

          {plantMissions.length === 0 ? (
            <p className="empty-assets">No hay misiones configuradas.</p>
          ) : (
            <div className="assets-table-wrap">
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Activo</th>
                    <th>Estado</th>
                    <th>Seleccionar</th>
                  </tr>
                </thead>
                <tbody>
                  {plantMissions.map((mission) => (
                    <tr key={mission.id} className={selectedMissionId === mission.id ? "selected-row" : undefined}>
                      <td>{mission.name}</td>
                      <td>{mission.assetName}</td>
                      <td>{mission.status ?? "Pendiente"}</td>
                      <td>
                        <button className="table-detail-button" onClick={() => setSelectedMissionId(mission.id)} type="button">
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mission-preview">
          {selectedMission ? (
            <>
              <h3>Preview: {selectedMission.name}</h3>
              <MissionRouteMap
                asset={assets.find((a) => a.id === selectedMission.assetId) ?? null}
                disabled={true}
                onAddPoint={() => {}}
                plant={plant}
                routePoints={selectedMission.routePoints}
              />

              {error && <p className="form-error">{error}</p>}

              <div className="form-actions">
                <button className="register-button" disabled={running} onClick={handleStart} type="button">
                  {running ? "En ejecución..." : "Iniciar despegue"}
                </button>
              </div>
            </>
          ) : (
            <p className="empty-assets">Selecciona una misión para ver su recorrido.</p>
          )}
        </div>
      </section>
    </section>
  );
}

