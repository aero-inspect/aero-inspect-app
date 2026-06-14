import type { AssetType } from "../types";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_TIME_MS = 15 * 60 * 1000;
export const ASSET_TYPES: AssetType[] = ["Silo", "Noria", "Cinta transportadora", "Tuberia", "Techo"];
export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  Silo: "#d94b4b",
  Noria: "#e7b416",
  "Cinta transportadora": "#8f5cc2",
  Tuberia: "#d8782c",
  Techo: "#5f6672"
};
export const DRONE_OPERATION_ROLES = ["Tecnico de Mantenimiento"];
export const ASSET_CONSULT_ROLES = ["Jefe de Planta", "Tecnico de Mantenimiento"];
export const ASSETS_STORAGE_KEY = "aeroinspect.assets";
export const MISSIONS_STORAGE_KEY = "aeroinspect.missions";

export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const SATELLITE_LAYER = MAPTILER_KEY
  ? {
      attribution: "Imagery MapTiler",
      maxNativeZoom: 22,
      maxZoom: 22,
      tileSize: 512,
      url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
      zoomOffset: -1
    }
  : MAPBOX_TOKEN
  ? {
      attribution: "Imagery Mapbox",
      maxNativeZoom: 22,
      maxZoom: 22,
      tileSize: 512,
      url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${MAPBOX_TOKEN}`,
      zoomOffset: -1
    }
  : {
      attribution: "Tiles Esri",
      maxNativeZoom: 19,
      maxZoom: 19,
      tileSize: 256,
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      zoomOffset: 0
    };
