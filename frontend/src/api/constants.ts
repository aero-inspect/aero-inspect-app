import type { BackendAssetType } from "./types";

// Independiente de ASSET_TYPE_COLORS en src/constants/index.ts (que sigue usando los labels
// del modelo mock viejo). Esto mapea el enum real del backend.
export const BACKEND_ASSET_TYPE_COLORS: Record<BackendAssetType, string> = {
  SILO: "#d94b4b",
  NORIA: "#e7b416",
  CINTA_TRANSPORTADORA: "#8f5cc2",
  TUBERIA: "#d8782c",
  TECHO: "#5f6672"
};

export const BACKEND_ASSET_TYPE_LABELS: Record<BackendAssetType, string> = {
  SILO: "Silo",
  NORIA: "Noria",
  CINTA_TRANSPORTADORA: "Cinta transportadora",
  TUBERIA: "Tuberia",
  TECHO: "Techo"
};

