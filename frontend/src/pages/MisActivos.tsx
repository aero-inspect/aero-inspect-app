import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Wrench,
  X
} from "lucide-react";
import type { Asset, Plant } from "../types";
import { LeafletSatelliteMap } from "../components/LeafletSatelliteMap";
import { AppTopActions } from "../components/AppTopActions";

type AssetStatus = "Activo" | "En mantenimiento" | "Fuera de servicio";
type AssetDetailRow = Asset & { displayName: string; displayType: string; displayStatus: AssetStatus; tone: "warning" | "ok" | "danger" };

const STATUS_ROWS: Array<{ status: AssetStatus; tone: "warning" | "ok" | "danger" }> = [
  { status: "En mantenimiento", tone: "warning" },
  { status: "Activo", tone: "ok" },
  { status: "Fuera de servicio", tone: "danger" }
];

const DESIGN_ROWS = [
  { name: "Silo Norte", type: "Silo" },
  { name: "Silo Norte", type: "Noria" },
  { name: "Silo Norte", type: "Cinta transportadora" }
];

export function MisActivosView({
  assets,
  onDeleteAsset,
  onRegisterAsset,
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
  const [createAsset, setCreateAsset] = useState(false);
  const [assetCreated, setAssetCreated] = useState(false);
  const [detailAsset, setDetailAsset] = useState<AssetDetailRow | null>(null);
  const [editAsset, setEditAsset] = useState<AssetDetailRow | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<AssetDetailRow | null>(null);

  const plantAssets = useMemo(() => assets.filter((asset) => asset.plantId === plant.id), [assets, plant.id]);
  const visibleAssets = useMemo<AssetDetailRow[]>(() => {
    const rows = plantAssets.slice(0, 3).map((asset, index) => ({
      ...asset,
      displayName: DESIGN_ROWS[index]?.name ?? asset.name,
      displayType: DESIGN_ROWS[index]?.type ?? asset.type,
      displayStatus: STATUS_ROWS[index]?.status ?? "Activo",
      tone: STATUS_ROWS[index]?.tone ?? "ok"
    }));

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return rows;
    return rows.filter((asset) =>
      asset.displayName.toLowerCase().includes(normalizedSearch) ||
      asset.displayType.toLowerCase().includes(normalizedSearch) ||
      asset.displayStatus.toLowerCase().includes(normalizedSearch)
    );
  }, [plantAssets, searchTerm]);

  const markers = plantAssets.map((asset) => ({
    id: asset.id,
    latitude: asset.latitude,
    longitude: asset.longitude,
    label: asset.name,
    type: asset.type
  }));

  return (
    <section className="assets-dashboard">
      <header className="assets-dashboard-header">
        <div>
          <h1>Mis Activos</h1>
          <p>Consultá y gestiona los activos gestionados en la planta</p>
        </div>
        <AppTopActions />
      </header>

      <div className="assets-dashboard-actions">
        <label className="assets-search assets-header-search">
          <Search size={14} aria-hidden="true" />
          <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar activo..." value={searchTerm} />
        </label>
        <button className="assets-new-button" onClick={() => setCreateAsset(true)} type="button">
          <Plus size={16} aria-hidden="true" />
          Nuevo Activo
        </button>
      </div>

      <section className="assets-stats-row" aria-label="Resumen de activos">
        <AssetStatCard icon={<Box size={24} />} label="Total de activos" tone="blue" value={3} />
        <AssetStatCard icon={<Settings size={24} />} label="Activos operativos" tone="green" value={1} />
        <AssetStatCard icon={<Wrench size={24} />} label="En mantenimiento" tone="amber" value={1} />
        <AssetStatCard icon={<AlertTriangle size={24} />} label="Fuera de servicio" tone="red" value={1} />
      </section>

      <section className="assets-main-layout">
        <section className="assets-list-card">
          <h2>Todas los activos</h2>
          <div className="assets-list-filters">
            <button className="assets-filter-pill active" type="button">Todas</button>
            <button className="assets-filter-select" type="button">
              Filtrar por tipo
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <button className="assets-filter-select" type="button">
              Filtrar por estado
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <label className="assets-search assets-list-search">
              <Search size={14} aria-hidden="true" />
              <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar activo..." value={searchTerm} />
            </label>
          </div>

          <div className="assets-list-table-wrap">
            {visibleAssets.map((asset) => (
              <article className={`assets-row ${asset.tone}`} key={asset.id}>
                <strong>{asset.displayName}</strong>
                <span>{asset.displayType}</span>
                <em>{asset.displayStatus}</em>
                <div className="assets-row-actions">
                  <button aria-label={`Ver ${asset.displayName}`} onClick={() => setDetailAsset(asset)} type="button">
                    <Eye size={16} aria-hidden="true" />
                  </button>
                  <button aria-label={`Eliminar ${asset.displayName}`} onClick={() => setDeleteAsset(asset)} type="button">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <footer className="assets-list-footer">
            <span>Mostrando 1 a 8 de 48 activos</span>
            <nav className="assets-pagination" aria-label="Paginación de activos">
              <button aria-label="Anterior" type="button"><ChevronLeft size={15} /></button>
              {[1, 2, 3, 4, 5].map((page) => (
                <button className={page === 1 ? "active" : undefined} key={page} type="button">{page}</button>
              ))}
              <button aria-label="Siguiente" type="button"><ChevronRight size={15} /></button>
            </nav>
          </footer>
        </section>

        <section className="assets-map-card" aria-label="Mapa de activos">
          <LeafletSatelliteMap markers={markers} plant={plant} />
        </section>
      </section>

      {detailAsset && (
        <div className="asset-detail-modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-detail-modal" role="dialog">
            <header className="asset-detail-modal-header">
              <div className="asset-detail-title-wrap">
                <span className="asset-detail-modal-icon">
                  <Box size={24} aria-hidden="true" />
                </span>
                <h2>{detailAsset.displayName}</h2>
              </div>
              <button aria-label="Cerrar detalle" className="asset-detail-close" onClick={() => setDetailAsset(null)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="asset-detail-modal-body">
              <div className="asset-detail-data">
                <AssetDetailField label="Tipo" value={detailAsset.displayType} />
                <AssetDetailField label="Ubicación" value="Planta Bragado" />
                <AssetDetailField label="Coordenadas" value="-35.140110, -60.458900" />
                <AssetDetailField label="Descripción" value="Silo principal para almacenamiento de granos." />
                <div className="asset-detail-divider" />
                <div className="asset-detail-field">
                  <span>Estado</span>
                  <strong className={`asset-detail-status ${detailAsset.tone}`}>{detailAsset.displayStatus}</strong>
                </div>
                <AssetDetailField label="Último mantenimiento" value="14/06/2026 · 11:30" />
                <AssetDetailField label="Código" value="SIL-001" />
              </div>

              <div className="asset-detail-image-area">
                <span>Imagen</span>
                <div className="asset-detail-photo" aria-label="Imagen de silos" />
                <p>Registro visual del activo seleccionado.</p>
              </div>
            </div>

            <footer className="asset-detail-modal-footer">
              <button
                className="asset-detail-edit-button"
                onClick={() => {
                  setEditAsset(detailAsset);
                  setDetailAsset(null);
                }}
                type="button"
              >
                <Pencil size={15} aria-hidden="true" />
                Editar activo
              </button>
              <button
                className="asset-detail-delete-button"
                onClick={() => {
                  setDeleteAsset(detailAsset);
                  setDetailAsset(null);
                }}
                type="button"
              >
                Eliminar activo
              </button>
            </footer>
          </section>
        </div>
      )}


      {createAsset && (
        <div className="asset-detail-modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-edit-modal asset-create-modal" role="dialog">
            <header className="asset-edit-modal-header">
              <div className="asset-edit-title-wrap">
                <span className="asset-detail-modal-icon">
                  <Box size={24} aria-hidden="true" />
                </span>
                <h2>Crear Activo</h2>
              </div>
              <button aria-label="Cerrar creación" className="asset-detail-close" onClick={() => setCreateAsset(false)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="asset-edit-modal-body">
              <div className="asset-edit-form-grid">
                <label className="asset-edit-field full">
                  <span>Nombre *</span>
                  <input aria-label="Nombre" />
                </label>

                <label className="asset-edit-field full">
                  <span>Tipo *</span>
                  <select defaultValue="">
                    <option value="">-</option>
                    <option>Silo</option>
                    <option>Noria</option>
                    <option>Cinta transportadora</option>
                  </select>
                </label>

                <label className="asset-edit-field full">
                  <span>Ubicacion *</span>
                  <input aria-label="Ubicación" />
                </label>

                <label className="asset-edit-field full">
                  <span>Estado *</span>
                  <select defaultValue="">
                    <option value="">-</option>
                    <option>En mantenimiento</option>
                    <option>Activo</option>
                    <option>Fuera de servicio</option>
                  </select>
                </label>

                <div className="asset-edit-field full">
                  <span>Coordenadas *</span>
                  <div className="asset-edit-coordinates">
                    <input aria-label="Latitud" />
                    <input aria-label="Longitud" />
                  </div>
                </div>

                <label className="asset-edit-field full">
                  <span>Ultimo mantenimiento*</span>
                  <div className="asset-edit-date-input">
                    <input defaultValue="-" />
                    <CalendarDays size={16} aria-hidden="true" />
                  </div>
                </label>
              </div>

              <div className="asset-edit-side">
                <div className="asset-edit-image-area asset-create-image-area">
                  <span>Imagen</span>
                  <button className="asset-create-upload" aria-label="Subir imagen" type="button">
                    <Upload size={24} aria-hidden="true" />
                  </button>
                  <p>Registro visual del activo seleccionado.</p>
                </div>

                <label className="asset-edit-field asset-edit-description">
                  <span>Descripcion</span>
                  <textarea aria-label="Descripción" />
                </label>
              </div>
            </div>

            <footer className="asset-edit-modal-footer">
              <label className="asset-edit-field asset-edit-code-bottom">
                <span>Codigo *</span>
                <input aria-label="Código" />
              </label>
              <div className="asset-edit-actions">
                <button className="asset-edit-cancel" onClick={() => setCreateAsset(false)} type="button">
                  Cancelar
                </button>
                <button
                  className="asset-edit-save"
                  onClick={() => {
                    onRegisterAsset();
                    setCreateAsset(false);
                    setAssetCreated(true);
                  }}
                  type="button"
                >
                  Guardar
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
      {assetCreated && (
        <div className="asset-detail-modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-created-modal" role="dialog">
            <span className="asset-created-icon" aria-hidden="true">
              <Check size={25} />
            </span>
            <h2>Activo Registrado</h2>
            <p>Ya esta disponible para futuras misiones e inspecciones</p>
            <div className="asset-created-actions">
              <button className="asset-created-back" onClick={() => setAssetCreated(false)} type="button">
                Volver
              </button>
              <button className="asset-created-view" onClick={() => setAssetCreated(false)} type="button">
                Ver Activos
              </button>
            </div>
          </section>
        </div>
      )}      {editAsset && (
        <div className="asset-detail-modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-edit-modal" role="dialog">
            <header className="asset-edit-modal-header">
              <div className="asset-edit-title-wrap">
                <span className="asset-detail-modal-icon">
                  <Box size={24} aria-hidden="true" />
                </span>
                <h2>Editar Activo</h2>
              </div>
              <button aria-label="Cerrar edición" className="asset-detail-close" onClick={() => setEditAsset(null)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="asset-edit-modal-body">
              <div className="asset-edit-form-grid">
                <label className="asset-edit-field full">
                  <span>Nombre *</span>
                  <input defaultValue={editAsset.displayName} />
                </label>

                <label className="asset-edit-field full">
                  <span>Tipo *</span>
                  <select defaultValue={editAsset.displayType}>
                    <option>Silo</option>
                    <option>Noria</option>
                    <option>Cinta transportadora</option>
                  </select>
                </label>

                <label className="asset-edit-field full">
                  <span>Ubicación *</span>
                  <input defaultValue="Planta Norte" />
                </label>

                <label className="asset-edit-field full">
                  <span>Estado *</span>
                  <select className="asset-edit-status-select" defaultValue={editAsset.displayStatus}>
                    <option>En mantenimiento</option>
                    <option>Activo</option>
                    <option>Fuera de servicio</option>
                  </select>
                </label>

                <div className="asset-edit-field full">
                  <span>Coordenadas *</span>
                  <div className="asset-edit-coordinates">
                    <input defaultValue="-35.140110" />
                    <input defaultValue="-60.458900" />
                  </div>
                </div>

                <label className="asset-edit-field full">
                  <span>Ultimo mantenimiento*</span>
                  <div className="asset-edit-date-input">
                    <input defaultValue="14/06/2026 · 11:30" />
                    <CalendarDays size={16} aria-hidden="true" />
                  </div>
                </label>
</div>

              <div className="asset-edit-side">
                <div className="asset-edit-image-area">
                  <span>Imagen</span>
                  <div className="asset-detail-photo" aria-label="Imagen de silos" />
                  <p>Registro visual del activo seleccionado.</p>
                </div>

                <label className="asset-edit-field asset-edit-description">
                  <span>Descripcion</span>
                  <textarea defaultValue="Silo principal para almacenamiento de granos." />
                </label>
              </div>
            </div>

            <footer className="asset-edit-modal-footer">
              <label className="asset-edit-field asset-edit-code-bottom">
                <span>Codigo *</span>
                <input defaultValue="SIL - 001" />
              </label>
              <div className="asset-edit-actions">
                <button className="asset-edit-cancel" onClick={() => setEditAsset(null)} type="button">
                  Cancelar
                </button>
                <button className="asset-edit-save" onClick={() => setEditAsset(null)} type="button">
                  Guardar
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
      {deleteAsset && (
        <div className="asset-detail-modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-delete-modal" role="dialog">
            <span className="asset-delete-icon" aria-hidden="true">
              <AlertTriangle size={31} />
            </span>
            <h2>Eliminar activo</h2>
            <p>
              ¿Está seguro de que desea eliminar {deleteAsset.displayName}?<br />
              Esta acción no se puede deshacer.
            </p>
            <div className="asset-delete-actions">
              <button className="asset-delete-cancel" onClick={() => setDeleteAsset(null)} type="button">
                Cancelar
              </button>
              <button
                className="asset-delete-confirm"
                onClick={() => {
                  onDeleteAsset(deleteAsset.id);
                  setDeleteAsset(null);
                }}
                type="button"
              >
                Eliminar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function AssetDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="asset-detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AssetStatCard({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: "blue" | "green" | "amber" | "red"; value: number }) {
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











