import type { Asset, InspectionMission } from "../types";
import { ASSETS_STORAGE_KEY, MISSIONS_STORAGE_KEY } from "../constants";

export function loadStoredAssets() {
  try {
    const storedAssets = window.localStorage.getItem(ASSETS_STORAGE_KEY);
    if (!storedAssets) return demoAssets;
    const parsed = JSON.parse(storedAssets) as Asset[];
    return parsed.length ? parsed : demoAssets;
  } catch {
    return [];
  }
}

export function loadStoredMissions() {
  try {
    const storedMissions = window.localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!storedMissions) return demoMissions;
    const parsed = JSON.parse(storedMissions) as InspectionMission[];
    return parsed.length ? parsed : demoMissions;
  } catch {
    return [];
  }
}

const demoAssets: Asset[] = [
  { id: 9101, name: "Banqueta Espacio 1", type: "Banqueta", status: "Activo", latitude: "-34.65840", longitude: "-58.46780", description: "Banqueta de cemento para inspección visual", locationDetail: "UTN Lugano · Espacio 1", plantId: "utn-lugano" },
  { id: 9102, name: "Banqueta Espacio 2", type: "Banqueta", status: "Activo", latitude: "-34.65834", longitude: "-58.46772", description: "Banqueta de cemento para inspección visual", locationDetail: "UTN Lugano · Espacio 2", plantId: "utn-lugano" }
];
const demoMissions: InspectionMission[] = [{ id: 9201, name: "Recorrido UTN Lugano", assetId: 9101, assetName: "Banqueta Espacio 1", routePoints: [{ id: 1, latitude: "-34.65840", longitude: "-58.46780" }, { id: 2, latitude: "-34.65846", longitude: "-58.46772" }], status: "Pendiente" }];

