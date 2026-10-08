import type { BackendAsset, BackendMission } from "../api/types";

export function manualAssetOptions(mission: BackendMission | undefined, assets: BackendAsset[]) {
  const options = new Map<number, { idAsset: number; waypointId: string; label: string }>();
  for (const point of mission?.missionWaypoints ?? []) {
    if (point.idAsset === null || !(point.pointOfInterest || point.action === "STOP")) continue;
    if (options.has(point.idAsset)) continue;
    const asset = assets.find(item => item.idAsset === point.idAsset);
    options.set(point.idAsset, {
      idAsset: point.idAsset,
      waypointId: point.idMissionWaypoint,
      label: asset ? `${asset.name} · ${asset.code}` : point.name ?? `Activo #${point.idAsset}`
    });
  }
  return [...options.values()];
}
