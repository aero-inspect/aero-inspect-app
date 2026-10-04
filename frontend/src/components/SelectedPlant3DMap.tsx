import type { ComponentProps } from "react";
import { BragadoPlant3DMap } from "./BragadoPlant3DMap";
import { LujanPlant3DMap } from "./LujanPlant3DMap";
import { useSelectedPlant } from "../data/PlantContext";
import { LUJAN_PLANT } from "../data/plants";
export function SelectedPlant3DMap(props: ComponentProps<typeof BragadoPlant3DMap>) {
  const plant = useSelectedPlant();
  return plant.id === LUJAN_PLANT.id ? <LujanPlant3DMap {...props} /> : <BragadoPlant3DMap {...props} />;
}
