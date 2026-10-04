import type { BackendAssetType } from "../api/types";
import type { Asset } from "../types";
import { LUJAN_PLANT } from "./plants";
export const ASSET_TYPE_OPTIONS: Array<{value:BackendAssetType;label:Asset["type"]}> = [
  {value:"SILO",label:"Silo"}, {value:"NORIA",label:"Noria"},
  {value:"SILO_FLOTANTE",label:"Silo flotante"}, {value:"CELDA",label:"Celda"},
  {value:"SECADORA",label:"Secadora"}, {value:"BANQUETA",label:"Banqueta"}
];
export function assetTypesForPlant(plantId:string) {
  return ASSET_TYPE_OPTIONS.filter(option=>option.value!=="BANQUETA" || plantId===LUJAN_PLANT.id);
}
