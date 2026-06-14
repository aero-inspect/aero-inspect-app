import type { InspectionMission } from "../types";

export const MOCK_MISSIONS: InspectionMission[] = [
  {
    id: 1,
    name: "Inspección Silo A1 - Enero 2026",
    assetId: 1,
    assetName: "Silo A1",
    status: "Finalizada",
    startedAt: "2026-01-15T09:00:00",
    finishedAt: "2026-01-15T11:30:00",
    routePoints: [
      { id: 1, latitude: "-35.140450", longitude: "-60.458550" },
      { id: 2, latitude: "-35.140500", longitude: "-60.458500" },
      { id: 3, latitude: "-35.140550", longitude: "-60.458450" },
      { id: 4, latitude: "-35.140500", longitude: "-60.458400" }
    ]
  },
  {
    id: 2,
    name: "Inspección Noria B2 - Enero 2026",
    assetId: 2,
    assetName: "Noria B2",
    status: "Finalizada",
    startedAt: "2026-01-16T13:00:00",
    finishedAt: "2026-01-16T15:00:00",
    routePoints: [
      { id: 1, latitude: "-35.140650", longitude: "-60.458350" },
      { id: 2, latitude: "-35.140700", longitude: "-60.458300" },
      { id: 3, latitude: "-35.140750", longitude: "-60.458250" }
    ]
  },
  {
    id: 3,
    name: "Inspección Cinta C1 - Enero 2026",
    assetId: 3,
    assetName: "Cinta C1",
    status: "Finalizada",
    startedAt: "2026-01-17T08:30:00",
    finishedAt: "2026-01-17T10:00:00",
    routePoints: [
      { id: 1, latitude: "-35.140550", longitude: "-60.458150" },
      { id: 2, latitude: "-35.140600", longitude: "-60.458100" },
      { id: 3, latitude: "-35.140650", longitude: "-60.458050" }
    ]
  },
  {
    id: 4,
    name: "Inspección Tubería D1 - Enero 2026",
    assetId: 4,
    assetName: "Tubería D1",
    status: "Finalizada",
    startedAt: "2026-01-18T10:00:00",
    finishedAt: "2026-01-18T12:00:00",
    routePoints: [
      { id: 1, latitude: "-35.140750", longitude: "-60.458450" },
      { id: 2, latitude: "-35.140800", longitude: "-60.458400" },
      { id: 3, latitude: "-35.140850", longitude: "-60.458350" }
    ]
  },
  {
    id: 5,
    name: "Inspección Techo E1 - Enero 2026",
    assetId: 5,
    assetName: "Techo E1",
    status: "Finalizada",
    startedAt: "2026-01-19T14:00:00",
    finishedAt: "2026-01-19T16:30:00",
    routePoints: [
      { id: 1, latitude: "-35.140500", longitude: "-60.458250" },
      { id: 2, latitude: "-35.140550", longitude: "-60.458200" },
      { id: 3, latitude: "-35.140600", longitude: "-60.458150" }
    ]
  },
  {
    id: 6,
    name: "Inspección General - Febrero 2026",
    assetId: 1,
    assetName: "Silo A1",
    status: "Pendiente",
    routePoints: [
      { id: 1, latitude: "-35.140450", longitude: "-60.458550" },
      { id: 2, latitude: "-35.140500", longitude: "-60.458500" },
      { id: 3, latitude: "-35.140550", longitude: "-60.458450" }
    ]
  }
];

// Made with Bob
