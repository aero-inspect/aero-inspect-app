import { MapContainer, Marker, TileLayer } from "react-leaflet";
import type { MapMarker, Plant } from "../types";
import { SATELLITE_LAYER, ASSET_TYPE_COLORS } from "../constants";
import { createAssetMarkerIcon, selectedMarkerIcon, MapClickHandler, MapSizeController } from "./LeafletHelpers";

export function LeafletSatelliteMap({
  markers,
  onSelect,
  plant,
  selectedLocation
}: {
  markers: MapMarker[];
  onSelect?: (location: { latitude: string; longitude: string }) => void;
  plant: Plant;
  selectedLocation?: { latitude: string; longitude: string };
}) {
  const center: [number, number] = [Number(plant.center.latitude), Number(plant.center.longitude)];

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

        {markers.map((marker) => (
          <Marker
            bubblingMouseEvents={false}
            icon={createAssetMarkerIcon(marker.type, ASSET_TYPE_COLORS[marker.type])}
            key={marker.id}
            position={[Number(marker.latitude), Number(marker.longitude)]}
            title={marker.label}
          />
        ))}

        {selectedLocation && (
          <Marker
            bubblingMouseEvents={false}
            icon={selectedMarkerIcon}
            position={[Number(selectedLocation.latitude), Number(selectedLocation.longitude)]}
            title="Punto seleccionado"
          />
        )}

        {onSelect && <MapClickHandler onSelect={onSelect} />}
      </MapContainer>
    </div>
  );
}
