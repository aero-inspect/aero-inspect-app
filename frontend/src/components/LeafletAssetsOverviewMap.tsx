import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin, X } from "lucide-react";
import { SATELLITE_LAYER } from "../constants";
import { MapClickHandler, MapSizeController, selectedMarkerIcon } from "./LeafletHelpers";
import { ASSET_TYPE_ICONS } from "./MissionPlanMap";
import { BACKEND_ASSET_TYPE_COLORS, BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import type { BackendAsset, BackendAssetStatus, BackendAssetType } from "../api/types";
import type { Plant } from "../types";

// Mismo criterio de mapeo/colores que MisActivos.tsx (backendStatusToDisplay/statusTone),
// repetido acá en chico porque el popup necesita el badge y no vale la pena acoplar
// este componente compartido (Home + Mis Activos) al modulo de la pagina de activos.
const ASSET_STATUS_INFO: Record<BackendAssetStatus, { label: string; tone: "ok" | "warning" | "danger" }> = {
  ACTIVE: { label: "Activo", tone: "ok" },
  MAINTENANCE: { label: "En mantenimiento", tone: "warning" },
  OUT_OF_SERVICE: { label: "Fuera de servicio", tone: "danger" }
};

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

// locationDetail viene completo (ej. "Planta de acopio, sector norte"); en el popup solo
// interesa el ultimo tramo, que es el que ubica al activo dentro de la planta.
function shortLocation(locationDetail: string) {
  const parts = locationDetail.split(",");
  return parts[parts.length - 1].trim();
}

function AssetPopup({ asset, onViewAsset }: { asset: BackendAsset; onViewAsset?: (idAsset: number) => void }) {
  const TypeIcon = ASSET_TYPE_ICONS[asset.type];
  const statusInfo = ASSET_STATUS_INFO[asset.status];
  const map = useMap();

  return (
    <div className="asset-popup asset-popup-rich">
      <button aria-label="Cerrar" className="asset-popup-close" onClick={() => map.closePopup()} type="button">
        <X size={13} strokeWidth={2.5} />
      </button>
      {asset.imageData && (
        <div className="asset-popup-photo-wrap">
          <img alt={asset.name} className="asset-popup-photo" src={asset.imageData} />
          <span aria-hidden="true" className="asset-popup-photo-scrim" />
          <span className={`asset-popup-status-badge ${statusInfo.tone}`}>{statusInfo.label}</span>
        </div>
      )}
      <div className="asset-popup-header">
        <span className="asset-popup-icon" style={{ background: BACKEND_ASSET_TYPE_COLORS[asset.type] }}>
          <TypeIcon color="#ffffff" size={15} strokeWidth={2.4} />
        </span>
        <div className="asset-popup-heading">
          <h3>{asset.name}</h3>
          <span className="asset-popup-type">
            {BACKEND_ASSET_TYPE_LABELS[asset.type]} · {asset.code}
          </span>
        </div>
        {!asset.imageData && <span className={`asset-popup-status-badge ${statusInfo.tone}`}>{statusInfo.label}</span>}
      </div>
      {(asset.locationDetail || asset.description) && (
        <div className="asset-popup-meta">
          {asset.locationDetail && (
            <p className="asset-popup-location">
              <MapPin aria-hidden="true" size={12} />
              {shortLocation(asset.locationDetail)}
            </p>
          )}
          {asset.description && <p className="asset-popup-description">{asset.description}</p>}
        </div>
      )}
      {onViewAsset && (
        <button className="asset-popup-view-button" onClick={() => onViewAsset(asset.idAsset)} type="button">
          Ver activo
        </button>
      )}
    </div>
  );
}

export function AssetsOverviewMap({
  assets,
  plant,
  onSelect,
  onViewAsset,
  selectedLocation
}: {
  assets: BackendAsset[];
  plant: Plant;
  onSelect?: (location: { latitude: string; longitude: string }) => void;
  onViewAsset?: (idAsset: number) => void;
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
            <Popup className="asset-popup-leaflet" maxWidth={240} minWidth={220}>
              <AssetPopup asset={asset} onViewAsset={onViewAsset} />
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
