import { useState, type FormEvent } from "react";
import { ArrowLeft, ChevronDown, Save, X, MapPin, CheckCircle2 } from "lucide-react";
import type { Asset, InspectionMission, InspectionPoint, Plant } from "../types";
import { FieldError } from "../components/FieldError";
import { MissionRouteMap } from "../components/MissionRouteMap";

export function ConfigurarMisionView({
  assets,
  missions,
  onBack,
  onCreateMission,
  plant
}: {
  assets: Asset[];
  missions: InspectionMission[];
  onBack: () => void;
  onCreateMission: (mission: Omit<InspectionMission, "id">) => void;
  plant: Plant;
}) {
  const plantAssets = assets.filter((asset) => asset.plantId === plant.id);
  const [missionName, setMissionName] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(plantAssets[0]?.id ?? null);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [routePoints, setRoutePoints] = useState<InspectionPoint[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "asset" | "route", string>>>({});
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const selectedAsset = plantAssets.find((asset) => asset.id === selectedAssetId) ?? null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setIsSuccessOpen(false);

    if (plantAssets.length === 0) {
      setFieldErrors({ asset: "No hay activos disponibles para configurar una mision." });
      return;
    }

    const nextFieldErrors: Partial<Record<"name" | "asset" | "route", string>> = {};

    if (!missionName.trim()) nextFieldErrors.name = "Ingrese nombre de la mision.";
    if (!selectedAsset) nextFieldErrors.asset = "Seleccione un activo a inspeccionar.";
    if (routePoints.length === 0) nextFieldErrors.route = "Defina al menos un punto de inspeccion.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (missionName.length > 100) {
      setFieldErrors({ name: "El nombre de la mision no puede superar los 100 caracteres." });
      return;
    }

    const missionExists = missions.some(
      (mission) => mission.assetId === selectedAsset?.id && mission.name.trim().toLowerCase() === missionName.trim().toLowerCase()
    );

    if (missionExists) {
      setFieldErrors({ name: "Ya existe una mision con ese nombre para el activo seleccionado." });
      return;
    }

    onCreateMission({
      name: missionName.trim(),
      assetId: selectedAsset!.id,
      assetName: selectedAsset!.name,
      routePoints
    });

    setMissionName("");
    setSelectedAssetId(plantAssets[0]?.id ?? null);
    setRoutePoints([]);
    setIsSuccessOpen(true);
  };

  return (
    <section className="asset-page asset-page-modern">
      <header className="asset-header-modern">
        <button className="back-link-modern" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div className="asset-hero">
          <h1 className="asset-hero-title">Configurar misión</h1>
          <p className="asset-hero-subtitle">Crear una planificación de vuelo asociada a un activo registrado para su posterior ejecución.</p>
        </div>
      </header>

      <form className="asset-form asset-form-modern" onSubmit={handleSubmit}>
        <section className="form-panel-modern">
          {plantAssets.length === 0 && <p className="empty-assets">No hay activos registrados. Primero debe darse de alta un activo.</p>}

          <div className="field-grid-modern">
            <label className="field-modern">
              <span className="field-label-modern">
                <span>Nombre de la misión</span>
                <small className="required-badge">*</small>
              </span>
              <input
                aria-invalid={Boolean(fieldErrors.name)}
                className={fieldErrors.name ? "input-modern field-invalid" : "input-modern"}
                disabled={plantAssets.length === 0}
                maxLength={100}
                onChange={(event) => setMissionName(event.target.value)}
                placeholder="Ej: Inspección Silo Sur"
                type="text"
                value={missionName}
              />
              {fieldErrors.name && <FieldError message={fieldErrors.name} />}
            </label>

            <label className="field-modern">
              <span className="field-label-modern">
                <span>Activo a inspeccionar</span>
                <small className="required-badge">*</small>
              </span>
              <div className="asset-select">
                <button
                  aria-expanded={isAssetOpen}
                  aria-haspopup="listbox"
                  className={fieldErrors.asset ? "asset-select-trigger-modern field-invalid" : "asset-select-trigger-modern"}
                  disabled={plantAssets.length === 0}
                  onClick={() => setIsAssetOpen((current) => !current)}
                  type="button"
                >
                  <span className={selectedAsset ? undefined : "select-placeholder"}>{selectedAsset?.name || "Seleccionar activo"}</span>
                  <ChevronDown size={17} aria-hidden="true" />
                </button>

                {isAssetOpen && plantAssets.length > 0 && (
                  <div className="asset-select-menu-modern" role="listbox">
                    {plantAssets.map((asset) => (
                      <button
                        className={selectedAssetId === asset.id ? "selected" : undefined}
                        key={asset.id}
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          setIsAssetOpen(false);
                          setRoutePoints([]);
                        }}
                        role="option"
                        type="button"
                      >
                        {asset.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldErrors.asset && <FieldError message={fieldErrors.asset} />}
            </label>
          </div>
        </section>

        <section className="form-panel-modern map-section">
          <div className="form-section-header">
            <div className="section-icon">
              <MapPin size={18} aria-hidden="true" />
            </div>
            <h3>Recorrido de inspección</h3>
          </div>
          <p className="section-description">Selecciona uno o más puntos sobre el mapa para definir el recorrido de la misión.</p>

          <div className="mission-layout">
            <MissionRouteMap
              asset={selectedAsset}
              disabled={plantAssets.length === 0}
              onAddPoint={(point) => {
                setRoutePoints((current) => [...current, { ...point, id: Date.now() + current.length }]);
                setFieldErrors((current) => ({ ...current, route: undefined }));
              }}
              plant={plant}
              routePoints={routePoints}
            />

            <div className="mission-route-panel">
              <div>
                <p className="map-field-label">Puntos definidos</p>
                <p>{routePoints.length} puntos de inspeccion</p>
              </div>

              {routePoints.length === 0 ? (
                <p className="mission-empty">No hay puntos definidos.</p>
              ) : (
                <div className="mission-point-list">
                  {routePoints.map((point, index) => (
                    <div className="mission-point-row" key={point.id}>
                      <span>{index + 1}</span>
                      <p>{point.latitude}, {point.longitude}</p>
                      <button
                        aria-label="Quitar punto"
                        onClick={() => setRoutePoints((current) => current.filter((item) => item.id !== point.id))}
                        type="button"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {routePoints.length > 0 && (
                <button className="modal-link-button" onClick={() => setRoutePoints([])} type="button">
                  Limpiar recorrido
                </button>
              )}
            </div>
          </div>
          {fieldErrors.route && <FieldError message={fieldErrors.route} />}
        </section>

        <div className="form-actions">
          <button className="register-button" disabled={plantAssets.length === 0} type="submit">
            <Save size={18} aria-hidden="true" />
            Registrar misión
          </button>
        </div>
      </form>

      {isSuccessOpen && (
        <MissionSuccessModal
          onClose={() => setIsSuccessOpen(false)}
          onGoHome={() => {
            setIsSuccessOpen(false);
            onBack();
          }}
          onViewMissions={() => {
            setIsSuccessOpen(false);
            onBack();
          }}
        />
      )}
    </section>
  );
}

function MissionSuccessModal({
  onClose,
  onGoHome,
  onViewMissions
}: {
  onClose: () => void;
  onGoHome: () => void;
  onViewMissions: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="success-modal" role="dialog">
        <div className="success-icon">
          <CheckCircle2 size={48} aria-hidden="true" />
        </div>
        <h2>Misión guardada</h2>
        <p>La misión se ha guardado correctamente y está lista para su ejecución.</p>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onGoHome} type="button">
            Volver al inicio
          </button>
          <button className="modal-primary-button" onClick={onViewMissions} type="button">
            Ver misiones
          </button>
        </div>
      </section>
    </div>
  );
}
