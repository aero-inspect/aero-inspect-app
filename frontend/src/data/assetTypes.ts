import type { BackendAssetType } from "../api/types";
import type { Asset } from "../types";
import { LUJAN_PLANT, UTN_PLANT } from "./plants";
export const ASSET_TYPE_OPTIONS: Array<{value:BackendAssetType;label:Asset["type"]}> = [
  {value:"SILO",label:"Silo"}, {value:"NORIA",label:"Noria"},
  {value:"SILO_FLOTANTE",label:"Silo flotante"}, {value:"CELDA",label:"Celda"},
  {value:"TAMBOR_METALICO",label:"Tambor Metálico"}, {value:"ESTUFA",label:"Estufa"}, {value:"SECADORA",label:"Secadora"}, {value:"BANQUETA",label:"Banqueta"}
];
export function assetTypesForPlant(plantId:string) {
  return ASSET_TYPE_OPTIONS.filter(option=>(option.value==="ESTUFA" || option.value==="TAMBOR_METALICO") ? plantId===UTN_PLANT.id : option.value!=="BANQUETA" || (plantId===LUJAN_PLANT.id || plantId===UTN_PLANT.id));
}
