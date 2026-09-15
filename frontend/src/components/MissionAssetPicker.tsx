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
  const [budgetError, setBudgetError] = useState("");

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
      setBudgetError(
        `No se puede agregar ${asset?.name ?? "el activo"}: el consumo estimado quedaría en ${formatMissionDistance(nextDistance)} y el límite disponible es ${formatMissionDistance(nextLimit)}.`
      );
      return;
    }
    setBudgetError("");
    onSelect(nextPlans);
  };

  const selectionLabel = selectedPlans.length === 0
    ? "Seleccioná uno o más activos para continuar"
    : `${selectedPlans.length} ${selectedPlans.length === 1 ? "activo seleccionado" : "activos seleccionados"} · consumo ${formatMissionDistance(routeDistanceMeters)} de ${formatMissionDistance(routeLimitMeters)} disponibles`;

  return (
    <div className="mission-asset-picker">
      <BragadoPlant3DMap
        assets={assets}
        assetSelection={{ assets, selectedIds: selectedAssetIds, route: previewRoute, onSelect: handleAssetSelect }}
      />
      <p className={exceedsLimit ? "map-field-label mission-route-budget exceeded" : "map-field-label mission-route-budget"} role="status">
        {loading ? "Cargando activos..." : error || selectionLabel}
      </p>
      {missing && (
        <p className="mission-empty" role="alert">
          {missing.name} todavía no tiene un plan de inspección disponible. Reiniciá el backend para cargar los planes nuevos.
        </p>
      )}
      {budgetError && (
        <p className="mission-empty mission-route-budget-error" role="alert">
          {budgetError}
        </p>
      )}
    </div>
  );
}
