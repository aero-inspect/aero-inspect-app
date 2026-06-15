import { useState, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Circle,
  ImagePlus,
  MapPin,
  Route,
  Trash2,
  UploadCloud,
  Warehouse,
  Wrench,
  X
} from "lucide-react";
import type { Asset, AssetImage, AssetType, Plant } from "../types";
import { ASSET_TYPES, ASSET_TYPE_COLORS } from "../constants";
import { LeafletSatelliteMap } from "../components/LeafletSatelliteMap";
import { FieldError } from "../components/FieldError";
import { SuccessModal } from "../components/SuccessModal";
import { AppTopActions } from "../components/AppTopActions";

type AssetStatus = "Operativo" | "Mantenimiento" | "Fuera de servicio";
type FormErrorKey = "name" | "type" | "location" | "description";

const STATUS_OPTIONS: AssetStatus[] = ["Operativo", "Mantenimiento", "Fuera de servicio"];

const MISSION_SUGGESTIONS: Record<AssetType, string[]> = {
  Silo: ["Inspeccion visual", "Corrosion estructural", "Termografia"],
  Noria: ["Revision mecanica", "Inspeccion de altura", "Vibraciones"],
  "Cinta transportadora": ["Alineacion", "Desgaste de banda", "Puntos calientes"],
  Tuberia: ["Fugas visibles", "Corrosion", "Termografia"],
  Techo: ["Fisuras", "Deformaciones", "Acumulacion de polvo"]
};

