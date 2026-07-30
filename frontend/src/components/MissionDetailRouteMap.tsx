import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import { SATELLITE_LAYER } from "../constants";
import { MapSizeController } from "./LeafletHelpers";

type RoutePoint = {
  sequence: number;
  latitude: number;
  longitude: number;
};

// Mapa de solo lectura para el detalle de una misión: solo dibuja la ruta, sin
// activos seleccionables ni popups (a diferencia de MissionPlanMap, que es para elegirlos).
export function MissionDetailRouteMap({ points }: { points: RoutePoint[] }) {
  if (points.length === 0) {
    return <p className="mission-empty">Esta misión no tiene una ruta para mostrar todavía.</p>;
  }

  const ordered = [...points].sort((a, b) => a.sequence - b.sequence);
  const positions: Array<[number, number]> = ordered.map((point) => [point.latitude, point.longitude]);
  const center = positions[0];

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
      </MapContainer>
    </div>
  );
}
