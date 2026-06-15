import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gauge,
  Layers,
  MapPin,
  Navigation,
  Ruler,
  Save,
  Trash2,
  X
} from "lucide-react";
import type { Asset, InspectionMission, InspectionPoint, Plant } from "../types";
import { ASSET_TYPE_COLORS } from "../constants";
import { AppTopActions } from "../components/AppTopActions";
import { FieldError } from "../components/FieldError";
import { MissionRouteMap, type MissionMapMode } from "../components/MissionRouteMap";

type AssetStatus = "Operativo" | "Mantenimiento" | "Fuera de servicio";

const STATUS_META: Record<AssetStatus, { className: string; label: string }> = {
  Operativo: { className: "ok", label: "Operativo" },
  Mantenimiento: { className: "warning", label: "Mantenimiento" },
  "Fuera de servicio": { className: "danger", label: "Fuera de servicio" }
};

export function ConfigurarMisionView({
  assets,
  missions,
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
  const [missionName, setMissionName] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(plantAssets[0]?.id ?? null);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [routePoints, setRoutePoints] = useState<InspectionPoint[]>([]);
  const [flightHeight, setFlightHeight] = useState("20");
  const [flightSpeed, setFlightSpeed] = useState("5");
  const [overlap, setOverlap] = useState("80");
  const [mapMode, setMapMode] = useState<MissionMapMode>("satellite");
  const [centerSignal, setCenterSignal] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "asset" | "route", string>>>({});
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const selectedAsset = plantAssets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedStatus = getAssetStatus(selectedAsset);
  const estimatedDistance = useMemo(() => getRouteDistance(routePoints), [routePoints]);
  const estimatedMinutes = routePoints.length === 0 ? 0 : Math.max(1, Math.ceil(estimatedDistance / 75 + routePoints.length * 0.7));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setIsSuccessOpen(false);

    if (plantAssets.length === 0) {
      setFieldErrors({ asset: "No hay activos disponibles para configurar una mision." });
      return;
    }

    const nextFieldErrors: Partial<Record<"name" | "asset" | "route", string>> = {};

    if (!missionName.trim()) nextFieldErrors.name = "Ingrese nombre de la mision.";
    if (!selectedAsset) nextFieldErrors.asset = "Seleccione un activo a inspeccionar.";
    if (routePoints.length === 0) nextFieldErrors.route = "Defina al menos un punto de inspeccion.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (missionName.length > 100) {
      setFieldErrors({ name: "El nombre de la mision no puede superar los 100 caracteres." });
      return;
    }

    const missionExists = missions.some(
      (mission) => mission.assetId === selectedAsset?.id && mission.name.trim().toLowerCase() === missionName.trim().toLowerCase()
    );

    if (missionExists) {
      setFieldErrors({ name: "Ya existe una mision con ese nombre para el activo seleccionado." });
      return;
    }

    onCreateMission({
      name: missionName.trim(),
      assetId: selectedAsset!.id,
      assetName: selectedAsset!.name,
      routePoints
    });

    setMissionName("");
    setSelectedAssetId(plantAssets[0]?.id ?? null);
    setRoutePoints([]);
    setIsSuccessOpen(true);
  };

  return (
    <section className="mission-config-dashboard">
      <header className="assets-dashboard-header mission-config-header">
        <div className="mission-title-group">
          <button className="mission-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <h1>Configurar mision</h1>
            <p>Planifica un recorrido de inspeccion para un activo registrado.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      <form className="mission-config-form" onSubmit={handleSubmit}>
        <section className="mission-quick-config">
          <label className="mission-field mission-name-field">
            <span>Nombre de mision</span>
            <input
              aria-invalid={Boolean(fieldErrors.name)}
              className={fieldErrors.name ? "field-invalid" : undefined}
              disabled={plantAssets.length === 0}
              maxLength={100}
              onChange={(event) => setMissionName(event.target.value)}
              placeholder="Ej: Inspeccion Silo Norte"
              type="text"
              value={missionName}
            />
            {fieldErrors.name && <FieldError message={fieldErrors.name} />}
          </label>

          <div className="mission-asset-selector">
            <span>Activo a inspeccionar</span>
            <button
              aria-expanded={isAssetOpen}
              aria-haspopup="listbox"
              className={fieldErrors.asset ? "mission-asset-trigger field-invalid" : "mission-asset-trigger"}
              disabled={plantAssets.length === 0}
              onClick={() => setIsAssetOpen((current) => !current)}
              type="button"
            >
              <strong>{selectedAsset?.name || "Activo"}</strong>
              <ChevronDown size={16} aria-hidden="true" />
            </button>

            {isAssetOpen && plantAssets.length > 0 && (
              <div className="mission-asset-menu" role="listbox">
                {plantAssets.map((asset) => (
                  <button
                    className={selectedAssetId === asset.id ? "selected" : undefined}
                    key={asset.id}
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                      setIsAssetOpen(false);
                      setRoutePoints([]);
                    }}
                    role="option"
                    type="button"
                  >
                    <span style={{ "--asset-type-color": ASSET_TYPE_COLORS[asset.type] } as CSSProperties} />
                    {asset.name}
                  </button>
                ))}
              </div>
            )}
            {fieldErrors.asset && <FieldError message={fieldErrors.asset} />}
          </div>

          <QuickInfoCard label="Tipo de activo" value={selectedAsset?.type || "-"} />
          <QuickInfoCard label="Estado" value={selectedStatus} status={selectedStatus} />
        </section>

        {plantAssets.length === 0 && <p className="mission-empty-assets">No hay activos registrados. Primero debe darse de alta un activo.</p>}

        <div className="mission-config-layout">
          <section className="mission-card mission-map-card">
            <div className="mission-card-heading">
              <div>
                <h2>Recorrido de inspeccion</h2>
                <p>Selecciona puntos sobre el mapa para definir la ruta del dron.</p>
              </div>
            </div>

            <div className="mission-map-toolbar">
              <div className="mission-map-tabs">
                <button className={mapMode === "satellite" ? "active" : ""} onClick={() => setMapMode("satellite")} type="button">
                  Satelite
                </button>
                <button className={mapMode === "map" ? "active" : ""} onClick={() => setMapMode("map")} type="button">
                  Mapa
                </button>
              </div>
              <button className="mission-map-tool" disabled={!selectedAsset} onClick={() => setCenterSignal((current) => current + 1)} type="button">
                <Navigation size={15} aria-hidden="true" />
                Centrar activo
              </button>
              <button className="mission-map-tool danger" disabled={routePoints.length === 0} onClick={() => setRoutePoints([])} type="button">
                <Trash2 size={15} aria-hidden="true" />
                Limpiar ruta
              </button>
            </div>

            <div className="mission-map-frame">
              <MissionRouteMap
                asset={selectedAsset}
                centerSignal={centerSignal}
                disabled={plantAssets.length === 0}
                mapMode={mapMode}
                onAddPoint={(point) => {
                  setRoutePoints((current) => [...current, { ...point, id: Date.now() + current.length }]);
                  setFieldErrors((current) => ({ ...current, route: undefined }));
                }}
                plant={plant}
                routePoints={routePoints}
              />
            </div>
            {fieldErrors.route && <FieldError message={fieldErrors.route} />}
          </section>

          <aside className="mission-side-column">
            <section className="mission-card mission-summary-card">
              <h2>Resumen de mision</h2>
              <MissionSummaryItem label="Activo seleccionado" value={selectedAsset?.name || "Sin activo"} icon={<MapPin size={16} />} />
              <MissionSummaryItem label="Tipo" value={selectedAsset?.type || "-"} icon={<Layers size={16} />} />
              <MissionSummaryItem label="Estado" value={selectedStatus} status={selectedStatus} icon={<CheckCircle2 size={16} />} />
              <MissionSummaryItem label="Puntos definidos" value={String(routePoints.length)} icon={<MapPin size={16} />} />
              <MissionSummaryItem label="Distancia estimada" value={`${estimatedDistance} m`} icon={<Ruler size={16} />} />
              <MissionSummaryItem label="Tiempo estimado" value={`${estimatedMinutes} min`} icon={<Clock3 size={16} />} />
            </section>

            <section className="mission-card mission-points-card">
              <h2>Puntos de inspeccion</h2>
              {routePoints.length === 0 ? (
                <div className="mission-no-points">
                  <strong>No hay puntos definidos.</strong>
                  <p>Haz clic sobre el mapa para comenzar.</p>
                </div>
              ) : (
                <div className="mission-point-list">
                  {routePoints.map((point, index) => (
                    <div className="mission-point-card" key={point.id}>
                      <span>Punto {index + 1}</span>
                      <p>{point.latitude}, {point.longitude}</p>
                      <button
                        aria-label="Quitar punto"
                        onClick={() => setRoutePoints((current) => current.filter((item) => item.id !== point.id))}
                        type="button"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mission-card flight-params-card">
              <h2>Parametros de vuelo</h2>
              <div className="flight-param-grid">
                <FlightParam label="Altura" suffix="m" value={flightHeight} onChange={setFlightHeight} />
                <FlightParam label="Velocidad" suffix="m/s" value={flightSpeed} onChange={setFlightSpeed} />
                <FlightParam label="Solapamiento" suffix="%" value={overlap} onChange={setOverlap} />
              </div>
            </section>

            <footer className="mission-side-actions">
              <button className="mission-cancel-button" onClick={onBack} type="button">
                Cancelar
              </button>
              <button className="mission-save-button" disabled={plantAssets.length === 0} type="submit">
                <Save size={16} aria-hidden="true" />
                Guardar mision
              </button>
            </footer>
          </aside>
        </div>
      </form>

      {isSuccessOpen && (
        <MissionSuccessModal
          onGoHome={() => {
            setIsSuccessOpen(false);
            onBack();
          }}
          onViewMissions={() => {
            setIsSuccessOpen(false);
            onBack();
          }}
        />
      )}
    </section>
  );
}

function QuickInfoCard({ label, status, value }: { label: string; status?: AssetStatus; value: string }) {
  return (
    <div className="mission-quick-card">
      <span>{label}</span>
      {status ? <strong className={`assets-status ${STATUS_META[status].className}`}>{value}</strong> : <strong>{value}</strong>}
    </div>
  );
}

function MissionSummaryItem({
  icon,
  label,
  status,
  value
}: {
  icon: ReactNode;
  label: string;
  status?: AssetStatus;
  value: string;
}) {
  return (
    <div className="mission-summary-item">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        {status ? <p className={`assets-status ${STATUS_META[status].className}`}>{value}</p> : <p>{value}</p>}
      </div>
    </div>
  );
}

function FlightParam({
  label,
  onChange,
  suffix,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  suffix: string;
  value: string;
}) {
  return (
    <label className="flight-param">
      <span>
        <Gauge size={14} aria-hidden="true" />
        {label}
      </span>
      <div>
        <input onChange={(event) => onChange(event.target.value)} type="number" value={value} />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

function MissionSuccessModal({
  onGoHome,
  onViewMissions
}: {
  onGoHome: () => void;
  onViewMissions: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <CheckCircle2 size={24} aria-hidden="true" />
        </div>
        <h2>Mision registrada</h2>
        <p>Ya esta disponible para su posterior ejecucion.</p>
        <div className="modal-actions">
          <button className="modal-link-button" onClick={onGoHome} type="button">
            Volver al inicio
          </button>
          <button className="register-button" onClick={onViewMissions} type="button">
            Ver misiones
          </button>
        </div>
      </section>
    </div>
  );
}

function getAssetStatus(asset: Asset | null): AssetStatus {
  if (!asset) return "Operativo";
  if (asset.status) return asset.status;
  if (asset.name.toLowerCase().includes("sur") || asset.id % 7 === 0) return "Fuera de servicio";
  if (asset.type === "Tuberia" || asset.id % 4 === 0) return "Mantenimiento";
  return "Operativo";
}

function getRouteDistance(points: InspectionPoint[]) {
  if (points.length < 2) return 0;
  return Math.round(
    points.slice(1).reduce((total, point, index) => {
      const previous = points[index];
      return total + getDistanceMeters(previous, point);
    }, 0)
  );
}

function getDistanceMeters(first: InspectionPoint, second: InspectionPoint) {
  const earthRadius = 6371000;
  const lat1 = toRadians(Number(first.latitude));
  const lat2 = toRadians(Number(second.latitude));
  const deltaLat = toRadians(Number(second.latitude) - Number(first.latitude));
  const deltaLng = toRadians(Number(second.longitude) - Number(first.longitude));
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
