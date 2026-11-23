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

// Sin datos de demostración: los activos y misiones reales vienen del backend.
const demoAssets: Asset[] = [];
const demoMissions: InspectionMission[] = [];

