import type { BackendAsset } from "../api/types";
import type { Plant } from "../types";
import { BragadoPlant3DMap, type MapFilters } from "./BragadoPlant3DMap";
import { AssetsOverviewMap as LeafletAssetsOverviewMap } from "./LeafletAssetsOverviewMap";

export function AssetsOverviewMap({
  assets,
  plant,
  onSelect,
  onViewAsset,
  selectedLocation,
  filters,
  focusedAssetCode
}: {
  assets: BackendAsset[];
  plant: Plant;
  onSelect?: (location: { latitude: string; longitude: string }) => void;
  onViewAsset?: (idAsset: number) => void;
  selectedLocation?: { latitude: string; longitude: string };
  filters?: MapFilters;
  focusedAssetCode?: string | null;
}) {
  if (onSelect || selectedLocation) {
    return (
      <LeafletAssetsOverviewMap
        assets={assets}
        onSelect={onSelect}
        onViewAsset={onViewAsset}
        plant={plant}
        selectedLocation={selectedLocation}
      />
    );
  }

  // Fallback preservado: LeafletAssetsOverviewMap contiene el mapa satelital anterior.
  // Para volver temporalmente al mapa viejo en estas vistas, reemplazar la linea de abajo por:
  // return <LeafletAssetsOverviewMap assets={assets} onViewAsset={onViewAsset} plant={plant} />;
  return <BragadoPlant3DMap assets={assets} onViewAsset={onViewAsset} filters={filters} focusedAssetCode={focusedAssetCode} />;
}
