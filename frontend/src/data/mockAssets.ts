import type { Asset } from "../types";

export const MOCK_ASSETS: Asset[] = [
  {
    id: 1,
    name: "Silo A1",
    type: "Silo",
    latitude: "-35.140500",
    longitude: "-60.458500",
    description: "Silo principal de almacenamiento de granos, capacidad 5000 toneladas",
    plantId: "planta-principal"
  },
  {
    id: 2,
    name: "Noria B2",
    type: "Noria",
    latitude: "-35.140700",
    longitude: "-60.458300",
    description: "Noria de elevación para transporte vertical de granos",
    plantId: "planta-principal"
  },
  {
    id: 3,
    name: "Cinta C1",
    type: "Cinta transportadora",
    latitude: "-35.140600",
    longitude: "-60.458100",
    description: "Cinta transportadora principal, longitud 150 metros",
    plantId: "planta-principal"
  },
  {
    id: 4,
    name: "Tubería D1",
    type: "Tuberia",
    latitude: "-35.140800",
    longitude: "-60.458400",
    description: "Tubería de transporte neumático de granos",
    plantId: "planta-principal"
  },
  {
    id: 5,
    name: "Techo E1",
    type: "Techo",
    latitude: "-35.140550",
    longitude: "-60.458200",
    description: "Techo de nave de almacenamiento principal",
    plantId: "planta-principal"
  }
];


