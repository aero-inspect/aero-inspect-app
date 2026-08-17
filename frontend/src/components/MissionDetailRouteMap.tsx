import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Camera } from "lucide-react";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";
import { ASSET_TYPE_ICONS } from "./MissionPlanMap";
import { BACKEND_ASSET_TYPE_COLORS, BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import type { BackendAsset, BackendAssetType } from "../api/types";

type RoutePoint = {
  sequence: number;
  latitude: number;
  longitude: number;
};

// Estado de inspeccion de un activo dentro de esta mision puntual: si va a ser
// (o fue) sobrevolado, y cuantas fotos de las planeadas para el ya se tomaron.
export type AssetInspectionInfo = {
  inspected: boolean;
  totalPhotos: number;
  takenPhotos: number;
};

export type DroneMapPosition = {
  lat: number;
  lng: number;
  headingDegree?: number | null;
};

// Icono de un dron visto desde arriba: silueta de cuadricoptero (brazos en X,
// motores y fuselaje) con una unica flecha de rumbo bien marcada, para que no
// se confunda con los marcadores de activos/hallazgos del mismo mapa (esos
// son circulos rellenos con icono adentro).
function createDroneIcon(headingDegree: number | null | undefined) {
  const rotation = headingDegree ?? 0;
  return divIcon({
    className: "leaflet-drone-marker",
    html: `<span class="leaflet-drone-halo"></span>
    <span class="leaflet-drone-body" style="transform: rotate(${rotation}deg)">
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#0a1a38" stroke-width="3" stroke-linecap="round">
          <line x1="20" y1="20" x2="10.5" y2="10.5" />
          <line x1="20" y1="20" x2="29.5" y2="10.5" />
          <line x1="20" y1="20" x2="10.5" y2="29.5" />
          <line x1="20" y1="20" x2="29.5" y2="29.5" />
        </g>
        <g fill="#0a1a38" stroke="#ffffff" stroke-width="1.4">
          <circle cx="10.5" cy="10.5" r="4" />
          <circle cx="29.5" cy="10.5" r="4" />
          <circle cx="10.5" cy="29.5" r="4" />
          <circle cx="29.5" cy="29.5" r="4" />
        </g>
        <rect x="14" y="14" width="12" height="12" rx="3.5" fill="#0a1a38" stroke="#ffffff" stroke-width="1.4" />
        <path d="M20 7 L25 16 L15 16 Z" fill="#fbbf24" stroke="#0a1a38" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
    </span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
}

// Marcador de solo lectura para un activo: mismo icono por tipo que MissionPlanMap
// (sin estado de seleccion, aca el click abre el popup en vez de tildar un punto).
// Los activos que no se inspeccionan en esta mision van en gris deshabilitado.
function createAssetIcon(type: BackendAssetType, inspected: boolean) {
  const IconComponent = ASSET_TYPE_ICONS[type];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={14} strokeWidth={2.4} />);
  const background = inspected ? BACKEND_ASSET_TYPE_COLORS[type] : "#8b95a1";

  return divIcon({
    className: `leaflet-readonly-asset-marker${inspected ? "" : " disabled"}`,
    html: `<span style="background:${background};">${iconSvg}</span>`,
    iconAnchor: [13, 13],
    iconSize: [26, 26]
  });
}

function AssetInspectionPopup({ asset, info }: { asset: BackendAsset; info: AssetInspectionInfo | undefined }) {
  const TypeIcon = ASSET_TYPE_ICONS[asset.type];
  const inspected = info?.inspected ?? false;
  const iconColor = inspected ? BACKEND_ASSET_TYPE_COLORS[asset.type] : "#8b95a1";

  return (
    <div className="asset-popup">
      <div className="asset-popup-header">
        <span className="asset-popup-icon" style={{ background: iconColor }}>
          <TypeIcon color="#ffffff" size={15} strokeWidth={2.4} />
        </span>
        <div className="asset-popup-heading">
          <h3>{asset.name}</h3>
          <span className="asset-popup-type">{BACKEND_ASSET_TYPE_LABELS[asset.type]}</span>
        </div>
      </div>

      {info?.inspected ? (
        <AssetInspectionDetails info={info} />
      ) : (
        <p className="asset-popup-empty">Este activo no se va a inspeccionar durante esta mision.</p>
      )}
    </div>
  );
}

function AssetInspectionDetails({ info }: { info: AssetInspectionInfo }) {
  const pendingPhotos = Math.max(0, info.totalPhotos - info.takenPhotos);
  const isDone = info.totalPhotos > 0 && info.takenPhotos >= info.totalPhotos;
  const progressPct = info.totalPhotos > 0 ? Math.round((info.takenPhotos / info.totalPhotos) * 100) : 0;

  return (
    <>
      <span className={`asset-popup-status ${isDone ? "done" : "pending"}`}>
        {isDone ? "Inspeccion completada" : "Inspeccion pendiente"}
      </span>
      <div className="asset-popup-photos">
        <div className="asset-popup-photos-track">
          <span style={{ width: `${progressPct}%` }} />
        </div>
        <div className="asset-popup-photos-row">
          <Camera aria-hidden="true" size={12} />
          {info.takenPhotos} de {info.totalPhotos} foto{info.totalPhotos === 1 ? "" : "s"}
          {pendingPhotos > 0 && <span className="asset-popup-photos-pending">· {pendingPhotos} pendiente{pendingPhotos === 1 ? "" : "s"}</span>}
        </div>
      </div>
    </>
  );
}

// Mapa de solo lectura para el detalle de una misión: dibuja la ruta planeada, los
// activos a inspeccionar y, si se proveen, la posición y el rumbo en vivo del dron
// (a diferencia de MissionPlanMap, que es para elegir activos).
export function MissionDetailRouteMap({
  points,
  assets,
  assetInspectionInfo,
  dronePosition,
  completedSequence
}: {
  points: RoutePoint[];
  assets?: BackendAsset[];
  assetInspectionInfo?: Map<number, AssetInspectionInfo>;
  dronePosition?: DroneMapPosition | null;
  completedSequence?: number | null;
}) {
  if (points.length === 0) {
    return <p className="mission-empty">Esta misión no tiene una ruta para mostrar todavía.</p>;
  }

  const ordered = [...points].sort((a, b) => a.sequence - b.sequence);
  const positions: Array<[number, number]> = ordered.map((point) => [point.latitude, point.longitude]);
  const center = positions[0];

  // Un tramo se pinta como recorrido recien cuando el dron ya llego al punto
  // siguiente (no apenas sale del punto actual, que es lo que da currentWaypoint
  // en cuanto arranca a navegar hacia el): por eso el corte es "<" y no "<=".
  const completedPositions: Array<[number, number]> =
    completedSequence != null
      ? ordered.filter((point) => point.sequence < completedSequence).map((point) => [point.latitude, point.longitude])
      : [];

  return (
    <div className="leaflet-map-shell">
      <MapContainer
        center={center}
        className="leaflet-map"
        maxZoom={SATELLITE_LAYER.maxZoom}
        minZoom={13}
        scrollWheelZoom
        zoom={16}
        zoomControl
      >
        <MapSizeController center={center} />
        <TileLayer
          attribution={SATELLITE_LAYER.attribution}
          maxNativeZoom={SATELLITE_LAYER.maxNativeZoom}
          maxZoom={SATELLITE_LAYER.maxZoom}
          tileSize={SATELLITE_LAYER.tileSize}
          url={SATELLITE_LAYER.url}
          zoomOffset={SATELLITE_LAYER.zoomOffset}
        />

        {positions.length > 1 && (
          <>
            <Polyline color="#0f172a" opacity={0.55} positions={positions} weight={6} />
            <Polyline color="#fbbf24" lineCap="round" positions={positions} weight={3} />
          </>
        )}

        {completedPositions.length > 1 && (
          <Polyline color="#38bdf8" lineCap="round" positions={completedPositions} weight={4} />
        )}

        {assets?.map((asset) => {
          const info = assetInspectionInfo?.get(asset.idAsset);
          return (
            <Marker
              bubblingMouseEvents={false}
              icon={createAssetIcon(asset.type, info?.inspected ?? false)}
              key={asset.idAsset}
              position={[asset.latitude, asset.longitude]}
            >
              <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -14]} permanent>
                {asset.name}
              </Tooltip>
              <Popup minWidth={200}>
                <AssetInspectionPopup asset={asset} info={info} />
              </Popup>
            </Marker>
          );
        })}

        {dronePosition && (
          <Marker
            position={[dronePosition.lat, dronePosition.lng]}
            icon={createDroneIcon(dronePosition.headingDegree)}
            title="Posición actual del dron"
          />
        )}
      </MapContainer>
    </div>
  );
}
