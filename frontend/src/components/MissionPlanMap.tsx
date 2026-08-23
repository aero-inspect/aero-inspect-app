import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import { Camera, Cylinder, MoveHorizontal, RotateCw, Waves, Wind, Building2 } from "lucide-react";
import type { BackendAsset, BackendAssetType, BackendFlightPlan, BackendPlanWaypoint } from "../api/types";
import { BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";
import { photoCountForWaypoint } from "../utils/missionPhotos";

// Un ícono por tipo de activo, en vez de codificar el tipo con el color del círculo
// (dejaba colores medio arbitrarios, poco intuitivos). El color del círculo queda libre
// para indicar selección: gris si no se tildó ningún punto de ese activo, verde si sí.
export const ASSET_TYPE_ICONS: Record<BackendAssetType, typeof Cylinder> = {
  SILO: Cylinder,
  NORIA: RotateCw,
  CINTA_TRANSPORTADORA: MoveHorizontal,
  TUBERIA: Waves,
  TECHO: Building2
};

// Marcador grande y clickeable para elegir activos en el mapa de armado de misión.
// Independiente de .leaflet-asset-marker (10px, usado en otros mapas de solo lectura):
// acá el activo ES la interacción principal de la pantalla, tiene que invitar al click.
function createSelectableAssetMarkerIcon(type: BackendAssetType, hasSelection: boolean) {
  const IconComponent = ASSET_TYPE_ICONS[type];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={16} strokeWidth={2.4} />);
  const background = hasSelection ? "#16a34a" : "#1f2937";

  return L.divIcon({
    className: "leaflet-selectable-asset-marker",
    html: `<span style="background:${background};">${iconSvg}</span>`,
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
              icon={createSelectableAssetMarkerIcon(asset.type, selectedCount > 0)}
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
      {asset.imageData && (
        <div className="asset-popup-photo-wrap">
          <img alt={asset.name} className="asset-popup-photo" src={asset.imageData} />
        </div>
      )}
      <h3>
        {asset.name} <span className="poi-popup-meta">· {BACKEND_ASSET_TYPE_LABELS[asset.type]}</span>
      </h3>
      {pointsOfInterest.length === 0 ? (
        <p className="poi-popup-empty">Este activo no tiene puntos de interés configurados en el plan.</p>
      ) : (
        <ul className="poi-popup-list">
          {pointsOfInterest.map((point) => {
            const photoCount = photoCountForWaypoint(point);
            return (
              <li className="poi-popup-item" key={point.idPlanWaypoint}>
                <label>
                  <input
                    checked={selectedWaypointIds.has(point.idPlanWaypoint)}
                    onChange={() => onToggleWaypoint(point.idPlanWaypoint)}
                    type="checkbox"
                  />
                  <strong>{point.name}</strong>
                  <span className="poi-popup-photo-badge" title={`${photoCount} foto${photoCount === 1 ? "" : "s"} en este punto`}>
                    <Camera aria-hidden="true" size={11} />
                    {photoCount}
                  </span>
                </label>
                {point.description && <p>{point.description}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

