import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
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
import type { BackendAsset, BackendAssetStatus, BackendAssetType } from "../api/types";
import { createAsset as createBackendAsset, deleteAsset as deleteBackendAsset, getAssets } from "../api/client";
import { AssetsOverviewMap } from "../components/AssetsOverviewMap";
import { AppTopActions } from "../components/AppTopActions";

type AssetStatus = "Activo" | "En mantenimiento" | "Fuera de servicio";
type AssetDetailRow = Asset & { displayName: string; displayType: string; displayStatus: AssetStatus; tone: "warning" | "ok" | "danger" };

type AssetFormState = {
  name: string;
  type: BackendAssetType | "";
  locationDetail: string;
  status: BackendAssetStatus | "";
  latitude: string;
  longitude: string;
  lastMaintenanceAt: string;
  code: string;
  description: string;
  imageName: string | null;
  imageData: string | null;
};

const EMPTY_FORM: AssetFormState = {
  name: "",
  type: "",
  locationDetail: "",
  status: "",
  latitude: "",
  longitude: "",
  lastMaintenanceAt: "",
  code: "",
  description: "",
  imageName: null,
  imageData: null
};

const ASSET_TYPE_OPTIONS: Array<{ value: BackendAssetType; label: Asset["type"] }> = [
  { value: "SILO", label: "Silo" },
  { value: "NORIA", label: "Noria" },
  { value: "CINTA_TRANSPORTADORA", label: "Cinta transportadora" },
  { value: "TUBERIA", label: "Tuberia" },
  { value: "TECHO", label: "Techo" }
];

const ASSET_STATUS_OPTIONS: Array<{ value: BackendAssetStatus; label: AssetStatus }> = [
  { value: "MAINTENANCE", label: "En mantenimiento" },
  { value: "ACTIVE", label: "Activo" },
  { value: "OUT_OF_SERVICE", label: "Fuera de servicio" }
];

function backendTypeToDisplay(type: BackendAssetType) {
  return ASSET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Silo";
}

function backendStatusToDisplay(status: BackendAssetStatus): AssetStatus {
  return ASSET_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Activo";
}

function statusTone(status: AssetStatus): "warning" | "ok" | "danger" {
  if (status === "En mantenimiento") return "warning";
  if (status === "Fuera de servicio") return "danger";
  return "ok";
}

