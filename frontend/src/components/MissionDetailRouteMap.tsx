import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";
import { ASSET_TYPE_ICONS } from "./MissionPlanMap";
import { BACKEND_ASSET_TYPE_COLORS } from "../api/constants";
import type { BackendAsset } from "../api/types";

type RoutePoint = {
  sequence: number;
  latitude: number;
  longitude: number;
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

// Marcador de solo lectura para un activo a inspeccionar: mismo icono por tipo que
// MissionPlanMap, pero sin estado de seleccion (acá el activo no es clickeable).
function createAssetIcon(type: BackendAsset["type"]) {
  const IconComponent = ASSET_TYPE_ICONS[type];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={14} strokeWidth={2.4} />);

  return divIcon({
    className: "leaflet-readonly-asset-marker",
    html: `<span style="background:${BACKEND_ASSET_TYPE_COLORS[type]};">${iconSvg}</span>`,
    iconAnchor: [13, 13],
    iconSize: [26, 26]
  });
}

// Mapa de solo lectura para el detalle de una misión: dibuja la ruta planeada, los
// activos a inspeccionar y, si se proveen, la posición y el rumbo en vivo del dron
// (a diferencia de MissionPlanMap, que es para elegir activos).
export function MissionDetailRouteMap({
  points,
  assets,
  dronePosition,
  completedSequence
}: {
  points: RoutePoint[];
  assets?: BackendAsset[];
  dronePosition?: DroneMapPosition | null;
  completedSequence?: number | null;
}) {
  if (points.length === 0) {
    return <p className="mission-empty">Esta misión no tiene una ruta para mostrar todavía.</p>;
  }

  const ordered = [...points].sort((a, b) => a.sequence - b.sequence);
  const positions: Array<[number, number]> = ordered.map((point) => [point.latitude, point.longitude]);
  const center = positions[0];

  const completedPositions: Array<[number, number]> =
    completedSequence != null
      ? ordered.filter((point) => point.sequence <= completedSequence).map((point) => [point.latitude, point.longitude])
      : [];

  return (
    <div className="leaflet-map-shell">
      <MapContainer
        center={center}
        className="leaflet-map"
        maxZoom={SATELLITE_LAYER.maxZoom}
        minZoom={13}
        scrollWheelZoom={false}
        zoom={16}
        zoomControl={false}
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
          <Polyline color="#18d4aa" lineCap="round" positions={completedPositions} weight={4} />
        )}

        {assets?.map((asset) => (
          <Marker bubblingMouseEvents={false} icon={createAssetIcon(asset.type)} key={asset.idAsset} position={[asset.latitude, asset.longitude]}>
            <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -14]} permanent>
              {asset.name}
            </Tooltip>
          </Marker>
        ))}

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
