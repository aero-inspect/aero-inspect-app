import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { TrackPoint } from "../api/planBuilder";
import type { BackendAsset } from "../api/types";
import { BACKEND_ASSET_TYPE_COLORS } from "../api/constants";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";
import { ASSET_TYPE_ICONS } from "./MissionPlanMap";

// Mismo amarillo que un STOP en PlanDraftMap: cada punto marcado termina siendo una parada.
const MARK_COLOR = "#e7b416";

function createMarkIcon(number: number, isSelected: boolean) {
  const size = isSelected ? 30 : 24;
  return L.divIcon({
    className: `leaflet-plan-waypoint-marker leaflet-marked-point-marker${isSelected ? " selected" : ""}`,
    html: `<span style="background:${MARK_COLOR}; width:${size}px; height:${size}px;">${number}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
}

function createAssetIcon(asset: BackendAsset, isAssigned: boolean) {
  const IconComponent = ASSET_TYPE_ICONS[asset.type];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={14} strokeWidth={2.4} />);
  const background = isAssigned ? BACKEND_ASSET_TYPE_COLORS[asset.type] : "#8b95a1";
  return L.divIcon({
    className: `leaflet-readonly-asset-marker${isAssigned ? "" : " disabled"}`,
    html: `<span style="background:${background};">${iconSvg}</span>`,
    iconAnchor: [13, 13],
    iconSize: [26, 26]
  });
}

// El recorrido grabado con sus puntos marcados numerados (1, 2, 3...) y los activos de la planta,
// para ubicar a qué activo corresponde cada punto. Los activos ya asignados se ven en color.
export function MarkedPointsMap({
  trackPoints,
  markedPoints,
  assets,
  assignedAssetIds,
  selectedIndex,
  onSelectPoint
}: {
  trackPoints: TrackPoint[];
  markedPoints: TrackPoint[];
  assets: BackendAsset[];
  assignedAssetIds: Set<number>;
  selectedIndex: number | null;
  onSelectPoint: (index: number) => void;
}) {
  const positions: Array<[number, number]> = trackPoints.map((point) => [point.latitude, point.longitude]);
  if (positions.length === 0) {
    return <p className="mission-empty">El recorrido no tiene puntos para mostrar.</p>;
  }
  const center = positions[0];

  return (
    <div className="leaflet-map-shell">
      <MapContainer
        center={center}
        className="leaflet-map"
        maxZoom={SATELLITE_LAYER.maxZoom}
        minZoom={13}
        scrollWheelZoom
        zoom={18}
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

        {assets.map((asset) => (
          <Marker
            icon={createAssetIcon(asset, assignedAssetIds.has(asset.idAsset))}
            key={asset.idAsset}
            position={[asset.latitude, asset.longitude]}
          >
            <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -14]}>
              {asset.name}
            </Tooltip>
          </Marker>
        ))}

        {markedPoints.map((point, index) => (
          <Marker
            eventHandlers={{ click: () => onSelectPoint(index) }}
            icon={createMarkIcon(index + 1, selectedIndex === index)}
            key={`${point.timestamp}-${index}`}
            position={[point.latitude, point.longitude]}
            zIndexOffset={1000}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              Punto {index + 1} · {point.altitude.toFixed(1)} m
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
