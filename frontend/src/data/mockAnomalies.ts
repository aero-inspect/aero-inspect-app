import type { Anomaly } from "../types";

export const MOCK_ANOMALIES: Anomaly[] = [
  {
    id: 1,
    type: "Grieta",
    assetId: 1,
    assetName: "Silo A1",
    missionId: 1,
    missionName: "Inspección Silo A1 - Enero 2026",
    detectedAt: "2026-01-15T10:30:00",
    severity: "Alta",
    status: "Pendiente",
    imageUrl: "https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=800&h=600&fit=crop",
    description: "Grieta vertical de aproximadamente 2 metros en la pared norte del silo",
    location: "Pared norte, sector superior"
  },
  {
    id: 2,
    type: "Corrosión",
    assetId: 1,
    assetName: "Silo A1",
    missionId: 1,
    missionName: "Inspección Silo A1 - Enero 2026",
    detectedAt: "2026-01-15T10:45:00",
    severity: "Media",
    status: "Validada",
    imageUrl: "https://images.unsplash.com/photo-1565688534245-05d6b5be184a?w=800&h=600&fit=crop",
    description: "Corrosión superficial en estructura metálica de soporte",
    location: "Base del silo, estructura de soporte"
  },
  {
    id: 3,
    type: "Deformación",
    assetId: 2,
    assetName: "Noria B2",
    missionId: 2,
    missionName: "Inspección Noria B2 - Enero 2026",
    detectedAt: "2026-01-16T14:20:00",
    severity: "Alta",
    status: "Pendiente",
    imageUrl: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800&h=600&fit=crop",
    description: "Deformación visible en la estructura de la cinta transportadora",
    location: "Sección central de la noria"
  },
  {
    id: 4,
    type: "Filtración",
    assetId: 3,
    assetName: "Cinta C1",
    missionId: 3,
    missionName: "Inspección Cinta C1 - Enero 2026",
    detectedAt: "2026-01-17T09:15:00",
    severity: "Baja",
    status: "Descartada",
    imageUrl: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=600&fit=crop",
    description: "Posible filtración de material en junta de conexión",
    location: "Junta de conexión, sector este"
  },
  {
    id: 5,
    type: "Desprendimiento",
    assetId: 4,
    assetName: "Tubería D1",
    missionId: 4,
    missionName: "Inspección Tubería D1 - Enero 2026",
    detectedAt: "2026-01-18T11:30:00",
    severity: "Media",
    status: "Pendiente",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&h=600&fit=crop",
    description: "Desprendimiento de recubrimiento protector en sección de tubería",
    location: "Tubería principal, tramo 3"
  },
  {
    id: 6,
    type: "Grieta",
    assetId: 5,
    assetName: "Techo E1",
    missionId: 5,
    missionName: "Inspección Techo E1 - Enero 2026",
    detectedAt: "2026-01-19T15:45:00",
    severity: "Media",
    status: "Validada",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&h=600&fit=crop",
    description: "Grieta en estructura del techo, requiere monitoreo",
    location: "Techo principal, sector noroeste"
  },
  {
    id: 7,
    type: "Corrosión",
    assetId: 2,
    assetName: "Noria B2",
    missionId: 2,
    missionName: "Inspección Noria B2 - Enero 2026",
    detectedAt: "2026-01-16T14:35:00",
    severity: "Baja",
    status: "Pendiente",
    imageUrl: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=600&fit=crop",
    description: "Corrosión leve en pernos de fijación",
    location: "Sistema de fijación, múltiples puntos"
  },
  {
    id: 8,
    type: "Deformación",
    assetId: 1,
    assetName: "Silo A1",
    missionId: 1,
    missionName: "Inspección Silo A1 - Enero 2026",
    detectedAt: "2026-01-15T11:00:00",
    severity: "Baja",
    status: "Descartada",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&h=600&fit=crop",
    description: "Leve abolladura en panel lateral, sin compromiso estructural",
    location: "Panel lateral sur"
  }
];


