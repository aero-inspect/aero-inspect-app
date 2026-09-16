import { useEffect, useMemo, useState } from "react";
import { getAssets } from "../api/client";
import type { BackendAsset, BackendFlightPlan } from "../api/types";
import {
  availableMissionDistanceMeters,
  estimateMissionDistanceMeters,
  formatMissionDistance,
  missionReservePct,
  missionRouteForPlans
} from "../utils/missionAutonomy";
import { BragadoPlant3DMap } from "./BragadoPlant3DMap";

const INSPECTABLE_TYPES = ["SILO", "SILO_FLOTANTE", "CELDA", "NORIA", "SECADORA"];

export function resolveInspectionPlan(asset: BackendAsset, plans: BackendFlightPlan[]) {
  if (!INSPECTABLE_TYPES.includes(asset.type)) return null;
  const matches = plans.filter(
    (plan) =>
      plan.name === `Inspeccion 3D - ${asset.code} - perimetral-v5` &&
      plan.assetIds.length === 1 &&
      plan.assetIds[0] === asset.idAsset
  );
  return matches.length === 1 && matches[0].route.length > 1 ? matches[0] : null;
}

export function MissionAssetPicker({
  plans,
  selectedPlanIds,
  onSelect,
  locked = false,
  distanceLimitMeters,
  batteryPercentage
}: {
  plans: BackendFlightPlan[];
  selectedPlanIds: number[];
  onSelect: (plans: BackendFlightPlan[]) => void;
  locked?: boolean;
  distanceLimitMeters?: number;
  batteryPercentage?: number | null;
}) {
  const [assets, setAssets] = useState<BackendAsset[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState<BackendAsset | null>(null);
  const [blockedBudget, setBlockedBudget] = useState<{ assetName: string; distance: number; limit: number } | null>(null);

  useEffect(() => {
    let active = true;
    getAssets()
      .then((items) => {
        if (active) setAssets(items);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los activos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedPlans = useMemo(
    () => selectedPlanIds.map((id) => plans.find((plan) => plan.idFlightPlan === id)).filter((plan): plan is BackendFlightPlan => Boolean(plan)),
    [plans, selectedPlanIds]
  );
  const selectedAssetIds = useMemo(() => selectedPlans.flatMap((plan) => plan.assetIds), [selectedPlans]);
  const previewRoute = useMemo(() => missionRouteForPlans(selectedPlans), [selectedPlans]);
  const routeDistanceMeters = useMemo(() => estimateMissionDistanceMeters(selectedPlans), [selectedPlans]);
  const routeLimitMeters = useMemo(
    () => distanceLimitMeters ?? availableMissionDistanceMeters(batteryPercentage, missionReservePct(selectedPlans)),
    [batteryPercentage, distanceLimitMeters, selectedPlans]
  );
  const exceedsLimit = selectedPlans.length > 0 && routeDistanceMeters > routeLimitMeters;

  const handleAssetSelect = (idAsset: number) => {
    if (locked) return;
    const asset = assets.find((candidate) => candidate.idAsset === idAsset) ?? null;
    const resolved = asset ? resolveInspectionPlan(asset, plans) : null;
    if (asset && !resolved) {
      setMissing(asset);
      return;
    }
    setMissing(null);
    if (!resolved) return;
    const alreadySelected = selectedPlanIds.includes(resolved.idFlightPlan);
    const nextPlans = alreadySelected ? selectedPlans.filter((plan) => plan.idFlightPlan !== resolved.idFlightPlan) : [...selectedPlans, resolved];
    const nextDistance = estimateMissionDistanceMeters(nextPlans);
    const nextLimit = distanceLimitMeters ?? availableMissionDistanceMeters(batteryPercentage, missionReservePct(nextPlans));
    if (!alreadySelected && nextDistance > nextLimit) {
      setBlockedBudget({ assetName: asset?.name ?? "el activo", distance: nextDistance, limit: nextLimit });
      return;
    }
    setBlockedBudget(null);
    onSelect(nextPlans);
  };

  const displayedDistance = blockedBudget?.distance ?? routeDistanceMeters;
  const displayedLimit = blockedBudget?.limit ?? routeLimitMeters;
  const budgetPercent = displayedLimit > 0 ? Math.min(100, Math.round((displayedDistance / displayedLimit) * 100)) : 100;
  const displayedExceeded = displayedDistance > displayedLimit;
  const selectionLabel = blockedBudget
    ? `${blockedBudget.assetName} supera el límite`
    : selectedPlans.length === 0
      ? "Seleccioná uno o más activos"
      : `${selectedPlans.length} ${selectedPlans.length === 1 ? "activo seleccionado" : "activos seleccionados"}`;

  return (
    <div className="mission-asset-picker">
      <BragadoPlant3DMap
        assets={assets}
        assetSelection={{ assets, selectedIds: selectedAssetIds, route: previewRoute, onSelect: handleAssetSelect }}
      />
      {loading || error ? (
        <p className="map-field-label mission-route-budget" role="status">{loading ? "Cargando activos..." : error}</p>
      ) : (
        <div className={displayedExceeded || exceedsLimit ? "mission-budget-meter exceeded" : "mission-budget-meter"} role="status">
          <div className="mission-budget-meter-header">
            <span>{selectionLabel}</span>
            <strong>{formatMissionDistance(displayedDistance)} / {formatMissionDistance(displayedLimit)}</strong>
          </div>
          <div className="mission-budget-track" aria-hidden="true">
            <i style={{ width: `${budgetPercent}%` }} />
          </div>
          <div className="mission-budget-meter-footer">
            <span>{displayedExceeded || exceedsLimit ? "Límite excedido" : "Dentro del límite"}</span>
            <small>Tope máximo disponible</small>
          </div>
        </div>
      )}
      {missing && (
        <p className="mission-empty" role="alert">
          {missing.name} todavía no tiene un plan de inspección disponible. Reiniciá el backend para cargar los planes nuevos.
        </p>
      )}
    </div>
  );
}
