import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import type { Asset, InspectionPoint, Plant } from "../types";
import { SATELLITE_LAYER, ASSET_TYPE_COLORS } from "../constants";
import { createAssetMarkerIcon, missionRoutePointIcon, MapClickHandler, MapSizeController } from "./LeafletHelpers";

export function MissionRouteMap({
  asset,
  disabled,
  onAddPoint,
  plant,
  routePoints
}: {
  asset: Asset | null;
  disabled: boolean;
  onAddPoint: (point: { latitude: string; longitude: string }) => void;
  plant: Plant;
  routePoints: InspectionPoint[];
}) {
  const center: [number, number] = asset
    ? [Number(asset.latitude), Number(asset.longitude)]
    : [Number(plant.center.latitude), Number(plant.center.longitude)];
  const routePositions: Array<[number, number]> = routePoints.map((point) => [Number(point.latitude), Number(point.longitude)]);

  return (
    <div className="leaflet-map-shell">
      <MapContainer center={center} className="leaflet-map" maxZoom={SATELLITE_LAYER.maxZoom} minZoom={16} scrollWheelZoom zoom={18} zoomControl>
        <MapSizeController center={center} />
        <TileLayer
          attribution={SATELLITE_LAYER.attribution}
          maxNativeZoom={SATELLITE_LAYER.maxNativeZoom}
          maxZoom={SATELLITE_LAYER.maxZoom}
          tileSize={SATELLITE_LAYER.tileSize}
          url={SATELLITE_LAYER.url}
          zoomOffset={SATELLITE_LAYER.zoomOffset}
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
