import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Info,
  Lightbulb,
  MapPin,
  Warehouse,
  Wrench,
  X,
  Maximize2
} from "lucide-react";
import type { Asset, AssetType, Plant } from "../types";
import { ASSET_TYPES, ASSET_TYPE_COLORS } from "../constants";
import { LeafletSatelliteMap } from "../components/LeafletSatelliteMap";
import { FieldError } from "../components/FieldError";
import { SuccessModal } from "../components/SuccessModal";
import { AppTopActions } from "../components/AppTopActions";

// Definimos los tipos de estado (si no los tenías en ../types)
type AssetStatus = "Operativo" | "Mantenimiento" | "Fuera de servicio";

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
  
  // Estado para las fotos
  const [images, setImages] = useState<{ preview: string; file: File }[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "type" | "location" | "description", string>>>({});
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const selectedLocation = latitude && longitude ? { latitude, longitude } : undefined;

  // Manejo de imágenes
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages = Array.from(files).map((file) => ({
      preview: URL.createObjectURL(file),
      file
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setIsSuccessOpen(false);

    const nextErrors: Partial<Record<"name" | "type" | "location" | "description", string>> = {};
    if (!name.trim()) nextErrors.name = "Ingrese nombre del activo.";
    if (!type) nextErrors.type = "Seleccione tipo de activo.";
    if (!latitude.trim() || !longitude.trim()) nextErrors.location = "Seleccione la ubicacion en el mapa.";
    if (description.length > 500) nextErrors.description = "La descripcion no puede superar los 500 caracteres.";
    if (name.length > 100) nextErrors.name = "El nombre del activo no puede superar los 100 caracteres.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const exists = assets.some((asset) => asset.plantId === plant.id && asset.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      setFieldErrors({ name: "Ya existe un activo con ese nombre dentro de la misma planta." });
      return;
    }

    onCreateAsset({
      name: name.trim(),
      type,
      status, // Pasamos el nuevo estado
      latitude: latitude.trim(),
      longitude: longitude.trim(),
      description: description.trim(),
      images: images // Pasamos el array de fotos
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
      
      {/* 1. Header corregido para igualar al Home/MisActivos */}
      <header className="assets-dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={onBack} 
            type="button" 
            aria-label="Volver"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: '36px', height: '36px', background: '#fff', 
              border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' 
            }}
          >
            <ArrowLeft size={18} color="#0f172a" />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Registrar nuevo activo</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Completa la información y selecciona su ubicación.</p>
          </div>
        </div>
        <AppTopActions />
      </header>

      <form className="register-asset-layout" onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
        <section className="register-card register-map-card">
          <h2>Ubicacion en el mapa</h2>
          <p>Haz clic en el mapa para seleccionar la ubicacion exacta del activo.</p>

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

          <div className="selected-coordinates-card">
            <span>
              <MapPin size={18} />
            </span>
            <div>
              <strong>Coordenadas seleccionadas</strong>
              {selectedLocation ? (
                <>
                  <p>Latitud: {latitude}</p>
                  <p>Longitud: {longitude}</p>
                </>
              ) : (
                <p>Selecciona un punto en el mapa.</p>
              )}
            </div>
          </div>

          {fieldErrors.location && <FieldError message={fieldErrors.location} />}

          <div className="register-info-note">
            <Info size={17} />
            La ubicacion se define haciendo clic sobre el mapa.
          </div>
        </section>

        <section className="register-card register-form-card">
          <h2>Informacion del activo</h2>

          <label className="register-field">
            <span>Nombre del activo *</span>
            <input
              aria-invalid={Boolean(fieldErrors.name)}
              className={fieldErrors.name ? "field-invalid" : undefined}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Silo Norte 3"
              value={name}
            />
            <small>{name.length}/100</small>
            {fieldErrors.name && <FieldError message={fieldErrors.name} />}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <label className="register-field">
              <span>Tipo de activo *</span>
              <div className="register-select-wrap">
                <select onChange={(event) => setType(event.target.value as AssetType)} value={type}>
                  {ASSET_TYPES.map((assetType) => (
                    <option key={assetType} value={assetType}>
                      {assetType}
                    </option>
                  ))}
                </select>
                <ChevronDown size={17} />
              </div>
              {fieldErrors.type && <FieldError message={fieldErrors.type} />}
            </label>

            {/* 2. Nuevo Selector de Estado */}
            <label className="register-field">
              <span>Estado del activo *</span>
              <div className="register-select-wrap">
                <select onChange={(event) => setStatus(event.target.value as AssetStatus)} value={status}>
                  <option value="Operativo">Operativo</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Fuera de servicio">Fuera de servicio</option>
                </select>
                <ChevronDown size={17} />
              </div>
            </label>
          </div>

          <label className="register-field">
            <span>Ubicacion geografica *</span>
            <input
              aria-invalid={Boolean(fieldErrors.location)}
              className={fieldErrors.location ? "field-invalid" : undefined}
              readOnly
              value={selectedLocation ? `Latitud: ${latitude}, Longitud: ${longitude}` : ""}
              placeholder="Selecciona un punto en el mapa"
            />
          </label>

          {/* 3. Nueva Sección para subir fotos */}
          <div className="register-field">
            <span>Fotografías (opcional)</span>
            <div className="image-upload-wrapper">
              <label className="image-upload-btn">
                <Camera size={20} />
                <span>Adjuntar fotos</span>
                <input type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
              </label>

              {images.length > 0 && (
                <div className="image-preview-grid">
                  {images.map((img, index) => (
                    <div key={index} className="image-thumbnail">
                      <img src={img.preview} alt={`Preview ${index}`} />
                      <div className="image-actions">
                        <button type="button" onClick={() => setExpandedImage(img.preview)} aria-label="Expandir">
                          <Maximize2 size={12} />
                        </button>
                        <button type="button" onClick={() => removeImage(index)} aria-label="Eliminar">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="register-field">
            <span>Descripcion (opcional)</span>
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              className={fieldErrors.description ? "field-invalid" : undefined}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Silo metalico utilizado para el almacenamiento de granos. Capacidad 5.000 toneladas."
              value={description}
            />
            <small>{description.length}/500</small>
            {fieldErrors.description && <FieldError message={fieldErrors.description} />}
          </label>

          <div className="register-form-actions">
            <button className="register-cancel-button" onClick={onBack} type="button">
              Cancelar
            </button>
            <button className="register-submit-button" type="submit">
              Registrar activo
              <Check size={16} />
            </button>
          </div>
        </section>

        <aside className="register-card register-help-card">
          <div className="register-help-intro">
            <Lightbulb size={20} />
            <h2>Informacion</h2>
            <p>Completa los datos del nuevo activo y selecciona su ubicacion exacta en el mapa.</p>
          </div>

          <div className="register-type-list">
            <h3>Tipos de activo disponibles</h3>
            {ASSET_TYPES.map((assetType) => (
              <div className="register-type-item" key={assetType}>
                <AssetTypeIcon type={assetType} />
                <span>{assetType}</span>
              </div>
            ))}
          </div>
        </aside>
      </form>

      {/* Modal para ver la imagen en grande */}
      {expandedImage && (
        <div className="image-expanded-modal" onClick={() => setExpandedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setExpandedImage(null)} type="button">
              <X size={24} />
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

function AssetTypeIcon({ type }: { type: AssetType }) {
  const color = ASSET_TYPE_COLORS[type];
  if (type === "Silo") return <Warehouse size={18} color={color} />;
  if (type === "Noria") return <Warehouse size={18} color={color} />;
  if (type === "Cinta transportadora") return <Wrench size={18} color={color} />;
  if (type === "Tuberia") return <Wrench size={18} color={color} />;
  return <Building2 size={18} color={color} />;
}