import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  MapPin,
  MoreVertical,
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
import { ASSET_TYPE_COLORS, ASSET_TYPES } from "../constants";
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
  onDeleteAsset,
  onRegisterAsset,
  onUpdateAsset,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onDeleteAsset: (assetId: number) => void;
  onRegisterAsset: () => void;
  onUpdateAsset: (asset: Asset) => void;
  plant: Plant;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, AssetStatus>>({});
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [typeFilters, setTypeFilters] = useState<AssetType[]>([]);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editImages, setEditImages] = useState<NonNullable<Asset["images"]>>([]);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const plantAssets = useMemo(() => assets.filter((asset) => asset.plantId === plant.id), [assets, plant.id]);

  const filteredAssets = useMemo(() => {
    return plantAssets.filter((asset) => {
      const matchesType = typeFilters.length === 0 || typeFilters.includes(asset.type);
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        asset.name.toLowerCase().includes(normalizedSearch) ||
        asset.type.toLowerCase().includes(normalizedSearch) ||
        asset.description.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [plantAssets, searchTerm, typeFilters]);

  useEffect(() => {
    if (selectedAssetId !== null && !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(null);
    }
  }, [filteredAssets, selectedAssetId]);

  const selectedAsset = selectedAssetId === null ? null : filteredAssets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedStatus = selectedAsset ? getAssetStatus(selectedAsset, statusOverrides) : "Operativo";
  const markers = filteredAssets.map((asset) => ({
    id: asset.id,
    latitude: asset.latitude,
    longitude: asset.longitude,
    label: asset.name,
    type: asset.type
  }));

  const stats = {
    total: plantAssets.length,
    operative: plantAssets.filter((asset) => getAssetStatus(asset, statusOverrides) === "Operativo").length,
    maintenance: plantAssets.filter((asset) => getAssetStatus(asset, statusOverrides) === "Mantenimiento").length,
    offline: plantAssets.filter((asset) => getAssetStatus(asset, statusOverrides) === "Fuera de servicio").length
  };

  const toggleTypeFilter = (type: AssetType) => {
    setTypeFilters((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  };

  const startEdit = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setEditName(asset.name);
    setEditImages(getAssetImages(asset));
  };

  const cancelEdit = () => {
    setEditingAssetId(null);
    setEditName("");
    setEditImages([]);
  };

  const saveEdit = () => {
    if (!selectedAsset || !editName.trim()) return;
    onUpdateAsset({
      ...selectedAsset,
      name: editName.trim(),
      images: editImages,
      imageName: editImages[0]?.name,
      imagePreview: editImages[0]?.preview
    });
    cancelEdit();
  };

  const addEditImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setEditImages((current) => [...current, { id: Date.now() + current.length, name: file.name, preview: String(reader.result ?? "") }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteAsset(deleteTarget.id);
    if (selectedAssetId === deleteTarget.id) setSelectedAssetId(null);
    setDeleteTarget(null);
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
        <div className="assets-type-filter">
          <button className="assets-type-filter-button" onClick={() => setIsTypeFilterOpen((current) => !current)} type="button">
            {typeFilters.length === 0 ? "Todos" : `Tipos: ${typeFilters.length}`}
            <ChevronDown size={14} />
          </button>
          {isTypeFilterOpen && (
            <div className="assets-type-filter-menu">
              <button className={typeFilters.length === 0 ? "active" : undefined} onClick={() => setTypeFilters([])} type="button">
                <span />
                Todos
              </button>
              {ASSET_TYPES.map((type) => (
                <button className={typeFilters.includes(type) ? "active" : undefined} key={type} onClick={() => toggleTypeFilter(type)} type="button">
                  <span style={{ "--asset-type-color": ASSET_TYPE_COLORS[type] } as CSSProperties} />
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
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
                    const status = getAssetStatus(asset, statusOverrides);
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
                          <div className="assets-row-actions">
                            <button aria-label={`Eliminar ${asset.name}`} className="assets-row-action" onClick={(event) => { event.stopPropagation(); setDeleteTarget(asset); }} type="button">
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                            <button aria-label={`Mas acciones de ${asset.name}`} className="assets-row-action" onClick={(event) => { event.stopPropagation(); setOpenActionId(openActionId === asset.id ? null : asset.id); }} type="button">
                              <MoreVertical size={15} aria-hidden="true" />
                            </button>
                            {openActionId === asset.id && (
                              <div className="asset-row-menu" onClick={(event) => event.stopPropagation()}>
                                <strong>Modificar estado</strong>
                                {(["Operativo", "Mantenimiento", "Fuera de servicio"] as AssetStatus[]).map((nextStatus) => (
                                  <button key={nextStatus} onClick={() => { setStatusOverrides((current) => ({ ...current, [asset.id]: nextStatus })); setOpenActionId(null); }} type="button">
                                    <span className={`assets-status ${STATUS_META[nextStatus].className}`}>{nextStatus}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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

            {editingAssetId === selectedAsset.id ? (
              <div className="asset-edit-panel">
                <label>
                  <span>Nombre</span>
                  <input maxLength={100} onChange={(event) => setEditName(event.target.value)} value={editName} />
                </label>
                <div className="asset-edit-files">
                  <span>Archivos</span>
                  <label className="asset-upload-button">
                    <Camera size={14} />
                    Subir imagen
                    <input accept="image/*" multiple onChange={(event) => addEditImages(event.target.files)} type="file" />
                  </label>
                  <div className="asset-edit-thumbs">
                    {editImages.map((image) => (
                      <div key={image.id}>
                        <img alt={image.name} src={image.preview} />
                        <button onClick={() => setEditImages((current) => current.filter((item) => item.id !== image.id))} type="button">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="assets-detail-list">
                <AssetDetailItem icon={<Warehouse size={15} />} label="Tipo" value={selectedAsset.type} />
                <AssetDetailItem icon={<MapPin size={15} />} label="Ubicacion" value={`${getAssetZone(selectedAsset)}\n${selectedAsset.latitude}, ${selectedAsset.longitude}`} />
                <AssetDetailItem icon={<Building2 size={15} />} label="Descripcion" value={selectedAsset.description || "Sin descripcion cargada."} />
                <AssetDetailItem icon={<CalendarIcon />} label="Fecha de registro" value="12/03/2026" />
                <AssetDetailItem icon={<CheckCircle2 size={15} />} label="Ultima inspeccion" value="28/05/2026" />
              </div>
            )}


            {editingAssetId !== selectedAsset.id && <div className="assets-detail-item" style={{ marginTop: "12px" }}>
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
            }

            <button className="assets-missions-link" type="button">
              Misiones asociadas
              <strong>3 misiones</strong>
              <ArrowRight size={14} aria-hidden="true" />
            </button>

            <div className="assets-detail-actions">
              {editingAssetId === selectedAsset.id ? (
                <>
                  <button className="assets-edit-button" onClick={saveEdit} type="button">
                    Guardar
                  </button>
                  <button className="assets-delete-button neutral" onClick={cancelEdit} type="button">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
              <button className="assets-edit-button" onClick={() => startEdit(selectedAsset)} type="button">
                <Pencil size={13} aria-hidden="true" />
                Editar activo
              </button>
              <button className="assets-delete-button" onClick={() => setDeleteTarget(selectedAsset)} type="button">
                <Trash2 size={13} aria-hidden="true" />
                Eliminar activo
              </button>
                </>
              )}
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

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="success-modal delete-confirm-modal" role="dialog" aria-modal="true">
            <div className="success-icon delete-confirm-icon">
              <CircleHelp size={24} aria-hidden="true" />
            </div>
            <h2>Eliminar activo</h2>
            <p>¿Estas seguro que deseas eliminar "{deleteTarget.name}"?</p>
            <div className="modal-actions">
              <button className="modal-link-button" onClick={() => setDeleteTarget(null)} type="button">Cancelar</button>
              <button className="register-button delete-confirm-button" onClick={confirmDelete} type="button">Si, eliminar</button>
            </div>
          </section>
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

function getAssetImages(asset: Asset): NonNullable<Asset["images"]> {
  const images: NonNullable<Asset["images"]> = [];

  asset.images?.forEach((image, index) => {
    const preview = image.preview;
    if (!preview) return;
    images.push({
      id: image.id ?? Date.now() + index,
      name: image.name ?? `Imagen ${index + 1}`,
      preview
    });
  });

  if (asset.imagePreview && !images.some((image) => image.preview === asset.imagePreview)) {
    images.push({
      id: Date.now() + images.length,
      name: asset.imageName ?? "Imagen del activo",
      preview: asset.imagePreview
    });
  }

  return images;
}

function getAssetStatus(asset: Asset, overrides: Record<number, AssetStatus>): AssetStatus {
  if (overrides[asset.id]) return overrides[asset.id];
  if (asset.status) return asset.status;
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

