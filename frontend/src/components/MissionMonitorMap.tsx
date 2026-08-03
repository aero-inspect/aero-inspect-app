import { MapContainer, Marker, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import { Icon } from "leaflet";
import type { InspectionPoint, Plant } from "../types";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";

const droneIcon = new Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%2318d4aa' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2v4'/%3E%3Cpath d='m16.2 7.8 2.9-2.9'/%3E%3Cpath d='M18 12h4'/%3E%3Cpath d='m16.2 16.2 2.9 2.9'/%3E%3Cpath d='M12 18v4'/%3E%3Cpath d='m4.9 19.1 2.9-2.9'/%3E%3Cpath d='M2 12h4'/%3E%3Cpath d='m4.9 4.9 2.9 2.9'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export function MissionMonitorMap({
  plant,
  routePoints,
  completedPoints,
  dronePosition
}: {
  plant: Plant;
  routePoints: InspectionPoint[];
  completedPoints: number;
  dronePosition: { lat: number; lng: number } | null;
}) {
  const center: [number, number] = [Number(plant.center.latitude), Number(plant.center.longitude)];
  const plannedRoute: [number, number][] = routePoints.map((point) => [
    Number(point.latitude),
    Number(point.longitude)
  ]);
  const completedRoute: [number, number][] = routePoints
    .slice(0, completedPoints + 1)
    .map((point) => [Number(point.latitude), Number(point.longitude)]);

  return (
    <div className="leaflet-map-shell">
      <MapContainer 
        center={center} 
        className="leaflet-map" 
        maxZoom={SATELLITE_LAYER.maxZoom} 
        minZoom={16} 
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
        {plannedRoute.length > 1 && (
          <Polyline
            positions={plannedRoute}
            pathOptions={{
              color: "#8192a5",
              weight: 3,
              opacity: 0.6,
              dashArray: "10, 10"
            }}
          />
        )}
        {completedRoute.length > 1 && (
          <Polyline
            positions={completedRoute}
            pathOptions={{
              color: "#18d4aa",
              weight: 4,
              opacity: 0.9
            }}
          />
        )}
        {routePoints.map((point, index) => {
          const isCompleted = index <= completedPoints;
          return (
            <CircleMarker
              key={point.id}
              center={[Number(point.latitude), Number(point.longitude)]}
              radius={6}
              pathOptions={{
                fillColor: isCompleted ? "#18d4aa" : "#8192a5",
                fillOpacity: isCompleted ? 0.9 : 0.5,
                color: "#ffffff",
                weight: 2,
                opacity: 1
              }}
            />
          );
        })}
        {dronePosition && (
          <Marker
            position={[dronePosition.lat, dronePosition.lng]}
            icon={droneIcon}
            title="Posición actual del dron"
          />
        )}
      </MapContainer>
    </div>
  );
}