function backendAssetToAsset(asset: BackendAsset): AssetDetailRow {
  const displayStatus = backendStatusToDisplay(asset.status);
  const displayType = backendTypeToDisplay(asset.type);
  return {
    id: asset.idAsset,
    name: asset.name,
    type: displayType,
    status: displayStatus,
    latitude: String(asset.latitude),
    longitude: String(asset.longitude),
    description: asset.description ?? "",
    code: asset.code,
    locationDetail: asset.locationDetail ?? "",
    createdAt: asset.createdAt ?? undefined,
    lastMaintenanceAt: asset.lastMaintenanceAt ?? undefined,
    imageName: asset.imageName ?? undefined,
    imagePreview: asset.imageData ?? undefined,
    plantId: "planta-principal",
    displayName: asset.name,
    displayType,
    displayStatus,
    tone: statusTone(displayStatus)
  };
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export function MisActivosView({
  assets: fallbackAssets,
  onDeleteAsset,
  selectedAssetId,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onDeleteAsset: (assetId: number) => void;
  onRegisterAsset: () => void;
  onUpdateAsset: (asset: Asset) => void;
  selectedAssetId?: number | null;
  plant: Plant;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Todos" | Asset["type"]>("Todos");
  const [statusFilter, setStatusFilter] = useState<"Todos" | AssetStatus>("Todos");
  const [openFilter, setOpenFilter] = useState<"type" | "status" | null>(null);
  const [openAssetFormSelect, setOpenAssetFormSelect] = useState<"create-type" | "create-status" | "edit-type" | "edit-status" | null>(null);
  const [createAsset, setCreateAsset] = useState(false);
  const [assetCreated, setAssetCreated] = useState(false);
  const [detailAsset, setDetailAsset] = useState<AssetDetailRow | null>(null);
  const [editAsset, setEditAsset] = useState<AssetDetailRow | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<AssetDetailRow | null>(null);
  const [backendAssets, setBackendAssets] = useState<BackendAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const [isCoordinatePickerOpen, setIsCoordinatePickerOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: string; longitude: string } | undefined>();

  const loadAssets = () => {
    setLoadError(null);
    getAssets()
      .then(setBackendAssets)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los activos."));
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const plantAssets = useMemo<AssetDetailRow[]>(() => {
    if (backendAssets) return backendAssets.map(backendAssetToAsset);
    return fallbackAssets
      .filter((asset) => asset.plantId === plant.id)
      .map((asset) => {
        const displayStatus = asset.status ?? "Activo";
        return {
          ...asset,
          displayName: asset.name,
          displayType: asset.type,
          displayStatus,
          tone: statusTone(displayStatus)
        };
      });
  }, [backendAssets, fallbackAssets, plant.id]);

  const visibleAssets = useMemo<AssetDetailRow[]>(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return plantAssets.filter((asset) =>
      (typeFilter === "Todos" || asset.displayType === typeFilter) &&
      (statusFilter === "Todos" || asset.displayStatus === statusFilter) &&
      (!normalizedSearch ||
        asset.displayName.toLowerCase().includes(normalizedSearch) ||
        asset.displayType.toLowerCase().includes(normalizedSearch) ||
        asset.displayStatus.toLowerCase().includes(normalizedSearch))
    );
  }, [plantAssets, searchTerm, statusFilter, typeFilter]);

  const totals = {
    all: plantAssets.length,
    active: plantAssets.filter((asset) => asset.displayStatus === "Activo").length,
    maintenance: plantAssets.filter((asset) => asset.displayStatus === "En mantenimiento").length,
    outOfService: plantAssets.filter((asset) => asset.displayStatus === "Fuera de servicio").length
  };

  useEffect(() => {
    if (selectedAssetId == null || !plantAssets.length) return;
    const selectedAsset = plantAssets.find((asset) => asset.id === selectedAssetId);
    if (selectedAsset) setDetailAsset(selectedAsset);
  }, [plantAssets, selectedAssetId]);

  const createTypeLabel = form.type
    ? ASSET_TYPE_OPTIONS.find((option) => option.value === form.type)?.label ?? "-"
    : "-";
  const createStatusLabel = form.status
    ? ASSET_STATUS_OPTIONS.find((option) => option.value === form.status)?.label ?? "-"
    : "-";

  const updateForm = (field: keyof AssetFormState, value: string | null) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectedFormLocation = form.latitude && form.longitude
    ? { latitude: form.latitude, longitude: form.longitude }
    : undefined;

  const openCoordinatePicker = () => {
    setPendingLocation(selectedFormLocation);
    setIsCoordinatePickerOpen(true);
  };

  const confirmCoordinates = () => {
    if (!pendingLocation) return;
    setForm((current) => ({
      ...current,
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude
    }));
    setIsCoordinatePickerOpen(false);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        imageName: file.name,
        imageData: typeof reader.result === "string" ? reader.result : null
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAsset = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.type || !form.status || !form.locationDetail.trim() || !form.latitude.trim() || !form.longitude.trim()) {
      setSaveError("Completá los campos obligatorios.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        type: form.type,
        status: form.status,
        locationDetail: form.locationDetail.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        lastMaintenanceAt: form.lastMaintenanceAt ? new Date(form.lastMaintenanceAt).toISOString() : null,
        imageName: form.imageName,
        imageData: form.imageData,
        description: form.description.trim() || null
      };
      await createBackendAsset(payload);
      setForm(EMPTY_FORM);
      setCreateAsset(false);
      setAssetCreated(true);
      loadAssets();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo crear el activo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async (asset: AssetDetailRow) => {
    try {
      await deleteBackendAsset(asset.id);
      onDeleteAsset(asset.id);
      setDeleteAsset(null);
      loadAssets();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo eliminar el activo.");
    }
  };

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
        <AssetStatCard icon={<Box size={24} />} label="Total de activos" tone="blue" value={totals.all} />
        <AssetStatCard icon={<Settings size={24} />} label="Activos operativos" tone="green" value={totals.active} />
        <AssetStatCard icon={<Wrench size={24} />} label="En mantenimiento" tone="amber" value={totals.maintenance} />
        <AssetStatCard icon={<AlertTriangle size={24} />} label="Fuera de servicio" tone="red" value={totals.outOfService} />
      </section>

      {loadError && <p className="mission-empty">{loadError}</p>}

      <section className="assets-main-layout">
        <section className="assets-list-card">
          <h2>Todas los activos</h2>
          <div className="assets-list-filters">
            <button
              className={typeFilter === "Todos" && statusFilter === "Todos" ? "assets-filter-pill active" : "assets-filter-pill"}
              onClick={() => {
                setTypeFilter("Todos");
                setStatusFilter("Todos");
                setOpenFilter(null);
              }}
              type="button"
            >
              Todos
            </button>
            <div className={typeFilter === "Todos" ? "assets-filter-select" : "assets-filter-select selected"}>
              <button onClick={() => setOpenFilter((current) => current === "type" ? null : "type")} type="button">
                {typeFilter === "Todos" ? "Filtrar por tipo" : typeFilter}
              </button>
              <ChevronDown size={14} aria-hidden="true" />
              {openFilter === "type" && (
                <div className="assets-filter-menu">
                  {ASSET_TYPE_OPTIONS.map((option) => (
                    <button
                      className={typeFilter === option.label ? "selected" : undefined}
                      key={option.value}
                      onClick={() => {
                        setTypeFilter(option.label);
                        setOpenFilter(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={statusFilter === "Todos" ? "assets-filter-select" : "assets-filter-select selected"}>
              <button onClick={() => setOpenFilter((current) => current === "status" ? null : "status")} type="button">
                {statusFilter === "Todos" ? "Filtrar por estado" : statusFilter}
              </button>
              <ChevronDown size={14} aria-hidden="true" />
              {openFilter === "status" && (
                <div className="assets-filter-menu">
                {ASSET_STATUS_OPTIONS.map((option) => (
                  <button
                    className={statusFilter === option.label ? "selected" : undefined}
                    key={option.value}
                    onClick={() => {
                      setStatusFilter(option.label);
                      setOpenFilter(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
                </div>
              )}
            </div>
            <label className="assets-search assets-list-search">
              <Search size={14} aria-hidden="true" />
              <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar activo..." value={searchTerm} />
            </label>
          </div>

          <div className="assets-list-table-wrap">
            {backendAssets === null && !loadError && <p className="mission-empty">Cargando activos...</p>}
            {backendAssets !== null && visibleAssets.length === 0 && (
              <p className="mission-empty">
                {plantAssets.length === 0
                  ? 'No hay activos creados todavia. Empeza por crear uno desde "Nuevo Activo".'
                  : "No hay activos que coincidan con el filtro seleccionado."}
              </p>
            )}
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
            <span>
              {plantAssets.length === 0 ? "Mostrando 0 de 0 activos" : `Mostrando ${visibleAssets.length} de ${plantAssets.length} activos`}
            </span>
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
          <AssetsOverviewMap assets={backendAssets ?? []} plant={plant} />
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
                <AssetDetailField label="Ubicación" value={detailAsset.locationDetail || "-"} />
                <AssetDetailField label="Coordenadas" value={`${detailAsset.latitude}, ${detailAsset.longitude}`} />
                <AssetDetailField label="Descripción" value={detailAsset.description || "-"} />
                <div className="asset-detail-divider" />
                <div className="asset-detail-field">
                  <span>Estado</span>
                  <strong className={`asset-detail-status ${detailAsset.tone}`}>{detailAsset.displayStatus}</strong>
                </div>
                <AssetDetailField label="Fecha de creación" value={formatDateTime(detailAsset.createdAt)} />
                <AssetDetailField label="Último mantenimiento" value={formatDateTime(detailAsset.lastMaintenanceAt)} />
                <AssetDetailField label="Código" value={detailAsset.code || "-"} />
              </div>

              <div className="asset-detail-image-area">
                <span>Imagen</span>
                {detailAsset.imagePreview ? (
                  <img className="asset-detail-photo" src={detailAsset.imagePreview} alt={detailAsset.imageName ?? detailAsset.displayName} />
                ) : (
                  <div className="asset-detail-photo asset-detail-photo-empty" aria-label="Sin imagen cargada">
                    Sin imagen cargada
                  </div>
                )}
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
                  <input aria-label="Nombre" onChange={(event) => updateForm("name", event.target.value)} value={form.name} />
                </label>

                <div className="asset-edit-field full">
                  <span>Tipo *</span>
                  <div className={form.type ? "asset-form-select selected" : "asset-form-select"}>
                    <button onClick={() => setOpenAssetFormSelect((current) => current === "create-type" ? null : "create-type")} type="button">
                      {createTypeLabel}
                    </button>
                    <ChevronDown size={14} aria-hidden="true" />
                    {openAssetFormSelect === "create-type" && (
                      <div className="assets-filter-menu">
                        {ASSET_TYPE_OPTIONS.map((option) => (
                          <button
                            className={form.type === option.value ? "selected" : undefined}
                            key={option.value}
                            onClick={() => {
                              updateForm("type", option.value);
                              setOpenAssetFormSelect(null);
                            }}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <label className="asset-edit-field full">
                  <span>Ubicacion *</span>
                  <input aria-label="Ubicación" onChange={(event) => updateForm("locationDetail", event.target.value)} value={form.locationDetail} />
                </label>

                <div className="asset-edit-field full">
                  <span>Estado *</span>
                  <div className={form.status ? "asset-form-select selected" : "asset-form-select"}>
                    <button onClick={() => setOpenAssetFormSelect((current) => current === "create-status" ? null : "create-status")} type="button">
                      {createStatusLabel}
                    </button>
                    <ChevronDown size={14} aria-hidden="true" />
                    {openAssetFormSelect === "create-status" && (
                      <div className="assets-filter-menu">
                        {ASSET_STATUS_OPTIONS.map((option) => (
                          <button
                            className={form.status === option.value ? "selected" : undefined}
                            key={option.value}
                            onClick={() => {
                              updateForm("status", option.value);
                              setOpenAssetFormSelect(null);
                            }}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="asset-edit-field full">
                  <span>Coordenadas *</span>
                  <div className="asset-coordinate-picker">
                    <button className="asset-coordinate-button" onClick={openCoordinatePicker} type="button">
                      Seleccionar coordenadas
                    </button>
                    <div className="asset-edit-coordinates">
                      <input aria-label="Latitud" readOnly placeholder="Latitud" value={form.latitude} />
                      <input aria-label="Longitud" readOnly placeholder="Longitud" value={form.longitude} />
                    </div>
                  </div>
                </div>

                <label className="asset-edit-field full">
                  <span>Ultimo mantenimiento*</span>
                  <div className="asset-edit-date-input">
                    <input onChange={(event) => updateForm("lastMaintenanceAt", event.target.value)} type="datetime-local" value={form.lastMaintenanceAt} />
                    <CalendarDays size={16} aria-hidden="true" />
                  </div>
                </label>
              </div>

              <div className="asset-edit-side">
                <div className="asset-edit-image-area asset-create-image-area">
                  <span>Imagen</span>
                  <label className="asset-create-upload" aria-label="Subir imagen">
                    <Upload size={24} aria-hidden="true" />
                    <input accept="image/*" hidden onChange={handleImageChange} type="file" />
                  </label>
                  <p>{form.imageName || "Registro visual del activo seleccionado."}</p>
                </div>

                <label className="asset-edit-field asset-edit-description">
                  <span>Descripcion</span>
                  <textarea aria-label="Descripción" onChange={(event) => updateForm("description", event.target.value)} value={form.description} />
                </label>
              </div>
            </div>

            <footer className="asset-edit-modal-footer">
              <label className="asset-edit-field asset-edit-code-bottom">
                <span>Codigo *</span>
                <input aria-label="Código" onChange={(event) => updateForm("code", event.target.value)} value={form.code} />
              </label>
              <div className="asset-edit-actions">
                <button className="asset-edit-cancel" onClick={() => setCreateAsset(false)} type="button">
                  Cancelar
                </button>
                {saveError && <p className="mission-empty">{saveError}</p>}
                <button
                  className="asset-edit-save"
                  disabled={isSaving}
                  onClick={handleCreateAsset}
                  type="button"
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
      {isCoordinatePickerOpen && (
        <div className="asset-detail-modal-backdrop" role="presentation">
          <section aria-modal="true" className="asset-coordinate-modal" role="dialog">
            <header className="asset-edit-modal-header">
              <div className="asset-edit-title-wrap">
                <span className="asset-detail-modal-icon">
                  <Box size={24} aria-hidden="true" />
                </span>
                <h2>Seleccionar coordenadas</h2>
              </div>
              <button aria-label="Cerrar mapa" className="asset-detail-close" onClick={() => setIsCoordinatePickerOpen(false)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="asset-coordinate-map-frame">
              <AssetsOverviewMap
                assets={backendAssets ?? []}
                onSelect={setPendingLocation}
                plant={plant}
                selectedLocation={pendingLocation}
              />
            </div>

            <footer className="asset-coordinate-modal-footer">
              <div className="asset-coordinate-selected">
                {pendingLocation ? (
                  <>
                    <strong>Punto seleccionado</strong>
                    <span>{pendingLocation.latitude}, {pendingLocation.longitude}</span>
                  </>
                ) : (
                  <strong>Seleccioná un punto en el mapa</strong>
                )}
              </div>
              <button className="asset-edit-cancel" onClick={() => setIsCoordinatePickerOpen(false)} type="button">
                Cancelar
              </button>
              <button className="asset-edit-save" disabled={!pendingLocation} onClick={confirmCoordinates} type="button">
                Confirmar coordenadas
              </button>
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

                <div className="asset-edit-field full">
                  <span>Tipo *</span>
                  <div className="asset-form-select selected">
                    <button onClick={() => setOpenAssetFormSelect((current) => current === "edit-type" ? null : "edit-type")} type="button">
                      {editAsset.displayType}
                    </button>
                    <ChevronDown size={14} aria-hidden="true" />
                    {openAssetFormSelect === "edit-type" && (
                      <div className="assets-filter-menu">
                        {ASSET_TYPE_OPTIONS.map((option) => (
                          <button
                            className={editAsset.displayType === option.label ? "selected" : undefined}
                            key={option.value}
                            onClick={() => {
                              setEditAsset((current) => current ? { ...current, displayType: option.label, type: option.label } : current);
                              setOpenAssetFormSelect(null);
                            }}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <label className="asset-edit-field full">
                  <span>Ubicación *</span>
                  <input defaultValue={editAsset.locationDetail} />
                </label>

                <div className="asset-edit-field full">
                  <span>Estado *</span>
                  <div className="asset-form-select selected">
                    <button onClick={() => setOpenAssetFormSelect((current) => current === "edit-status" ? null : "edit-status")} type="button">
                      {editAsset.displayStatus}
                    </button>
                    <ChevronDown size={14} aria-hidden="true" />
                    {openAssetFormSelect === "edit-status" && (
                      <div className="assets-filter-menu">
                        {ASSET_STATUS_OPTIONS.map((option) => (
                          <button
                            className={editAsset.displayStatus === option.label ? "selected" : undefined}
                            key={option.value}
                            onClick={() => {
                              setEditAsset((current) => current ? {
                                ...current,
                                displayStatus: option.label,
                                status: option.label,
                                tone: statusTone(option.label)
                              } : current);
                              setOpenAssetFormSelect(null);
                            }}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="asset-edit-field full">
                  <span>Coordenadas *</span>
                  <div className="asset-edit-coordinates">
                    <input defaultValue={editAsset.latitude} />
                    <input defaultValue={editAsset.longitude} />
                  </div>
                </div>

                <label className="asset-edit-field full">
                  <span>Ultimo mantenimiento*</span>
                  <div className="asset-edit-date-input">
                    <input defaultValue={formatDateTime(editAsset.lastMaintenanceAt)} />
                    <CalendarDays size={16} aria-hidden="true" />
                  </div>
                </label>
</div>

              <div className="asset-edit-side">
                <div className="asset-edit-image-area">
                  <span>Imagen</span>
                  {editAsset.imagePreview ? (
                    <img className="asset-detail-photo" src={editAsset.imagePreview} alt={editAsset.imageName ?? editAsset.displayName} />
                  ) : (
                    <div className="asset-detail-photo asset-detail-photo-empty" aria-label="Sin imagen cargada">
                      Sin imagen cargada
                    </div>
                  )}
                  <p>Registro visual del activo seleccionado.</p>
                </div>

                <label className="asset-edit-field asset-edit-description">
                  <span>Descripcion</span>
                  <textarea defaultValue={editAsset.description} />
                </label>
              </div>
            </div>

            <footer className="asset-edit-modal-footer">
              <label className="asset-edit-field asset-edit-code-bottom">
                <span>Codigo *</span>
                <input defaultValue={editAsset.code} />
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
                onClick={() => handleDeleteAsset(deleteAsset)}
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













