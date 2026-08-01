import { useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, Info, Trash2 } from "lucide-react";
import type { Asset, InspectionMission, InspectionPoint, Plant } from "../types";
import { AppTopActions } from "../components/AppTopActions";
import { MissionRouteMap } from "../components/MissionRouteMap";

type MissionDraftStatus = "Pendiente";

const DEFAULT_ROUTE: InspectionPoint[] = [
  { id: 1, latitude: "-35.140110", longitude: "-60.458900" },
  { id: 2, latitude: "-35.140410", longitude: "-60.458520" },
  { id: 3, latitude: "-35.140205", longitude: "-60.457920" },
  { id: 4, latitude: "-35.140760", longitude: "-60.457710" },
  { id: 5, latitude: "-35.141045", longitude: "-60.458240" },
  { id: 6, latitude: "-35.140820", longitude: "-60.458760" }
];

export function ConfigurarMisionView({
  assets,
  onBack,
  onCreateMission,
  plant
}: {
  assets: Asset[];
  missions: InspectionMission[];
  onBack: () => void;
  onCreateMission: (mission: Omit<InspectionMission, "id">) => void;
  plant: Plant;
}) {
  const plantAssets = assets.filter((asset) => asset.plantId === plant.id);
  const fallbackAsset = plantAssets[0] ?? assets[0] ?? null;
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(fallbackAsset?.id ?? null);
  const [missionName, setMissionName] = useState("Inspeccion Silo Norte");
  const [routePoints, setRoutePoints] = useState<InspectionPoint[]>(DEFAULT_ROUTE);
  const [altitude, setAltitude] = useState("30");
  const [speed, setSpeed] = useState("5");
  const [overlap, setOverlap] = useState("80");
  const [isMissionCreated, setIsMissionCreated] = useState(false);

  const selectedAsset = plantAssets.find((asset) => asset.id === selectedAssetId) ?? fallbackAsset;
  const distanceKm = useMemo(() => (routePoints.length > 1 ? "1.23 km" : "0 km"), [routePoints.length]);
  const assetType = selectedAsset?.type || "Silo";
  const status: MissionDraftStatus = "Pendiente";

  const submitMission = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAsset) return;

    onCreateMission({
      name: missionName.trim() || "Inspeccion Silo Norte",
      assetId: selectedAsset.id,
      assetName: selectedAsset.name,
      routePoints,
      status: "Pendiente"
    });
    setIsMissionCreated(true);
  };

  return (
    <section className="mission-config-dashboard">
      <header className="configure-topbar">
        <div>
          <h1>Configurar mision</h1>
          <p>Defini el recorrido y los parametros del vuelo</p>
        </div>
        <AppTopActions />
      </header>

      <form className="configure-form" onSubmit={submitMission}>
        <section className="configure-fields-row" aria-label="Datos de mision">
          <label className="configure-field configure-name-field">
            <span>Nombre de mision *</span>
            <input value={missionName} onChange={(event) => setMissionName(event.target.value)} />
          </label>

          <label className="configure-field configure-select-field">
            <span>Activo a inspeccionar *</span>
            <select value={selectedAsset?.id ?? ""} onChange={(event) => setSelectedAssetId(Number(event.target.value))}>
              {plantAssets.length === 0 && <option value="">Silo Norte</option>}
              {plantAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>

          <div className="configure-field">
            <span>Tipo de activo</span>
            <strong>{assetType}</strong>
          </div>

          <div className="configure-field">
            <span>Estado</span>
            <b className="configure-status-pill">{status}</b>
          </div>
        </section>

        <section className="configure-body-grid">
          <article className="configure-map-card">
            <header>
              <h2>Recorrido de inspeccion</h2>
              <p>Selecciona puntos sobre el mapa para definir la ruta del dron.</p>
            </header>

            <button className="configure-clear-route" type="button" onClick={() => setRoutePoints([])}>
              <Trash2 size={14} />
              Limpiar recorrido
            </button>

            <div className="configure-map-frame">
              <MissionRouteMap
                asset={selectedAsset}
                disabled={false}
                onAddPoint={(point) => setRoutePoints((current) => [...current, { ...point, id: Date.now() + current.length }])}
                plant={plant}
                routePoints={routePoints}
              />
              <div className="configure-map-badge top">{routePoints.length} puntos definidos</div>
            </div>

            <div className="configure-map-note">
              <Info size={15} />
              <span>Haz clic en el mapa para agregar puntos. Arrastra los puntos para ajustar la ruta.</span>
            </div>
          </article>

          <aside className="configure-side-column">
            <article className="configure-card configure-summary-card">
              <header>
                <h2>Resumen de mision</h2>
                <span>MIS-2025-001</span>
              </header>

              <div className="configure-summary-grid">
                <SummaryItem label="Activo seleccionado" value={selectedAsset?.name || "Silo Norte"} />
                <SummaryItem label="Fecha" value="Jueves - 18:45" />
                <SummaryItem label="Tipo de activo" value={assetType} />
                <SummaryItem label="Estado" value={<b className="configure-status-pill">{status}</b>} />
                <SummaryItem label="Puntos definidos" value={String(routePoints.length || 6)} />
                <SummaryItem label="Distancia estimada" value={distanceKm} />
              </div>
            </article>

            <article className="configure-card configure-params-card">
              <h2>Parametros de vuelo</h2>
              <div className="configure-param-grid">
                <label>
                  <span>Altitud (m)</span>
                  <input value={altitude} onChange={(event) => setAltitude(event.target.value)} />
                </label>
                <label>
                  <span>Velocidad (m/s)</span>
                  <input value={speed} onChange={(event) => setSpeed(event.target.value)} />
                </label>
                <label className="wide">
                  <span>Solapamiento de captura (%)</span>
                  <input value={overlap} onChange={(event) => setOverlap(event.target.value)} />
                </label>
              </div>
            </article>
          </aside>
        </section>

        <footer className="configure-actions">
          <button className="configure-cancel" type="button" onClick={onBack}>Cancelar</button>
          <button className="configure-create" type="submit">Crear mision</button>
        </footer>
      </form>

      {isMissionCreated && (
        <div className="configure-success-overlay" role="presentation">
          <article className="configure-success-modal" role="dialog" aria-modal="true" aria-labelledby="configure-success-title">
            <span className="configure-success-icon" aria-hidden="true">
              <Check size={23} />
            </span>
            <h2 id="configure-success-title">Mision Registrada</h2>
            <p>La mision se guardo correctamente con su recorrido y parametros de vuelo.</p>
            <div className="configure-success-actions">
              <button type="button" onClick={() => setIsMissionCreated(false)}>Volver</button>
              <button className="primary" type="button" onClick={onBack}>Ver misiones</button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | JSX.Element }) {
  return (
    <div className="configure-summary-item">
      <span>{label}</span>
      {typeof value === "string" ? <strong>{value}</strong> : value}
    </div>
  );
}
