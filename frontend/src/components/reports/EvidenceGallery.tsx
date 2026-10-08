import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Eye, Image as ImageIcon, X } from "lucide-react";
import type { BackendInspectionPhoto } from "../../api/types";
import { evidenceFinding, formatReportDate, severityLabels } from "../../utils/reportInsights";

function EvidenceImage({ src, alt }: {src:string;alt:string}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return failed ? <div className="evidence-unavailable"><ImageIcon size={26}/><span>Imagen no disponible</span></div> : <img src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>;
}
function PhotoDialog({photo,onClose,onReport}: {photo:BackendInspectionPhoto;onClose:()=>void;onReport?:(code:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if (!dialog.current?.open) dialog.current?.showModal();},[]);
  const f=evidenceFinding(photo);
  return <dialog ref={dialog} className="evidence-dialog" onCancel={onClose} aria-label="Detalle de captura">
    <header><div><span className="reports-eyebrow">EVIDENCIA DE INSPECCIÓN</span><h2>Captura · {formatReportDate(photo.capturedAt)}</h2></div><button className="report-icon-button" onClick={onClose} aria-label="Cerrar captura"><X size={20}/></button></header>
    <div className="evidence-dialog-images"><figure><EvidenceImage src={photo.rawImageUrl} alt="Captura original del activo"/><figcaption>Original</figcaption></figure>{photo.analyzedImageUrl && <figure><EvidenceImage src={photo.analyzedImageUrl} alt="Resultado del análisis de corrosión"/><figcaption>Análisis de corrosión</figcaption></figure>}{f.crackOverlay && <figure><EvidenceImage src={f.crackOverlay} alt="Resultado del análisis de grietas"/><figcaption>Análisis de grietas</figcaption></figure>}</div>
    <div className="evidence-result"><strong>{photo.status==="PENDING_ANALYSIS" ? "Análisis pendiente" : photo.status==="ANALYSIS_FAILED" ? "No se pudo analizar esta captura" : !f.readable ? "Resultado no disponible" : f.corrosion||f.crack ? [f.corrosion ? "Corrosión" : "",f.crack ? "Fisuras / grietas" : ""].filter(Boolean).join(" · ") : "Sin anomalías detectadas"}</strong>{f.corrosion && <span>Gravedad: {severityLabels[f.severity]}</span>}{f.crack && <span>La gravedad de las grietas requiere evaluación humana.</span>}</div>
    <footer><span>Inspección vinculada · {photo.reportCode ?? "Sin reporte asociado"}</span>{photo.reportCode && onReport && <button className="reports-ai-button" onClick={()=>{onClose();onReport(photo.reportCode!);}}><Eye size={16}/> Ver reporte</button>}</footer>
  </dialog>;
}
export function EvidenceGallery({photos,onReport}: {photos:BackendInspectionPhoto[];onReport?:(code:string)=>void}) {
  const [selected,setSelected]=useState<BackendInspectionPhoto|null>(null);
  useEffect(()=>setSelected(null),[photos]);
  return <><div className="evidence-gallery">{photos.map(p=>{const f=evidenceFinding(p);return <button type="button" className="evidence-card" key={p.idInspectionPhoto} onClick={()=>setSelected(p)}><div className="evidence-thumbnail"><EvidenceImage src={p.rawImageUrl} alt={`Captura del ${formatReportDate(p.capturedAt)}`}/><span><Eye size={15}/> Ampliar</span></div><div className="evidence-caption"><strong>{formatReportDate(p.capturedAt)}</strong><span>{p.status==="PENDING_ANALYSIS" ? "Analizando" : p.status==="ANALYSIS_FAILED" ? "Análisis fallido" : f.corrosion||f.crack ? <><AlertTriangle size={13}/> {[f.corrosion&&"Corrosión",f.crack&&"Grietas"].filter(Boolean).join(" · ")}</> : f.readable ? "Sin anomalías detectadas" : "Sin resultado"}</span><small>{p.reportCode ?? "Sin reporte asociado"}</small></div></button>;})}</div>{selected && <PhotoDialog photo={selected} onClose={()=>setSelected(null)} onReport={onReport}/>}</>;
}