export function RegistrarActivoView({
  assets,
  onBack,
  onCreateAsset,
  onGoHome,
  onViewAssets,
  plant
}: {
  assets: Asset[];
  onBack: () => void;
  onCreateAsset: (asset: Omit<Asset, "id" | "plantId">) => void;
  onGoHome: () => void;
  onViewAssets: () => void;
  plant: Plant;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("Silo");
  const [status, setStatus] = useState<AssetStatus>("Operativo");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<AssetImage[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormErrorKey, string>>>({});
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const selectedLocation = latitude && longitude ? { latitude, longitude } : undefined;
  const primaryImage = images[0]?.preview;

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages = Array.from(files).map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      preview: URL.createObjectURL(file)
    }));

    setImages((current) => [...current, ...newImages]);
    event.target.value = "";
  };

  const removeImage = (imageId: number) => {
    setImages((current) => current.filter((image) => image.id !== imageId));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setIsSuccessOpen(false);

    const nextErrors: Partial<Record<FormErrorKey, string>> = {};
    if (!name.trim()) nextErrors.name = "Ingrese nombre del activo.";
    if (!type) nextErrors.type = "Seleccione tipo de activo.";
    if (!latitude.trim() || !longitude.trim()) nextErrors.location = "Seleccione la ubicacion en el mapa.";
    if (description.length > 500) nextErrors.description = "La descripcion no puede superar los 500 caracteres.";
    if (name.length > 100) nextErrors.name = "El nombre del activo no puede superar los 100 caracteres.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const exists = assets.some(
      (asset) => asset.plantId === plant.id && asset.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (exists) {
      setFieldErrors({ name: "Ya existe un activo con ese nombre dentro de la misma planta." });
      return;
    }

    onCreateAsset({
      name: name.trim(),
      type,
      latitude: latitude.trim(),
      longitude: longitude.trim(),
      description: description.trim(),
      images
    });

    setName("");
    setType("Silo");
    setStatus("Operativo");
    setLatitude("");
    setLongitude("");
    setDescription("");
    setImages([]);
    setIsSuccessOpen(true);
  };

  return (
    <section className="register-asset-dashboard">
      <header className="assets-dashboard-header register-asset-topbar">
        <div className="register-title-group">
          <button className="register-back-button" onClick={onBack} type="button" aria-label="Volver">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <h1>Registrar nuevo activo</h1>
            <p>Completa la informacion del activo y selecciona su ubicacion en el mapa.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      <form className="register-asset-layout" onSubmit={handleSubmit}>
        <section className="register-card register-map-card">
          <div className="register-section-heading">
            <h2>Ubicacion del activo</h2>
            <p>Selecciona la ubicacion exacta en el mapa.</p>
          </div>

          <div className="register-map-frame">
            <LeafletSatelliteMap
              markers={[]}
              onSelect={(location) => {
                setLatitude(location.latitude);
                setLongitude(location.longitude);
                setFieldErrors((current) => ({ ...current, location: undefined }));
              }}
              plant={plant}
              selectedLocation={selectedLocation}
            />
          </div>

          <div className={`selected-location-card ${selectedLocation ? "has-location" : ""}`}>
            <span className="selected-location-icon">
              {selectedLocation ? <CheckCircle2 size={22} aria-hidden="true" /> : <MapPin size={22} aria-hidden="true" />}
            </span>
            {selectedLocation ? (
              <div>
                <strong>Ubicacion seleccionada</strong>
                <p>Sector Norte</p>
                <p>Lat: {latitude}</p>
                <p>Lng: {longitude}</p>
              </div>
            ) : (
              <strong>Selecciona una ubicacion en el mapa</strong>
            )}
          </div>
          {fieldErrors.location && <FieldError message={fieldErrors.location} />}
        </section>

        <aside className="register-side-column">

          <section className="register-card register-form-card">
            <h2>Informacion del activo</h2>

            <label className="register-field">
              <span>Nombre del activo *</span>
              <input
                aria-invalid={Boolean(fieldErrors.name)}
                className={fieldErrors.name ? "field-invalid" : undefined}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Silo Norte 3"
                value={name}
              />
              <small>{name.length}/100</small>
              {fieldErrors.name && <FieldError message={fieldErrors.name} />}
            </label>

            <div className="register-field">
              <span>Tipo de activo *</span>
              <div className="asset-type-card-grid">
                {ASSET_TYPES.map((assetType) => (
                  <button
                    className={`asset-type-card ${type === assetType ? "selected" : ""}`}
                    key={assetType}
                    onClick={() => {
                      setType(assetType);
                      setFieldErrors((current) => ({ ...current, type: undefined }));
                    }}
                    style={{ "--asset-type-color": ASSET_TYPE_COLORS[assetType] } as CSSProperties}
                    type="button"
                  >
                    <AssetTypeIcon type={assetType} />
                    <span>{getShortAssetType(assetType)}</span>
                  </button>
                ))}
              </div>
              {fieldErrors.type && <FieldError message={fieldErrors.type} />}
            </div>

            <div className="register-field">
              <span>Estado</span>
              <div className="asset-status-picker">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    className={`asset-status-pill ${getStatusPillClass(option)} ${status === option ? "selected" : ""}`}
                    key={option}
                    onClick={() => setStatus(option)}
                    type="button"
                  >
                    <Circle size={9} fill="currentColor" aria-hidden="true" />
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="register-field">
              <span>Fotografias</span>
              <label className="register-dropzone">
                <UploadCloud size={24} aria-hidden="true" />
                <strong>Agregar fotografias</strong>
                <p>Arrastra imagenes o haz clic para seleccionar</p>
                <input type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
              </label>
              {images.length > 0 && (
                <div className="image-preview-grid">
                  {images.map((image) => (
                    <div className="image-thumbnail" key={image.id}>
                      <img src={image.preview} alt={image.name} />
                      <div className="image-actions">
                        <button type="button" onClick={() => setExpandedImage(image.preview)} aria-label="Ver imagen">
                          <ImagePlus size={13} />
                        </button>
                        <button type="button" onClick={() => removeImage(image.id)} aria-label="Eliminar imagen">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="register-field">
              <span>Descripcion</span>
              <textarea
                aria-invalid={Boolean(fieldErrors.description)}
                className={fieldErrors.description ? "field-invalid" : undefined}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Detalle opcional del activo, referencia visual o condicion inicial."
                value={description}
              />
              <small>{description.length}/500</small>
              {fieldErrors.description && <FieldError message={fieldErrors.description} />}
            </label>
          </section>
        </aside>

        <footer className="register-sticky-footer">
          <button className="register-cancel-button" onClick={onBack} type="button">
            Cancelar
          </button>
          <button className="register-submit-button" type="submit">
            Registrar activo
            <Check size={16} aria-hidden="true" />
          </button>
        </footer>
      </form>

      {expandedImage && (
        <div className="image-expanded-modal" onClick={() => setExpandedImage(null)} role="presentation">
          <div className="image-modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setExpandedImage(null)} type="button" aria-label="Cerrar">
              <X size={24} aria-hidden="true" />
            </button>
            <img src={expandedImage} alt="Foto expandida" />
          </div>
        </div>
      )}

      {isSuccessOpen && (
        <SuccessModal
          message="Ya esta disponible para futuras inspecciones y misiones."
          onGoHome={onGoHome}
          onViewAssets={onViewAssets}
        />
      )}
    </section>
  );
}

function PreviewItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="register-preview-item">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <p>{value}</p>
      </div>
    </div>
  );
}

function AssetTypeIcon({ type }: { type: AssetType }) {
  const color = ASSET_TYPE_COLORS[type];
  if (type === "Silo") return <Warehouse size={19} color={color} />;
  if (type === "Noria") return <Warehouse size={19} color={color} />;
  if (type === "Cinta transportadora") return <Wrench size={19} color={color} />;
  if (type === "Tuberia") return <Wrench size={19} color={color} />;
  return <Building2 size={19} color={color} />;
}

function getShortAssetType(type: AssetType) {
  if (type === "Cinta transportadora") return "Cinta";
  return type;
}

function getStatusClass(status: AssetStatus) {
  if (status === "Mantenimiento") return "assets-status warning";
  if (status === "Fuera de servicio") return "assets-status danger";
  return "assets-status ok";
}

function getStatusPillClass(status: AssetStatus) {
  if (status === "Mantenimiento") return "maintenance";
  if (status === "Fuera de servicio") return "offline";
  return "operative";
}
