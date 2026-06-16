import type { Asset, InspectionMission } from "../types";
import { ASSETS_STORAGE_KEY, MISSIONS_STORAGE_KEY } from "../constants";

export function loadStoredAssets() {
  try {
    const storedAssets = window.localStorage.getItem(ASSETS_STORAGE_KEY);
    if (!storedAssets) return [];
    return JSON.parse(storedAssets) as Asset[];
  } catch {
    return [];
  }
}

export function loadStoredMissions() {
  try {
    const storedMissions = window.localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!storedMissions) return [];
    return JSON.parse(storedMissions) as InspectionMission[];
  } catch {
    return [];
  }
}

