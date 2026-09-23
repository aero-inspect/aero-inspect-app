import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { PlanWaypoint, TrackPoint, WaypointAction } from "../api/planBuilder";
import type { BackendAsset } from "../api/types";
import { BACKEND_ASSET_TYPE_COLORS } from "../api/constants";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";
import { ASSET_TYPE_ICONS } from "./MissionPlanMap";
import { ACTION_COLORS, ACTION_ICONS, NAVIGATE_MOVEMENT_ICONS } from "../utils/waypointIcons";
import {
  getNavigateMovementKind,
  NAVIGATE_MOVEMENT_COLORS,
  NAVIGATE_MOVEMENT_LABELS,
  type NavigateMovementKind
} from "../utils/waypointMovement";

// Una altitud relativa negativa nunca puede quedar en un plan confirmado, pero tampoco se oculta:
// se ve en rojo, tanto en este marker como en la fila de la lista de waypoints.
const NEGATIVE_ALTITUDE_COLOR = "#d94b4b";

function createWaypointMarkerIcon(
  action: WaypointAction,
  movementKind: NavigateMovementKind,
  isSelected: boolean,
  hasNegativeAltitude: boolean
) {
  const IconComponent = action === "NAVIGATE" ? NAVIGATE_MOVEMENT_ICONS[movementKind] : ACTION_ICONS[action];
  const color = hasNegativeAltitude
    ? NEGATIVE_ALTITUDE_COLOR
    : action === "NAVIGATE"
      ? NAVIGATE_MOVEMENT_COLORS[movementKind]
      : ACTION_COLORS[action];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={13} strokeWidth={2.6} />);
  const size = isSelected ? 30 : 24;

  return L.divIcon({
    className: `leaflet-plan-waypoint-marker${isSelected ? " selected" : ""}${hasNegativeAltitude ? " negative-altitude" : ""}`,
    html: `<span style="background:${color}; width:${size}px; height:${size}px;">${iconSvg}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
}

// El activo elegido en el combo de "punto de interés" se ve mucho más grande y con un anillo, para
// poder identificarlo de un vistazo apenas se elige (o se está por elegir, en el form de insertar).
function createAssetMarkerIcon(asset: BackendAsset, isHighlighted: boolean) {
  const IconComponent = ASSET_TYPE_ICONS[asset.type];
  const size = isHighlighted ? 34 : 20;
  const iconSvg = renderToStaticMarkup(
    <IconComponent color="#ffffff" size={isHighlighted ? 18 : 11} strokeWidth={2.4} />
  );
  return L.divIcon({
    className: `leaflet-plan-asset-marker${isHighlighted ? " highlighted" : ""}`,
    html: `<span style="background:${BACKEND_ASSET_TYPE_COLORS[asset.type]}; width:${size}px; height:${size}px;">${iconSvg}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
}

export function PlanDraftMap({
  assets = [],
  highlightedAssetId = null,
  onSelectWaypoint,
  onMoveWaypoint,
  route,
  selectedSequence,
  trackPoints
}: {
  assets?: BackendAsset[];
  // El activo elegido (o por elegir) en el combo de punto de interés: se lo resalta en el mapa
  // para poder identificarlo.
  highlightedAssetId?: number | null;
  onSelectWaypoint?: (sequence: number) => void;
  // Arrastrar un marker en el mapa mueve el punto en x/y únicamente (nunca su altitud).
  onMoveWaypoint?: (sequence: number, latitude: number, longitude: number) => void;
  route: PlanWaypoint[];
  selectedSequence?: number | null;
  trackPoints: TrackPoint[];
}) {
  const orderedRoute = [...route].sort((a, b) => a.sequence - b.sequence);
  const routePositions: Array<[number, number]> = orderedRoute.map((point) => [point.latitude, point.longitude]);
  const trackPositions: Array<[number, number]> = trackPoints.map((point) => [point.latitude, point.longitude]);

  const center: [number, number] = routePositions[0] ?? trackPositions[0] ?? [0, 0];

  return (
    <div className="leaflet-map-shell">
      <MapContainer
        center={center}
        className="leaflet-map"
        maxZoom={SATELLITE_LAYER.maxZoom}
        minZoom={13}
        scrollWheelZoom
        zoom={17}
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

        {/* El recorrido real queda de fondo, como guía visual: ya no forma parte del plan. */}
        {trackPositions.length > 1 && (
          <Polyline color="#e2e8f0" opacity={0.85} positions={trackPositions} weight={2} />
        )}

        {routePositions.length > 1 && (
          <>
            <Polyline color="#0f172a" opacity={0.55} positions={routePositions} weight={6} />
            <Polyline color="#fbbf24" dashArray="1 8" lineCap="round" positions={routePositions} weight={3} />
          </>
        )}

        {assets.map((asset) => {
          const isHighlighted = asset.idAsset === highlightedAssetId;
          return (
            <Marker
              icon={createAssetMarkerIcon(asset, isHighlighted)}
              key={asset.idAsset}
              position={[asset.latitude, asset.longitude]}
              zIndexOffset={isHighlighted ? 2000 : 0}
            >
              <Tooltip
                className="leaflet-asset-tooltip"
                direction="top"
                offset={[0, isHighlighted ? -20 : -12]}
                permanent={isHighlighted}
              >
                {asset.name}
              </Tooltip>
            </Marker>
          );
        })}

        {orderedRoute.map((point, index) => {
          const movementKind = getNavigateMovementKind(point, orderedRoute[index - 1]);
          const hasNegativeAltitude = point.altitude < 0;
          return (
            <Marker
              bubblingMouseEvents={false}
              draggable={Boolean(onMoveWaypoint)}
              eventHandlers={{
                ...(onSelectWaypoint ? { click: () => onSelectWaypoint(point.sequence) } : {}),
                ...(onMoveWaypoint
                  ? {
                      dragend: (event) => {
                        const position = event.target.getLatLng();
                        onMoveWaypoint(point.sequence, position.lat, position.lng);
                      }
                    }
                  : {})
              }}
              icon={createWaypointMarkerIcon(point.action, movementKind, selectedSequence === point.sequence,
                hasNegativeAltitude)}
              key={point.idPlanWaypoint}
              position={[point.latitude, point.longitude]}
              zIndexOffset={1000}
            >
              <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -16]}>
                #{point.sequence} · {point.action === "NAVIGATE" ? NAVIGATE_MOVEMENT_LABELS[movementKind] : point.action}
                {point.stopSeconds > 0 ? ` · ${point.stopSeconds}s` : ""}
                {hasNegativeAltitude ? ` · altitud ${point.altitude.toFixed(1)}m (inválida)` : ""}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
