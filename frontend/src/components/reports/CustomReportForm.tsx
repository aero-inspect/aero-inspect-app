import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BackendAsset, BackendReport, CustomReport } from "../../api/types";
import type { Plant } from "../../types";
import { createCustomReport } from "../../api/client";
import { localPhotoDay, reportPhotos } from "../../utils/reportInsights";

export function CustomReportForm({ plant, assets, reports, onClose, onCreated }: { plant: Plant; assets: BackendAsset[]; reports: BackendReport[]; onClose:()=>void; onCreated:(report:CustomReport)=>void }) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(!dialog.current?.open)dialog.current?.showModal();},[]);
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[title,setTitle]=useState(""),[search,setSearch]=useState("");
  const [selected,setSelected]=useState<number[]>([]),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const eligible=useMemo(()=>reportPhotos(reports.filter(r=>r.status==="VALIDATED")).filter(p=>!p.discarded&&p.status==="ANALYZED"&&(!from||localPhotoDay(p.capturedAt)>=from)&&(!to||localPhotoDay(p.capturedAt)<=to)),[reports,from,to]);
  const counts=new Map<number,number>();eligible.forEach(p=>{if(p.idAsset!==null)counts.set(p.idAsset,(counts.get(p.idAsset)??0)+1);});
  const dateError=Boolean(from&&to&&from>to);
  const invalidAssets=selected.some(id=>!counts.get(id));
  const total=eligible.filter(p=>p.idAsset!==null&&selected.includes(p.idAsset)).length;
  const visible=assets.filter(a=>`${a.name} ${a.code}`.toLowerCase().includes(search.toLowerCase()));
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError("");try{onCreated(await createCustomReport({plantId:plant.id,assetIds:selected,fromDate:from,toDate:to,title}));}catch(e){setError(e instanceof Error?e.message:"No se pudo crear el reporte");}finally{setSaving(false);}};
  return <dialog ref={dialog} className="custom-report-dialog" aria-label="Crear reporte personalizado" onCancel={e=>{if(saving)e.preventDefault();else onClose();}}>
    <header><h2>Reporte personalizado</h2><button type="button" className="report-icon-button" disabled={saving} onClick={onClose} aria-label="Cerrar reporte personalizado"><X size={20}/></button></header>
    <form onSubmit={e=>void submit(e)}>
      <label>Nombre<input aria-label="Nombre del reporte personalizado" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Reporte personalizado" disabled={saving}/></label>
      <div className="custom-report-dates"><label>Desde<input aria-label="Fecha inicial del reporte personalizado" type="date" required value={from} onChange={e=>setFrom(e.target.value)} disabled={saving}/></label><label>Hasta<input aria-label="Fecha final del reporte personalizado" type="date" required min={from||undefined} value={to} onChange={e=>setTo(e.target.value)} disabled={saving}/></label></div>
      <div className="custom-report-assets-heading"><strong>Activos</strong><button type="button" className="report-link" disabled={saving} onClick={()=>setSelected(assets.filter(a=>counts.get(a.idAsset)).map(a=>a.idAsset))}>Seleccionar disponibles</button></div>
      <input aria-label="Buscar activos para reporte personalizado" placeholder="Buscar activo…" value={search} onChange={e=>setSearch(e.target.value)} disabled={saving}/>
      <div className="custom-report-assets">{visible.map(a=><label key={a.idAsset}><input type="checkbox" checked={selected.includes(a.idAsset)} disabled={saving||!counts.get(a.idAsset)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,a.idAsset]:ids.filter(id=>id!==a.idAsset))}/><span>{a.name}<small>{a.code}</small></span><small>{counts.get(a.idAsset)??0} evidencias</small></label>)}</div>
      <p className="custom-report-summary">{selected.length} activos · {total} evidencias validadas</p>
      {dateError&&<p role="alert" className="reports-feedback error">Revisá el rango de fechas.</p>}{invalidAssets&&<p role="alert" className="reports-feedback error">Algún activo seleccionado no tiene evidencias validadas en estas fechas.</p>}{error&&<p role="alert" className="reports-feedback error">{error}</p>}
      <footer><span>Solo evidencia aceptada de inspecciones validadas.</span><button className="reports-ai-button" type="submit" disabled={saving||!from||!to||dateError||!selected.length||invalidAssets}>{saving?"Creando…":"Crear reporte"}</button></footer>
    </form>
  </dialog>;
}
