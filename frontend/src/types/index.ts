export type SessionUser = {
  name: string;
  role: string;
};

export type MockUser = SessionUser & {
  username: string;
  password: string;
  active: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
  profileImage?: string;
};

export type LockState = {
  attempts: number;
  lockedUntil: number | null;
};

export type AssetType = "Silo" | "Noria" | "Cinta transportadora" | "Tuberia" | "Techo";

export type AssetImage = {
  id: number;
  name: string;
  preview: string;
};

export type Asset = {
  id: number;
  name: string;
  type: AssetType;
  status?: "Operativo" | "Mantenimiento" | "Fuera de servicio";
  latitude: string;
  longitude: string;
  description: string;
  imageName?: string;
  imagePreview?: string;
  images?: AssetImage[];
  plantId: string;
};

export type MapMarker = {
  id: string | number;
  latitude: string;
  longitude: string;
  label: string;
  type: AssetType;
};

export type InspectionPoint = {
  id: number;
  latitude: string;
  longitude: string;
};

export type InspectionMission = {
  id: number;
  name: string;
  assetId: number;
  assetName: string;
  routePoints: InspectionPoint[];
  status?: "Pendiente" | "En ejecución" | "Finalizada" | "Cancelada";
  startedAt?: string;
  finishedAt?: string;
};

export type Plant = {
  id: string;
  name: string;
  province: string;
  center: {
    latitude: string;
    longitude: string;
  };
  bounds: Array<{
    latitude: string;
    longitude: string;
  }>;
};

export type AnomalyType = "Grieta" | "Corrosión" | "Deformación" | "Filtración" | "Desprendimiento";

export type SeverityLevel = "Baja" | "Media" | "Alta";

export type ValidationStatus = "Pendiente" | "Validada" | "Descartada";

export type Anomaly = {
  id: number;
  type: AnomalyType;
  assetId: number;
  assetName: string;
  missionId: number;
  missionName: string;
  detectedAt: string;
  severity: SeverityLevel;
  status: ValidationStatus;
  imageUrl: string;
  description: string;
  location?: string;
};

