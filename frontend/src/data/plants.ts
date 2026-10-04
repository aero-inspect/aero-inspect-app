import type { Plant } from "../types";
import { MOCK_PLANT } from "./mockPlant";

export const BRAGADO_PLANT: Plant = { ...MOCK_PLANT, name: "Planta Bragado" };
export const LUJAN_PLANT: Plant = {
  id: "planta-lujan",
  name: "Planta Luján",
  province: "Buenos Aires",
  center: { latitude: "-34.550862", longitude: "-59.067302" },
  bounds: [
    // Google Earth parcel: docs/lujan-terreno.kml. Same ring, starting at the
    // western corner and reversed to retain the southeast access edge at 2.
    { latitude: "-34.55085661590702", longitude: "-59.06763790783339" },
    { latitude: "-34.55057976208426", longitude: "-59.0673540928595" },
    { latitude: "-34.55092972970898", longitude: "-59.06700853172225" },
    { latitude: "-34.55107354372663", longitude: "-59.06718429000433" },
    { latitude: "-34.55107898006273", longitude: "-59.06729358217251" },
    { latitude: "-34.55103017897", longitude: "-59.06742709207172" }
  ]
};
export const PLANTS = [BRAGADO_PLANT, LUJAN_PLANT];
export const PLANT_STORAGE_KEY = "aeroinspect.selectedPlant";
export function loadSelectedPlant(): Plant {
  try { return PLANTS.find(plant => plant.id === localStorage.getItem(PLANT_STORAGE_KEY)) ?? BRAGADO_PLANT; }
  catch { return BRAGADO_PLANT; }
}

export const LUJAN_POOL = { latitude: -34.550844, longitude: -59.067347 };
export const LUJAN_PATIO = { latitude: -34.550782, longitude: -59.067430 };
// WGS84 local metric frame: X east, Z south, origin at the supplied pool center.
// Curvature radii at this latitude; valid for this parcel, not a global projection.
const latitudeRadians = LUJAN_POOL.latitude * Math.PI / 180;
const eccentricitySquared = 6.69437999014e-3;
const curvature = 1 - eccentricitySquared * Math.sin(latitudeRadians) ** 2;
const longitudeScale = Math.PI / 180 * 6378137 / Math.sqrt(curvature) * Math.cos(latitudeRadians);
const latitudeScale = Math.PI / 180 * 6378137 * (1 - eccentricitySquared) / curvature ** 1.5;
export function lujanToLocal(latitude: number, longitude: number): [number, number] {
  return [(longitude - LUJAN_POOL.longitude) * longitudeScale,
    -(latitude - LUJAN_POOL.latitude) * latitudeScale];
}
export function lujanToGeographic(x: number, z: number) {
  return { latitude: LUJAN_POOL.latitude - z / latitudeScale, longitude: LUJAN_POOL.longitude + x / longitudeScale };
}
export const LUJAN_LOCAL_BOUNDS = LUJAN_PLANT.bounds.map(p => lujanToLocal(Number(p.latitude), Number(p.longitude)));
export function isInsideLujan(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  let inside = false;
  for (let i = 0, j = LUJAN_LOCAL_BOUNDS.length - 1; i < LUJAN_LOCAL_BOUNDS.length; j = i++) {
    const [ax, az] = LUJAN_LOCAL_BOUNDS[j], [bx, bz] = LUJAN_LOCAL_BOUNDS[i];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 1e-6) return true;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
