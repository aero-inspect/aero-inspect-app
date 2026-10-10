import { useEffect, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Download, Eye, PenLine } from "lucide-react";
import { downloadReportPdf, getAssets, getReport, validateReport, saveEvidenceReviews } from "../api/client";
import type { BackendReport, EvidenceReview, BackendInspectionPhoto } from "../api/types";
import { useSelectedPlant } from "../data/PlantContext";
import { AppTopActions } from "../components/AppTopActions";
import { LoadingState } from "../components/LoadingState";
import { PhotoResultCard, getReportStatus } from "../components/reports/PhotoResultCard";
import { SeverityDropdown } from "../components/reports/SeverityDropdown";
import { evidenceFinding } from "../utils/reportInsights";

export function ReporteDetalleRealView({ onBack, reportCode, onViewAsset }: {
 onBack: () => void; reportCode: string | null; onViewAsset: (id:number)=>void;
}) {
 const plant=useSelectedPlant();
 const [report,setReport]=useState<BackendReport|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[saved,setSaved]=useState(""),[signature,setSignature]=useState("");
 const [reviews,setReviews]=useState<Record<string,EvidenceReview>>({});
 const [dirty,setDirty]=useState(false);
 const apply=(next:BackendReport)=>{
  setDirty(false);setReport(next);setSignature(next.validatorSignature??"");
  setReviews(Object.fromEntries(next.photos.map(p=>[p.idInspectionPhoto,{idInspectionPhoto:p.idInspectionPhoto,corrosionSeverity:p.corrosionSeverity??null,crackSeverity:p.crackSeverity??null,deformationSeverity:p.deformationSeverity??null,comments:p.validatorComments??"",discarded:p.discarded??false}])));
 };
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError("");setReport(null);setSaved("");
  if(!reportCode){setError("Seleccioná un reporte desde el historial.");setLoading(false);return;}
  Promise.all([getReport(reportCode),getAssets(plant)]).then(([next,assets])=>{
   if(cancelled)return;
   const ids=next.assets?.map(a=>a.idAsset)??[next.idAsset];
   if(!ids.length || ids.some(id=>!assets.some(a=>a.idAsset===id)))throw new Error("La inspección no pertenece a la planta seleccionada.");
   apply(next);
  }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"No se pudo cargar la inspección.");}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[reportCode,plant.id]);
 const closed=report?.status==="VALIDATED"||report?.status==="REJECTED";
 const status=getReportStatus(report?.status==="VALIDATED"?"validated":report?.status==="REJECTED"?"discarded":"pending");
 const update=(id:string,change:Partial<EvidenceReview>)=>{setReviews(current=>({...current,[id]:{...current[id],...change}}));setSaved("");setDirty(true);};
 const payload=()=>Object.values(reviews);
 const save=async()=>{
  if(!report)return;setSaving(true);setError("");setSaved("");
  try{const sign=signature;apply(await saveEvidenceReviews(report.code,payload()));setSignature(sign);setSaved("Revisión guardada.");}
  catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la revisión.");}finally{setSaving(false);}
 };
 const decide=async(approved:boolean)=>{
  if(!report)return;
  if(!signature.trim()){setError("Ingresá el nombre de quien firma la validación.");return;}
  setSaving(true);setError("");setSaved("");
  try{apply(await validateReport(report.code,signature,"",approved,payload()));}
  catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la decisión.");}finally{setSaving(false);}
 };
 const exportPdf=async(inline:boolean)=>{
  if(!report)return;setError("");
  try{if(dirty){const sign=signature;apply(await saveEvidenceReviews(report.code,payload()));setSignature(sign);}await downloadReportPdf(report.code,inline);}catch(e){setError(e instanceof Error?e.message:"No se pudo generar el PDF.");}
 };
 const reviewPanel=(photo:BackendInspectionPhoto)=>{
  const f=evidenceFinding(photo),review=reviews[photo.idInspectionPhoto];if(!review)return null;
  if(closed && review.discarded)return <p className="evidence-discard-note">Evidencia descartada</p>;
  if(closed)return review.comments.trim()?<p className="evidence-validator-comment"><strong>Comentario del validador: </strong>{review.comments}</p>:null;
  return <div className={`evidence-validation${review.discarded ? " discarded" : ""}`}>
   <button type="button" className="evidence-discard-toggle" aria-pressed={review.discarded??false} disabled={saving} onClick={()=>update(photo.idInspectionPhoto,{discarded:!review.discarded})}>{review.discarded ? "Restaurar evidencia" : "Descartar evidencia"}</button>
   {review.discarded && <span className="evidence-discard-note">Descartada · no se incluirá en el reporte validado</span>}
   <div className="evidence-gravity-fields">
    {f.corrosion && <label><span>Gravedad de corrosión</span><SeverityDropdown label={`Gravedad de corrosión de evidencia ${report!.photos.findIndex(p=>p.idInspectionPhoto===photo.idInspectionPhoto)+1}`} disabled={saving||Boolean(review.discarded)||photo.status!=="ANALYZED"} value={review.corrosionSeverity??f.severity} onChange={value=>update(photo.idInspectionPhoto,{corrosionSeverity:value})}/></label>}
    {f.crack && <label><span>Gravedad de grietas</span><SeverityDropdown label={`Gravedad de grietas de evidencia ${report!.photos.findIndex(p=>p.idInspectionPhoto===photo.idInspectionPhoto)+1}`} disabled={saving||Boolean(review.discarded)||photo.status!=="ANALYZED"} value={review.crackSeverity??"NOT_REPORTED"} onChange={value=>update(photo.idInspectionPhoto,{crackSeverity:value})}/></label>}
    {f.deformation && <label><span>Gravedad de deformación</span><SeverityDropdown label={`Gravedad de deformación de evidencia ${report!.photos.findIndex(p=>p.idInspectionPhoto===photo.idInspectionPhoto)+1}`} disabled={saving||Boolean(review.discarded)||photo.status!=="ANALYZED"} value={review.deformationSeverity??"NOT_REPORTED"} onChange={value=>update(photo.idInspectionPhoto,{deformationSeverity:value})}/></label>}
   </div>
   <label><span>Comentario del validador <small>(opcional)</small></span><textarea aria-label={`Comentario de evidencia ${report!.photos.findIndex(p=>p.idInspectionPhoto===photo.idInspectionPhoto)+1}`} maxLength={4000} rows={2} disabled={closed||saving} placeholder="Observaciones sobre esta evidencia…" value={review.comments} onChange={e=>update(photo.idInspectionPhoto,{comments:e.target.value})}/></label>
  </div>;
 };
 return <section className="real-report-page">
  <header className="real-report-topbar"><div><button className="real-report-back" onClick={onBack}>← Volver a reportes</button><h1>Reporte de inspección</h1></div><AppTopActions/></header>
  {loading&&<LoadingState text="Cargando inspección…" compact/>}{error&&<p className="real-report-error" role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}
  {report&&<>
   <div className="real-report-document-actions"><button onClick={()=>void exportPdf(true)}><Eye size={17}/> Visualizar PDF</button><button onClick={()=>void exportPdf(false)}><Download size={17}/> Descargar PDF</button></div>
   <div className={`real-report-status ${status.tone}`} role="status">{closed?<CheckCircle2 size={22}/>:<AlertTriangle size={22}/>}<div><span>Estado del reporte</span><strong>{status.label}</strong></div></div>
   <dl className="real-report-summary"><div><dt>Inspección</dt><dd>{report.missionName}</dd></div><div><dt>Código</dt><dd>{report.code}</dd></div><div><dt>Activos</dt><dd>{report.assets?.length??1}</dd></div><div><dt>Evidencias</dt><dd>{report.photos.length}</dd></div></dl>
   <div className="real-report-grid"><article className="real-report-card"><div className="real-report-photo-list">{(report.assets??(report.idAsset===null?[]:[{idAsset:report.idAsset,assetName:report.assetName,photos:report.photos}])).map(asset=><section className="inspection-evidence-asset" key={asset.idAsset}><header><button className="report-link" onClick={()=>onViewAsset(asset.idAsset)} title="Ver historial de capturas del activo"><h2>{asset.assetName}</h2></button><span>{asset.photos.length} capturas</span></header>{!asset.photos.length&&<p>Sin evidencia en esta inspección.</p>}{asset.photos.map(photo=><div key={photo.idInspectionPhoto}><PhotoResultCard hideSeverity={!closed} index={report.photos.findIndex(p=>p.idInspectionPhoto===photo.idInspectionPhoto)} canRemove={false} onRemove={()=>{}} photo={{id:photo.idInspectionPhoto,waypointId:photo.idMissionWaypoint,previewUrl:photo.rawImageUrl,photoDate:{value:photo.capturedAt,source:"captura"},analysis:photo,error:"",isAnalyzing:false}}/>{reviewPanel(photo)}</div>)}</section>)}</div></article>
   <article className="real-report-card real-report-validation inspection-final-validation"><div className="real-report-card-title"><PenLine size={22}/><h2>Validación de inspección</h2></div>{!closed&&<button className="report-secondary" disabled={saving} onClick={()=>void save()}>Guardar revisión</button>}{dirty&&<small>Cambios sin guardar</small>}<label><span>Firma</span><input disabled={closed||saving} placeholder="Nombre y apellido" value={signature} onChange={e=>setSignature(e.target.value)}/></label><div className="real-report-decision-actions"><button className="real-report-discard" disabled={closed||saving} onClick={()=>void decide(false)}><Ban size={18}/>Descartar inspección</button><button className="real-report-validate" disabled={closed||saving||!report.photos.some(p=>!reviews[p.idInspectionPhoto]?.discarded)||report.photos.some(p=>!reviews[p.idInspectionPhoto]?.discarded&&p.status!=="ANALYZED")} onClick={()=>void decide(true)}><CheckCircle2 size={18}/>Validar inspección</button></div></article></div>
  </>}
 </section>;
}
