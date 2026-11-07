// Planes: el listado de todos los planes de vuelo de la planta, con el detalle de cada uno
// (recorrido en el mapa, waypoints y fotos configuradas en cada parada). Es de sólo lectura:
// los planes se crean con "Generar plan" y se editan durante esa generación.
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Camera, Plus, Route, Search } from "lucide-react";
import { getAssets, getFlightPlans } from "../api/client";
import type { PlanWaypoint } from "../api/planBuilder";
import type { BackendAsset, BackendFlightPlan, BackendPlanWaypoint, WaypointAction } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";
import { LoadingState } from "../components/LoadingState";
import { PlanDraftMap } from "../components/PlanDraftMap";
import { totalRouteDistanceMeters } from "../utils/geo";

const ACTION_LABELS: Record<WaypointAction, string> = {
  TAKEOFF: "Despegue",
  NAVIGATE: "Navegación",
  STOP: "Parada",
  LAND: "Aterrizaje"
};

const CARDINAL_POINTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

function formatDroneDegree(degree: number) {
  const cardinal = CARDINAL_POINTS[Math.round((((degree % 360) + 360) % 360) / 45) % 8];
  return `${Math.round(degree)}° (${cardinal})`;
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

// Fotos que saca una parada: una por ángulo configurado, o una sola con el gimbal como esté.
// Una parada con takePhoto=false frena y espera, pero no saca ninguna.
function photosOf(waypoint: BackendPlanWaypoint) {
  if (waypoint.action !== "STOP" || waypoint.takePhoto === false) return 0;
  return Math.max(1, waypoint.cameraAngles?.length ?? 0);
}

// PlanDraftMap trabaja con los waypoints del armado de planes; los del listado traen lo mismo.
function toMapWaypoint(plan: BackendFlightPlan, waypoint: BackendPlanWaypoint): PlanWaypoint {
  return {
    ...waypoint,
    idFlightPlan: plan.idFlightPlan,
    idWaypoint: waypoint.idPlanWaypoint,
    cameraAngles: waypoint.cameraAngles,
    takePhoto: waypoint.takePhoto ?? true
  };
}

export function PlanesVueloView({
  onGeneratePlan,
  onCreateMission
}: {
  onGeneratePlan?: () => void;
  onCreateMission?: (idFlightPlan: number) => void;
}) {
  const [plans, setPlans] = useState<BackendFlightPlan[] | null>(null);
  const [assets, setAssets] = useState<BackendAsset[]>([]);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFlightPlans(), getAssets()])
      .then(([loadedPlans, loadedAssets]) => {
        if (cancelled) return;
        const sorted = [...loadedPlans].sort((a, b) => a.name.localeCompare(b.name, "es"));
        setPlans(sorted);
        setAssets(loadedAssets);
        setSelectedId(sorted[0]?.idFlightPlan ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No se pudieron cargar los planes de vuelo.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (plans ?? []).filter((plan) => !term || plan.name.toLowerCase().includes(term));
  }, [plans, search]);

  const selectedPlan = plans?.find((plan) => plan.idFlightPlan === selectedId) ?? null;
  const route = useMemo(
    () => [...(selectedPlan?.route ?? [])].sort((a, b) => a.sequence - b.sequence),
    [selectedPlan]
  );
  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.idAsset, asset.name])), [assets]);
  const planAssets = useMemo(
    () => assets.filter((asset) => selectedPlan?.assetIds.includes(asset.idAsset)),
    [assets, selectedPlan]
  );

  const selectPlan = (idFlightPlan: number) => {
    setSelectedId(idFlightPlan);
    setSelectedSequence(null);
  };

  return (
    <section className="missions-dashboard planes-dashboard">
      <header className="missions-topbar">
        <div>
          <h1 data-page-title="true">Planes</h1>
        </div>
        <AppTopActions />
      </header>

      {loadError && (
        <p className="mission-empty">
          <AlertCircle size={16} aria-hidden="true" /> {loadError}
        </p>
      )}

      {!plans && !loadError && <LoadingState text="Cargando planes..." />}

      {plans && (
        <div className="planes-layout">
          <aside className="planes-list-card">
            <div className="planes-list-header">
              <label className="planes-search">
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label="Buscar plan"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar plan"
                  type="search"
                  value={search}
                />
              </label>
              {onGeneratePlan && (
                <button className="missions-manual-button" onClick={onGeneratePlan} type="button">
                  <Route size={18} />
                  Generar plan
                </button>
              )}
            </div>

            {visiblePlans.length === 0 && (
              <p className="planes-empty">{plans.length === 0 ? "Todavía no hay planes en esta planta." : "Ningún plan coincide con la búsqueda."}</p>
            )}

            <ul className="planes-list">
              {visiblePlans.map((plan) => {
                const stops = plan.route.filter((waypoint) => waypoint.action === "STOP").length;
                const photos = plan.route.reduce((total, waypoint) => total + photosOf(waypoint), 0);
                return (
                  <li key={plan.idFlightPlan}>
                    <button
                      className={plan.idFlightPlan === selectedId ? "planes-list-item selected" : "planes-list-item"}
                      onClick={() => selectPlan(plan.idFlightPlan)}
                      type="button"
                    >
                      <span className="planes-list-name">
                        {plan.name}
                        {plan.status === "DRAFT" && <span className="planes-status-draft">Borrador</span>}
                      </span>
                      <span className="planes-list-meta">
                        {plan.route.length} puntos · {stops} paradas · {photos} fotos
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {selectedPlan ? (
            <article className="planes-detail-card">
              <div className="planes-detail-header">
                <div>
                  <h2>{selectedPlan.name}</h2>
                  <small>
                    {selectedPlan.objective || "Sin objetivo"} · {formatDistance(totalRouteDistanceMeters(route))} ·{" "}
                    {selectedPlan.cruiseSpeedMs} m/s · batería mínima {selectedPlan.minBatteryPct}%
                  </small>
                </div>
                {onCreateMission && selectedPlan.status !== "DRAFT" && (
                  <button className="missions-new-button" onClick={() => onCreateMission(selectedPlan.idFlightPlan)} type="button">
                    <Plus size={18} />
                    Crear misión
                  </button>
                )}
              </div>

              <div className="planes-detail-body">
                <div className="planes-map">
                  <PlanDraftMap
                    assets={planAssets}
                    fitToRoute
                    key={selectedPlan.idFlightPlan}
                    onSelectWaypoint={(sequence) => setSelectedSequence(sequence === selectedSequence ? null : sequence)}
                    route={route.map((waypoint) => toMapWaypoint(selectedPlan, waypoint))}
                    selectedSequence={selectedSequence}
                    trackPoints={[]}
                  />
                </div>

                <div className="planes-waypoints">
                  <h3 className="mission-quick-actions-title">Puntos del plan</h3>
                  <div className="plan-builder-waypoint-list">
                    {route.map((waypoint) => {
                      const photos = photosOf(waypoint);
                      const isSelected = waypoint.sequence === selectedSequence;
                      return (
                        <div
                          className={isSelected ? "plan-builder-waypoint-row selected" : "plan-builder-waypoint-row"}
                          key={waypoint.idPlanWaypoint}
                          onClick={() => setSelectedSequence(isSelected ? null : waypoint.sequence)}
                        >
                          <div className="plan-builder-waypoint-info">
                            <strong>
                              #{waypoint.sequence} · {ACTION_LABELS[waypoint.action]}
                              {waypoint.name ? ` · ${waypoint.name}` : ""}
                            </strong>
                            <span>
                              {waypoint.latitude.toFixed(6)}, {waypoint.longitude.toFixed(6)} · {waypoint.altitude.toFixed(1)} m
                              {waypoint.stopSeconds > 0 ? ` · ${waypoint.stopSeconds}s de espera` : ""}
                              {` · rumbo ${formatDroneDegree(waypoint.droneDegree)}`}
                            </span>
                            {waypoint.idAsset != null && (
                              <span className="plan-builder-waypoint-asset">
                                {assetNameById.get(waypoint.idAsset) ?? `Activo #${waypoint.idAsset}`}
                              </span>
                            )}
                            {waypoint.action === "STOP" && (
                              <span className="planes-photos">
                                <Camera size={12} aria-hidden="true" />
                                {photos === 0
                                  ? "Sin foto: frena y espera"
                                  : waypoint.cameraAngles?.length
                                    ? waypoint.cameraAngles
                                        .map((angle, index) => `Foto ${index + 1}: pitch ${angle.pitch}° · yaw ${angle.yaw}°`)
                                        .join("  |  ")
                                    : "1 foto con el gimbal como esté"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          ) : (
            plans.length > 0 && <p className="planes-empty">Elegí un plan para ver sus puntos.</p>
          )}
        </div>
      )}
    </section>
  );
}
