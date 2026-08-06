import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import type { Asset, InspectionPoint, Plant } from "../types";
import { SATELLITE_LAYER, ASSET_TYPE_COLORS } from "../constants";
import { createAssetMarkerIcon, missionRoutePointIcon, MapClickHandler, MapSizeController } from "./LeafletHelpers";

export type MissionMapMode = "satellite" | "map";

export function MissionRouteMap({
  asset,
  centerSignal = 0,
  disabled,
  mapMode = "satellite",
  onAddPoint,
  plant,
  routePoints
}: {
  asset: Asset | null;
  centerSignal?: number;
  disabled: boolean;
  mapMode?: MissionMapMode;
  onAddPoint: (point: { latitude: string; longitude: string }) => void;
  plant: Plant;
  routePoints: InspectionPoint[];
}) {
  const center: [number, number] = asset
    ? [Number(asset.latitude), Number(asset.longitude)]
    : [Number(plant.center.latitude), Number(plant.center.longitude)];
  const routePositions: Array<[number, number]> = routePoints.map((point) => [Number(point.latitude), Number(point.longitude)]);
  const mapLayer =
    mapMode === "map"
      ? {
          attribution: "OpenStreetMap",
          maxNativeZoom: 19,
          maxZoom: 22,
          tileSize: 256,
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          zoomOffset: 0
        }
      : SATELLITE_LAYER;

  return (
    <div className="leaflet-map-shell">
      <MapContainer center={center} className="leaflet-map" maxZoom={mapLayer.maxZoom} minZoom={16} scrollWheelZoom zoom={18} zoomControl>
        <MapSizeController center={center} invalidateSignal={`${centerSignal}-${mapMode}`} />
        <TileLayer
          attribution={mapLayer.attribution}
          key={mapMode}
          maxNativeZoom={mapLayer.maxNativeZoom}
          maxZoom={mapLayer.maxZoom}
          tileSize={mapLayer.tileSize}
          url={mapLayer.url}
          zoomOffset={mapLayer.zoomOffset}
        />

        {asset && (
          <Marker
            bubblingMouseEvents={false}
            icon={createAssetMarkerIcon(asset.type, ASSET_TYPE_COLORS[asset.type])}
            position={[Number(asset.latitude), Number(asset.longitude)]}
            title={asset.name}
          />
        )}

        {routePositions.length > 1 && <Polyline color="#111827" positions={routePositions} weight={2} />}

        {routePoints.map((point) => (
          <Marker
            bubblingMouseEvents={false}
            icon={missionRoutePointIcon}
            key={point.id}
            position={[Number(point.latitude), Number(point.longitude)]}
            title="Punto de inspeccion"
          />
        ))}

        {!disabled && <MapClickHandler onSelect={onAddPoint} />}
      </MapContainer>
    </div>
  );
}

