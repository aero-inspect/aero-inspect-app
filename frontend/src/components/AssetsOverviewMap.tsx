import { MapContainer, Marker, Popup, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { SATELLITE_LAYER } from "../constants";
import { MapClickHandler, MapSizeController, selectedMarkerIcon } from "./LeafletHelpers";
import { ASSET_TYPE_ICONS } from "./MissionPlanMap";
import { BACKEND_ASSET_TYPE_COLORS, BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import type { BackendAsset, BackendAssetType } from "../api/types";
import type { Plant } from "../types";

// Mismo estilo de marcador (icono por tipo, sobre un circulo de color) que
// MissionDetailRouteMap/MissionPlanMap usan para activos, para que el mapa de
// activos se vea igual de prolijo en todas las vistas donde se lo muestra
// (Home, Mis Activos) y no solo en el armado/monitoreo de misiones.
function createAssetIcon(type: BackendAssetType) {
  const IconComponent = ASSET_TYPE_ICONS[type];
  const iconSvg = renderToStaticMarkup(<IconComponent color="#ffffff" size={14} strokeWidth={2.4} />);

  return divIcon({
    className: "leaflet-readonly-asset-marker",
    html: `<span style="background:${BACKEND_ASSET_TYPE_COLORS[type]};">${iconSvg}</span>`,
    iconAnchor: [13, 13],
    iconSize: [26, 26]
  });
}

function AssetPopup({ asset }: { asset: BackendAsset }) {
  const TypeIcon = ASSET_TYPE_ICONS[asset.type];

  return (
    <div className="asset-popup">
      <div className="asset-popup-header">
        <span className="asset-popup-icon" style={{ background: BACKEND_ASSET_TYPE_COLORS[asset.type] }}>
          <TypeIcon color="#ffffff" size={15} strokeWidth={2.4} />
        </span>
        <div className="asset-popup-heading">
          <h3>{asset.name}</h3>
          <span className="asset-popup-type">{BACKEND_ASSET_TYPE_LABELS[asset.type]}</span>
        </div>
      </div>
    </div>
  );
}

export function AssetsOverviewMap({
  assets,
  plant,
  onSelect,
  selectedLocation
}: {
  assets: BackendAsset[];
  plant: Plant;
  onSelect?: (location: { latitude: string; longitude: string }) => void;
  selectedLocation?: { latitude: string; longitude: string };
}) {
  const center: [number, number] =
    assets.length > 0
      ? [
          assets.reduce((sum, asset) => sum + asset.latitude, 0) / assets.length,
          assets.reduce((sum, asset) => sum + asset.longitude, 0) / assets.length
        ]
      : [Number(plant.center.latitude), Number(plant.center.longitude)];

  return (
    <div className="leaflet-map-shell">
      <MapContainer center={center} className="leaflet-map" maxZoom={SATELLITE_LAYER.maxZoom} minZoom={14} scrollWheelZoom zoom={17} zoomControl>
        <MapSizeController center={center} />
        <TileLayer
          attribution={SATELLITE_LAYER.attribution}
          maxNativeZoom={SATELLITE_LAYER.maxNativeZoom}
          maxZoom={SATELLITE_LAYER.maxZoom}
          tileSize={SATELLITE_LAYER.tileSize}
          url={SATELLITE_LAYER.url}
          zoomOffset={SATELLITE_LAYER.zoomOffset}
        />

        {assets.map((asset) => (
          <Marker
            bubblingMouseEvents={false}
            icon={createAssetIcon(asset.type)}
            key={asset.idAsset}
            position={[asset.latitude, asset.longitude]}
          >
            <Tooltip className="leaflet-asset-tooltip" direction="top" offset={[0, -14]} permanent>
              {asset.name}
            </Tooltip>
            <Popup minWidth={200}>
              <AssetPopup asset={asset} />
            </Popup>
          </Marker>
        ))}

        {selectedLocation && (
          <Marker
            bubblingMouseEvents={false}
            icon={selectedMarkerIcon}
            position={[Number(selectedLocation.latitude), Number(selectedLocation.longitude)]}
            title="Punto seleccionado"
          />
        )}

        {onSelect && <MapClickHandler onSelect={onSelect} />}
      </MapContainer>
    </div>
  );
}
