import { haversineDistanceMeters } from "./geo";

// Mismos valores fijos que el backend (AxisDecomposer.HORIZONTAL_EPSILON_METERS /
// VERTICAL_EPSILON_METERS): un tramo entre dos waypoints tiene que ser puramente horizontal o
// puramente vertical. Se duplican acá para poder avisar ANTES de guardar (al soltar un drag), en
// vez de enterarse recién cuando el backend rechaza el PATCH.
export const HORIZONTAL_EPSILON_METERS = 1.5;
export const VERTICAL_EPSILON_METERS = 0.5;

export function violatesAxisConstraint(
  a: { latitude: number; longitude: number; altitude: number },
  b: { latitude: number; longitude: number; altitude: number }
): boolean {
  const horizontal = haversineDistanceMeters(a, b);
  const vertical = Math.abs(a.altitude - b.altitude);
  return horizontal >= HORIZONTAL_EPSILON_METERS && vertical >= VERTICAL_EPSILON_METERS;
}
