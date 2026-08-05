import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { PlaneTakeoff, PlaneLanding, CircleDot, ArrowRight, ArrowUp, ArrowDown } from "lucide-react";
import type { PlanWaypoint, TrackPoint, WaypointAction } from "../api/planBuilder";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";
import {
  getNavigateMovementKind,
  NAVIGATE_MOVEMENT_COLORS,
  NAVIGATE_MOVEMENT_LABELS,
  type NavigateMovementKind
} from "../utils/waypointMovement";

const ACTION_ICONS: Record<Exclude<WaypointAction, "NAVIGATE">, typeof PlaneTakeoff> = {
  TAKEOFF: PlaneTakeoff,
  LAND: PlaneLanding,
  STOP: CircleDot
};

const ACTION_COLORS: Record<Exclude<WaypointAction, "NAVIGATE">, string> = {
  TAKEOFF: "#0ca75b",
  LAND: "#d94b4b",
  STOP: "#e7b416"
};

const NAVIGATE_MOVEMENT_ICONS: Record<NavigateMovementKind, typeof PlaneTakeoff> = {
  CLIMB: ArrowUp,
  DESCEND: ArrowDown,
  HORIZONTAL: ArrowRight
};

function createWaypointMarkerIcon(
  action: WaypointAction,
  movementKind: NavigateMovementKind,
  isSelected: boolean
) {
  const IconComponent = action === "NAVIGATE" ? NAVIGATE_MOVEMENT_ICONS[movementKind] : ACTION_ICONS[action];
  const color = action === "NAVIGATE" ? NAVIGATE_MOVEMENT_COLORS[movementKind] : ACTION_COLORS[action];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={13} strokeWidth={2.6} />);
  const size = isSelected ? 30 : 24;

  return L.divIcon({
    className: `leaflet-plan-waypoint-marker${isSelected ? " selected" : ""}`,
    html: `<span style="background:${color}; width:${size}px; height:${size}px;">${iconSvg}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
}

export function PlanDraftMap({
  onSelectWaypoint,
  route,
  selectedSequence,
  trackPoints
}: {
  onSelectWaypoint?: (sequence: number) => void;
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

        {trackPositions.length > 1 && (
          <Polyline color="#e2e8f0" opacity={0.85} positions={trackPositions} weight={2} />
        )}

        {routePositions.length > 1 && (
          <>
            <Polyline color="#0f172a" opacity={0.55} positions={routePositions} weight={6} />
            <Polyline color="#fbbf24" dashArray="1 8" lineCap="round" positions={routePositions} weight={3} />
          </>
        )}

        {orderedRoute.map((point, index) => {
          const movementKind = getNavigateMovementKind(point, orderedRoute[index - 1]);
          return (
            <Marker
              bubblingMouseEvents={false}
              eventHandlers={onSelectWaypoint ? { click: () => onSelectWaypoint(point.sequence) } : undefined}
              icon={createWaypointMarkerIcon(point.action, movementKind, selectedSequence === point.sequence)}
              key={point.idPlanWaypoint}
              position={[point.latitude, point.longitude]}
            >
              <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -16]}>
                #{point.sequence} · {point.action === "NAVIGATE" ? NAVIGATE_MOVEMENT_LABELS[movementKind] : point.action}
                {point.stopSeconds > 0 ? ` · ${point.stopSeconds}s` : ""}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
