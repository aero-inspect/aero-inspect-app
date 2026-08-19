const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

// Distancia en metros entre dos coordenadas geograficas (formula de Haversine).
// Se usa para acumular la distancia recorrida por el dron a partir de las
// posiciones sucesivas que llegan por telemetria, ya que el backend no la envia.
export function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

// Distancia total en metros de una ruta, sumando el segmento entre cada
// waypoint consecutivo (en el orden en que vienen dados).
export function totalRouteDistanceMeters(points: { latitude: number; longitude: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistanceMeters(points[i - 1], points[i]);
  }
  return total;
}

type SequencedPoint = { sequence: number; latitude: number; longitude: number };

// Distancia restante en metros desde la posicion actual del dron hasta el final
// de la ruta, siguiendo los tramos planeados (no la posicion GPS acumulada, que
// se ve afectada por el ruido del GPS mientras el dron esta detenido en un punto
// de interes). `targetSequence` es el waypoint hacia el que el dron esta navegando
// en este momento (telemetry.currentWaypoint):  lo anterior a el se considera
// ya recorrido.
export function remainingRouteDistanceMeters(
  orderedPoints: SequencedPoint[],
  dronePosition: { latitude: number; longitude: number } | null | undefined,
  targetSequence: number | null | undefined
): number {
  if (orderedPoints.length === 0) return 0;

  const foundIndex = targetSequence == null ? 0 : orderedPoints.findIndex((point) => point.sequence >= targetSequence);
  const startIndex = foundIndex === -1 ? orderedPoints.length - 1 : foundIndex;

  let remaining = haversineDistanceMeters(dronePosition ?? orderedPoints[startIndex], orderedPoints[startIndex]);
  for (let i = startIndex; i < orderedPoints.length - 1; i += 1) {
    remaining += haversineDistanceMeters(orderedPoints[i], orderedPoints[i + 1]);
  }
  return remaining;
}
