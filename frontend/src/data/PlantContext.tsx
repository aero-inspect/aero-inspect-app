import { createContext, useContext } from "react";
import { BRAGADO_PLANT } from "./plants";
export const PlantContext = createContext(BRAGADO_PLANT);
export const useSelectedPlant = () => useContext(PlantContext);
