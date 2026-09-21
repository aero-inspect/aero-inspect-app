import type { BackendAsset, BackendFlightPlan } from "../api/types";
import type { Plant } from "../types";
import { BRAGADO_PLANT, LUJAN_PLANT } from "./plants";

// Compatibility layer until the API exposes plant IDs. Luján is identified by
// its geographic location; unlocated legacy data retains its Bragado ownership.
export function locationPlantId(latitude: number, longitude: number): string {
  const lat = Number(LUJAN_PLANT.center.latitude), lon = Number(LUJAN_PLANT.center.longitude);
  const distance = Math.hypot((latitude-lat)*111320,(longitude-lon)*111320*Math.cos(lat*Math.PI/180));
  return Number.isFinite(distance) && distance <= 500 ? LUJAN_PLANT.id : BRAGADO_PLANT.id;
}
export function assetBelongsToPlant(asset: Pick<BackendAsset,"latitude"|"longitude">, plant: Plant) {
  return locationPlantId(asset.latitude,asset.longitude) === plant.id;
}
export function planBelongsToPlant(plan: BackendFlightPlan, assets: BackendAsset[], plant: Plant) {
  if (plan.route.length) return plan.route.some(point => locationPlantId(point.latitude,point.longitude) === plant.id);
  const linked = assets.filter(asset => plan.assetIds.includes(asset.idAsset));
  return linked.length ? linked.some(asset => assetBelongsToPlant(asset,plant)) : plant.id === BRAGADO_PLANT.id;
}
