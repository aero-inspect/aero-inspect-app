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

// Icono de un dron visto desde arriba (mismo dibujo que el widget de brujula,
// ver components/Compass.tsx), rotado con CSS segun el rumbo en vivo.
function createDroneIcon(headingDegree: number | null | undefined) {
  const rotation = headingDegree ?? 0;
  return divIcon({
    className: "leaflet-drone-marker",
    html: `<span style="transform: rotate(${rotation}deg)">
      <svg width="34" height="34" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="15" fill="#0a1a38" fill-opacity="0.16" />
        <g stroke="#0a1a38" stroke-width="1.4" stroke-linecap="round">
          <line x1="16" y1="16" x2="7" y2="7" />
          <line x1="16" y1="16" x2="25" y2="7" />
          <line x1="16" y1="16" x2="7" y2="25" />
          <line x1="16" y1="16" x2="25" y2="25" />
        </g>
        <circle cx="7" cy="7" r="4.2" fill="#18d4aa" stroke="#0a1a38" stroke-width="1.2" />
        <circle cx="25" cy="7" r="4.2" fill="#18d4aa" stroke="#0a1a38" stroke-width="1.2" />
        <circle cx="7" cy="25" r="4.2" fill="#8192a5" stroke="#0a1a38" stroke-width="1.2" />
        <circle cx="25" cy="25" r="4.2" fill="#8192a5" stroke="#0a1a38" stroke-width="1.2" />
        <rect x="12" y="12" width="8" height="8" rx="2.4" fill="#0a1a38" />
        <path d="M16 2 L20 9 L12 9 Z" fill="#fbbf24" />
      </svg>
    </span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
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
