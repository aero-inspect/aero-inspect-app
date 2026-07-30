import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { BackendAsset, BackendFlightPlan, BackendPlanWaypoint } from "../api/types";
import { BACKEND_ASSET_TYPE_COLORS, BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";

// Marcador grande y clickeable para elegir activos en el mapa de armado de misión.
// Independiente de .leaflet-asset-marker (10px, usado en otros mapas de solo lectura):
// acá el activo ES la interacción principal de la pantalla, tiene que invitar al click.
function createSelectableAssetMarkerIcon(color: string) {
  return L.divIcon({
    className: "leaflet-selectable-asset-marker",
    html: `<span style="background:${color};"></span>`,
    iconAnchor: [16, 16],
    iconSize: [32, 32]
  });
}

export function MissionPlanMap({
  flightPlan,
  assets,
  selectedWaypointIds,
  onToggleWaypoint
}: {
  flightPlan: BackendFlightPlan;
  assets: BackendAsset[];
  selectedWaypointIds: Set<number>;
  onToggleWaypoint: (idPlanWaypoint: number) => void;
}) {
  const orderedRoute = [...flightPlan.route].sort((a, b) => a.sequence - b.sequence);
  const routePositions: Array<[number, number]> = orderedRoute.map((point) => [point.latitude, point.longitude]);

  const center: [number, number] =
    assets.length > 0
      ? [
          assets.reduce((sum, asset) => sum + asset.latitude, 0) / assets.length,
          assets.reduce((sum, asset) => sum + asset.longitude, 0) / assets.length
        ]
      : (routePositions[0] ?? [0, 0]);

  return (
    <div className="leaflet-map-shell">
      <MapContainer
        center={center}
        className="leaflet-map"
        maxZoom={SATELLITE_LAYER.maxZoom}
        minZoom={14}
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

        {routePositions.length > 1 && (
          <>
            <Polyline color="#0f172a" opacity={0.55} positions={routePositions} weight={6} />
            <Polyline color="#fbbf24" dashArray="1 8" lineCap="round" positions={routePositions} weight={3} />
          </>
        )}

        {assets.map((asset) => {
          const pointsOfInterest = orderedRoute.filter(
            (point) => point.pointOfInterest && point.idAsset === asset.idAsset
          );
          const selectedCount = pointsOfInterest.filter((point) => selectedWaypointIds.has(point.idPlanWaypoint)).length;

          return (
            <Marker
              bubblingMouseEvents={false}
              icon={createSelectableAssetMarkerIcon(BACKEND_ASSET_TYPE_COLORS[asset.type])}
              key={asset.idAsset}
              position={[asset.latitude, asset.longitude]}
            >
              <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -18]} permanent>
                {asset.name}
                {pointsOfInterest.length > 0 ? ` · ${selectedCount}/${pointsOfInterest.length}` : ""}
              </Tooltip>
              <Popup minWidth={240}>
                <AssetPointsOfInterestPopup
                  asset={asset}
                  onToggleWaypoint={onToggleWaypoint}
                  pointsOfInterest={pointsOfInterest}
                  selectedWaypointIds={selectedWaypointIds}
                />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function AssetPointsOfInterestPopup({
  asset,
  pointsOfInterest,
  selectedWaypointIds,
  onToggleWaypoint
}: {
  asset: BackendAsset;
  pointsOfInterest: BackendPlanWaypoint[];
  selectedWaypointIds: Set<number>;
  onToggleWaypoint: (idPlanWaypoint: number) => void;
}) {
  return (
    <div className="poi-popup">
      <h3>
        {asset.name} <span className="poi-popup-meta">· {BACKEND_ASSET_TYPE_LABELS[asset.type]}</span>
      </h3>
      {pointsOfInterest.length === 0 ? (
        <p className="poi-popup-empty">Este activo no tiene puntos de interés configurados en el plan.</p>
      ) : (
        <ul className="poi-popup-list">
          {pointsOfInterest.map((point) => (
            <li className="poi-popup-item" key={point.idPlanWaypoint}>
              <label>
                <input
                  checked={selectedWaypointIds.has(point.idPlanWaypoint)}
                  onChange={() => onToggleWaypoint(point.idPlanWaypoint)}
                  type="checkbox"
                />
                <strong>{point.name}</strong>
              </label>
              {point.description && <p>{point.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
