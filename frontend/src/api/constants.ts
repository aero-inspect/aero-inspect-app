import type { BackendAssetType } from "./types";

// Independiente de ASSET_TYPE_COLORS en src/constants/index.ts (que sigue usando los labels
// del modelo mock viejo). Esto mapea el enum real del backend.
//
// La paleta evita a propósito los colores que ya usan las acciones de un waypoint del plan
// (TAKEOFF verde, LAND rojo, STOP ámbar, y NAVIGATE en teal/marrón/azul — ver waypointIcons.ts y
// utils/waypointMovement.ts): SILO y NORIA usaban justo el rojo de LAND y el ámbar de STOP, y con
// los activos ahora visibles en el mismo mapa (PlanDraftMap) se confundían con esos marcadores.
export const BACKEND_ASSET_TYPE_COLORS: Record<BackendAssetType, string> = {
  SILO: "#4d4dc2",
  NORIA: "#6e40bf",
  CINTA_TRANSPORTADORA: "#9d40bf",
  TUBERIA: "#95bf40",
  TECHO: "#5f6672",
  SILO_FLOTANTE: "#bf40b3",
  CELDA: "#bf4084",
  SECADORA: "#60bf40",
  BANQUETA: "#303438"
};

export const BACKEND_ASSET_TYPE_LABELS: Record<BackendAssetType, string> = {
  SILO: "Silo",
  NORIA: "Noria",
  CINTA_TRANSPORTADORA: "Cinta transportadora",
  TUBERIA: "Tuberia",
  TECHO: "Techo",
  SILO_FLOTANTE: "Silo flotante",
  CELDA: "Celda",
  SECADORA: "Secadora",
  BANQUETA: "Banqueta"
};

