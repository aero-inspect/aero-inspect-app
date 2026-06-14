import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  MapPin,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse,
  Wrench,
  X
} from "lucide-react";
import type { Asset, AssetType, Plant } from "../types";
import { ASSET_TYPE_COLORS } from "../constants";
import { LeafletSatelliteMap } from "../components/LeafletSatelliteMap";
import { AppTopActions } from "../components/AppTopActions";

type AssetStatus = "Operativo" | "Mantenimiento" | "Fuera de servicio";

const STATUS_META: Record<AssetStatus, { className: string; label: string }> = {
  Operativo: { className: "ok", label: "Operativo" },
  Mantenimiento: { className: "warning", label: "Mantenimiento" },
  "Fuera de servicio": { className: "danger", label: "Fuera de servicio" }
};

export function MisActivosView({
  assets,
  onRegisterAsset,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onRegisterAsset: () => void;
  onUpdateAsset: (asset: Asset) => void;
  plant: Plant;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const plantAssets = useMemo(() => assets.filter((asset) => asset.plantId === plant.id), [assets, plant.id]);

  const filteredAssets = useMemo(() => {
    return plantAssets.filter((asset) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        asset.name.toLowerCase().includes(normalizedSearch) ||
        asset.type.toLowerCase().includes(normalizedSearch) ||
        asset.description.toLowerCase().includes(normalizedSearch);

      return matchesSearch;
    });
  }, [plantAssets, searchTerm]);

  useEffect(() => {
    if (selectedAssetId !== null && !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(null);
    }
  }, [filteredAssets, selectedAssetId]);

  const selectedAsset = selectedAssetId === null ? null : filteredAssets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedStatus = selectedAsset ? getAssetStatus(selectedAsset) : "Operativo";
  const markers = filteredAssets.map((asset) => ({
    id: asset.id,
    latitude: asset.latitude,
    longitude: asset.longitude,
    label: asset.name,
    type: asset.type
  }));

  const stats = {
    total: plantAssets.length,
    operative: plantAssets.filter((asset) => getAssetStatus(asset) === "Operativo").length,
    maintenance: plantAssets.filter((asset) => getAssetStatus(asset) === "Mantenimiento").length,
    offline: plantAssets.filter((asset) => getAssetStatus(asset) === "Fuera de servicio").length
  };

  return (
    <section className="assets-dashboard">
      <header className="assets-dashboard-header">
        <div>
          <h1>Mis activos</h1>
          <p>Consulta y gestiona los activos registrados en la planta.</p>
        </div>
        <AppTopActions />
      </header>

      <div className="assets-dashboard-actions">
        <label className="assets-search">
          <Search size={15} aria-hidden="true" />
          <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar activo..." value={searchTerm} />
        </label>

        <button className="assets-new-button" onClick={onRegisterAsset} type="button">
          <Plus size={16} aria-hidden="true" />
          Nuevo activo
        </button>
      </div>

      <section className="assets-stats-row" aria-label="Resumen de activos">
        <AssetStatCard icon={<PackagePlus size={20} />} label="Total de activos" tone="green" value={stats.total} />
        <AssetStatCard icon={<CheckCircle2 size={20} />} label="Activos operativos" tone="green" value={stats.operative} />
        <AssetStatCard icon={<Wrench size={20} />} label="En mantenimiento" tone="amber" value={stats.maintenance} />
        <AssetStatCard icon={<AlertTriangle size={20} />} label="Fuera de servicio" tone="red" value={stats.offline} />
      </section>

      <section className={selectedAsset ? "assets-main-layout has-detail" : "assets-main-layout"}>
        <section className="assets-list-card">
          <div className="assets-list-header">
            <h2>Lista de activos</h2>
            <button type="button">
            </button>
          </div>

          {plantAssets.length === 0 ? (
            <p className="assets-empty-state">No hay activos disponibles.</p>
          ) : filteredAssets.length === 0 ? (
            <p className="assets-empty-state">No hay activos disponibles para la busqueda seleccionada.</p>
          ) : (
            <div className="assets-list-table-wrap">
              <table className="assets-list-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Ubicacion</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => {
                    const status = getAssetStatus(asset);
                    const statusMeta = STATUS_META[status];
                    const isSelected = selectedAsset?.id === asset.id;

                    return (
                      <tr className={isSelected ? "selected" : undefined} key={asset.id} onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}>
                        <td>
                          <div className="assets-name-cell">
                            <strong>{asset.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="assets-type-cell">
                            <span style={{ "--asset-type-color": ASSET_TYPE_COLORS[asset.type] } as CSSProperties} />
                            {asset.type}
                          </span>
                        </td>
                        <td>
                          <span className={`assets-status ${statusMeta.className}`}>{statusMeta.label}</span>
                        </td>
                        <td>
                          <span className="assets-zone">
                            <MapPin size={12} aria-hidden="true" />
                            {getAssetZone(asset)}
                          </span>
                        </td>
                        <td>
                          <button aria-label={`Eliminar ${asset.name}`} className="assets-row-action" onClick={(event) => event.stopPropagation()} type="button">
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <footer className="assets-list-footer">
            <div className="assets-pagination">
              <button type="button" aria-label="Anterior">{"<"}</button>
              <button className="active" type="button">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button" aria-label="Siguiente">{">"}</button>
            </div>
            <span>
              Mostrando 1 - {Math.min(filteredAssets.length, 8)} de {plantAssets.length} activos
            </span>
          </footer>
        </section>

        <section className="assets-map-card">
          <div className="assets-map-tabs">
            <button type="button">Mapa</button>
            <button className="active" type="button">Satelite</button>
          </div>
          <LeafletSatelliteMap markers={markers} plant={plant} />
        </section>

        {selectedAsset && (
          <aside className="assets-detail-card">
            <div className="assets-detail-top">
              <div>
                <h2>{selectedAsset.name}</h2>
                <span className={`assets-status ${STATUS_META[selectedStatus].className}`}>{STATUS_META[selectedStatus].label}</span>
              </div>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setSelectedAssetId(null)}>
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="assets-detail-list">
              <AssetDetailItem icon={<Warehouse size={15} />} label="Tipo" value={selectedAsset.type} />
              <AssetDetailItem icon={<MapPin size={15} />} label="Ubicacion" value={`${getAssetZone(selectedAsset)}\n${selectedAsset.latitude}, ${selectedAsset.longitude}`} />
              <AssetDetailItem icon={<Building2 size={15} />} label="Descripcion" value={selectedAsset.description || "Sin descripcion cargada."} />
              <AssetDetailItem icon={<CalendarIcon />} label="Fecha de registro" value="12/03/2026" />
              <AssetDetailItem icon={<CheckCircle2 size={15} />} label="Ultima inspeccion" value="28/05/2026" />
            </div>


            <div className="assets-detail-item" style={{ marginTop: "12px" }}>
                <Camera size={15} />
                <div>
                  <span>Archivos</span>
                  
                  {(selectedAsset.images?.[0]?.preview || selectedAsset.imagePreview) ? (
                  <p>
                    <button className="view-images-btn" onClick={() => setIsImageModalOpen(true)} type="button">
                      Ver imágenes
                    </button>
                  </p>
                  ) : (
                    <p>Sin imágenes adjuntas</p>
                  )}
                </div>
              </div>

            <button className="assets-missions-link" type="button">
              Misiones asociadas
              <strong>3 misiones</strong>
              <ArrowRight size={14} aria-hidden="true" />
            </button>

            <div className="assets-detail-actions">
              <button className="assets-edit-button" type="button">
                <Pencil size={13} aria-hidden="true" />
                Editar activo
              </button>
              <button className="assets-delete-button" type="button">
                <Trash2 size={13} aria-hidden="true" />
                Eliminar activo
              </button>
            </div>
          </aside>
        )}
      </section>

      {isImageModalOpen && selectedAsset && (selectedAsset.images?.[0]?.preview || selectedAsset.imagePreview) && (
        <div className="image-modal-backdrop" onClick={() => setIsImageModalOpen(false)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-actions">
              <button onClick={() => setIsImageModalOpen(false)} type="button" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <img 
              src={selectedAsset.images?.[0]?.preview ?? selectedAsset.imagePreview} 
              alt={`Foto de ${selectedAsset.name}`} 
            />
          </div>
        </div>
      )}

    </section>
  );
}

function AssetStatCard({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: "green" | "amber" | "red"; value: number }) {
  return (
    <article className="assets-stat-card">
      <span className={`assets-stat-icon ${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}


function AssetDetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="assets-detail-item">
      {icon}
      <div>
        <span>{label}</span>
        {value.split("\n").map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function getAssetStatus(asset: Asset): AssetStatus {
  if (asset.name.toLowerCase().includes("sur") || asset.id % 7 === 0) return "Fuera de servicio";
  if (asset.type === "Tuberia" || asset.id % 4 === 0) return "Mantenimiento";
  return "Operativo";
}

function getAssetZone(asset: Asset) {
  if (asset.name.toLowerCase().includes("norte")) return "Sector Norte";
  if (asset.name.toLowerCase().includes("sur")) return "Sector Sur";
  if (asset.name.toLowerCase().includes("este") || asset.type === "Cinta transportadora") return "Sector Este";
  if (asset.name.toLowerCase().includes("oeste") || asset.type === "Tuberia") return "Sector Oeste";
  return "Sector Central";
}

function getAssetIcon(type: AssetType) {
  if (type === "Silo") return "S";
  if (type === "Noria") return "N";
  if (type === "Cinta transportadora") return "C";
  if (type === "Tuberia") return "T";
  return "Te";
}
