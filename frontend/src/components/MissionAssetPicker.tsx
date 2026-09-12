import { useEffect, useState } from 'react';
import { getAssets } from '../api/client';
import type { BackendAsset, BackendFlightPlan } from '../api/types';
import { BragadoPlant3DMap } from './BragadoPlant3DMap';

export function resolveInspectionPlan(asset: BackendAsset, plans: BackendFlightPlan[]) {
  if(!['SILO','SILO_FLOTANTE','CELDA'].includes(asset.type))return null;
  const matches=plans.filter(plan=>plan.name===`Inspeccion 3D - ${asset.code} - perimetral-v2`&&plan.assetIds.length===1&&plan.assetIds[0]===asset.idAsset);
  return matches.length===1&&matches[0].route.length>1?matches[0]:null;
}
export function MissionAssetPicker({plans, selectedPlanId, onSelect}: {plans:BackendFlightPlan[];selectedPlanId:number|null;onSelect:(plan:BackendFlightPlan|null)=>void}) {
  const [assets,setAssets]=useState<BackendAsset[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [missing,setMissing]=useState<BackendAsset|null>(null);
  useEffect(()=>{let active=true;getAssets().then(items=>{if(active)setAssets(items);}).catch(()=>{if(active)setError('No se pudieron cargar los activos.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const plan=plans.find(p=>p.idFlightPlan===selectedPlanId)??null;
  const linked=assets.find(a=>plan&&resolveInspectionPlan(a,plans)?.idFlightPlan===plan.idFlightPlan)??null;
  useEffect(()=>{if(!loading&&selectedPlanId!==null&&!linked)onSelect(null);},[loading,selectedPlanId,linked,onSelect]);
  const selected=missing??linked;
  return <div className="mission-asset-picker">
    <BragadoPlant3DMap assets={assets} focusedAssetCode={selected?.code??null} assetSelection={{assets,selectedId:selected?.idAsset??null,route:linked?plan!.route:[],onSelect:id=>{
      const asset=assets.find(a=>a.idAsset===id)??null;
      const resolved=asset?resolveInspectionPlan(asset,plans):null;
      setMissing(asset&&!resolved?asset:null);onSelect(resolved);
    }}} />
    <p className="map-field-label" role="status">{loading?'Cargando activos...':error|| (selected?`Activo seleccionado: ${selected.name}`:'Seleccioná un activo para continuar')}</p>
    {missing&&<p className="mission-empty" role="alert">Este activo no tiene un plan de inspección único disponible. Actualizá los datos del backend.</p>}
  </div>;
}
