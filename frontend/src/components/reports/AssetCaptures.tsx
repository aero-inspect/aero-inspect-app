import { useEffect, useMemo, useState } from "react";
import { Camera, Search } from "lucide-react";
import type { BackendAsset, BackendInspectionPhoto, BackendReport } from "../../api/types";
import { getAssetInspectionPhotos } from "../../api/client";
import { BACKEND_ASSET_TYPE_LABELS } from "../../api/constants";
import { CaptureAnalytics } from "./CaptureAnalytics";
import { EvidenceGallery } from "./EvidenceGallery";
import { formatReportDate, localPhotoDay } from "../../utils/reportInsights";
import { LoadingState } from "../LoadingState";

export function AssetCaptures({assets,reports,selectedId,onSelect,onReport}: {assets:BackendAsset[];reports:BackendReport[];selectedId:number|null;onSelect:(id:number)=>void;onReport:(code:string)=>void}) {
  const [search,setSearch]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const [photos,setPhotos]=useState<BackendInspectionPhoto[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const asset=assets.find(a=>a.idAsset===selectedId);
  useEffect(()=>{
    if (!asset) {setPhotos([]);setLoading(false);return;}
    let cancelled=false;setLoading(true);setError("");setPhotos([]);
    getAssetInspectionPhotos(asset.idAsset).then(p=>{if(!cancelled)setPhotos(p);}).catch(e=>{if(!cancelled)setError(e instanceof Error ? e.message : "No se pudieron cargar las capturas");}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[asset?.idAsset,refresh]);
  const filteredAssets=assets.filter(a=>`${a.name} ${a.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const dateError=Boolean(from&&to&&from>to);
  const visible=useMemo(()=>dateError ? [] : photos.filter(p=>(!from||localPhotoDay(p.capturedAt)>=from)&&(!to||localPhotoDay(p.capturedAt)<=to)),[photos,from,to,dateError]);
  const groups=useMemo(()=>{
    const map=new Map<string,BackendInspectionPhoto[]>();
    visible.forEach(p=>map.set(p.idMission,[...(map.get(p.idMission)??[]),p]));return [...map.entries()];
  },[visible]);
  return <><CaptureAnalytics assets={assets} reports={reports} selectedId={selectedId} onSelect={onSelect}/><div className="captures-layout"><aside className="report-card captures-assets"><div className="report-section-heading"><h2>Elegí un activo</h2><span>{assets.length}</span></div><label className="report-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o código" aria-label="Buscar activo"/></label><div className="captures-asset-list">{filteredAssets.map(a=><button key={a.idAsset} type="button" aria-pressed={selectedId===a.idAsset} className={selectedId===a.idAsset ? "selected" : ""} onClick={()=>onSelect(a.idAsset)}><strong>{a.name}</strong><span>{a.code} · {BACKEND_ASSET_TYPE_LABELS[a.type]}</span></button>)}{!filteredAssets.length&&<p className="report-muted">No hay activos que coincidan.</p>}</div></aside><section className="report-card captures-content"><header className="report-section-heading"><div><span className="reports-eyebrow">HISTORIAL DE EVIDENCIAS</span><h2>{asset?.name ?? "Capturas por activo"}</h2><p>{asset ? `${asset.code} · ${photos.length} capturas registradas` : "Seleccioná un activo para consultar sus fotografías e inspecciones."}</p></div>{asset&&<button type="button" className="report-secondary" onClick={()=>setRefresh(v=>v+1)}>Actualizar</button>}</header>{asset&&<><div className="captures-date-filters"><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{(from||to)&&<button className="report-link" onClick={()=>{setFrom("");setTo("");}}>Limpiar fechas</button>}</div>{dateError&&<p className="reports-feedback error" role="alert">La fecha inicial no puede ser posterior a la final.</p>}</>}{loading ? <LoadingState text="Cargando capturas..." compact/> : error ? <div role="alert"><p className="reports-feedback error">{error}</p><button className="report-secondary" onClick={()=>setRefresh(v=>v+1)}>Reintentar</button></div> : groups.length ? groups.map(([missionId,items])=><section className="captures-inspection" key={missionId}><div className="report-section-heading"><div><h3>{reports.find(r=>r.idMission===missionId)?.missionName ?? "Inspección"}</h3><p>{formatReportDate(items[0].capturedAt)} · {items.length} capturas</p></div></div><EvidenceGallery photos={items} onReport={onReport}/></section>) : <div className="report-empty"><Camera size={36}/><h3>{asset ? "No hay capturas para mostrar" : "Todo el historial, en un lugar"}</h3><p>{asset ? "Probá otro intervalo de fechas o seleccioná otro activo." : "Vas a poder abrir el original, los análisis y el reporte de cada captura."}</p></div>}</section></div></>;
}
