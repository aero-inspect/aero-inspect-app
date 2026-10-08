import { useEffect, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Download, Eye, PenLine } from "lucide-react";
import { downloadReportPdf, getAssets, getReport, validateReport } from "../api/client";
import type { BackendReport } from "../api/types";
import { useSelectedPlant } from "../data/PlantContext";
import { AppTopActions } from "../components/AppTopActions";
import { LoadingState } from "../components/LoadingState";
import { PhotoResultCard, getBackendSeverityLabel, getReportStatus } from "../components/reports/PhotoResultCard";

// Permanent report view: reads and validates saved evidence, regardless of its source.
export function ReporteDetalleRealView({ onBack, reportCode }: { onBack: () => void; reportCode: string | null }) {
  const plant = useSelectedPlant();
  const [report, setReport] = useState<BackendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState("");
  const [signature, setSignature] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setReport(null); setError("");
    if (!reportCode) { setError("Seleccioná un reporte desde el historial."); setLoading(false); return; }
    Promise.all([getReport(reportCode), getAssets(plant)]).then(([saved, assets]) => {
      if (cancelled) return;
      if (!assets.some(asset => asset.idAsset === saved.idAsset)) throw new Error("El reporte no pertenece a la planta seleccionada.");
      setReport(saved); setComments(saved.validatorComments ?? ""); setSignature(saved.validatorSignature ?? "");
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar el reporte."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reportCode, plant.id]);
  const closed = report?.status === "VALIDATED" || report?.status === "REJECTED";
  const status = getReportStatus(report?.status === "VALIDATED" ? "validated" : report?.status === "REJECTED" ? "discarded" : "pending");
  const exportPdf = async (inline: boolean) => {
    if (!report) return;
    setError("");
    try { await downloadReportPdf(report.code, inline); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo descargar el PDF."); }
  };
  const decide = async (approved: boolean) => {
    if (!report || !signature.trim()) { setError("Ingresá el nombre de quien firma la validación."); return; }
    if (approved && (!report.photos.length || report.photos.some(photo => photo.status !== "ANALYZED"))) {
      setError("Todas las imágenes deben analizarse correctamente antes de validar."); return;
    }
    setSaving(true); setError("");
    try { setReport(await validateReport(report.code, signature, comments, approved)); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la decisión."); }
    finally { setSaving(false); }
  };
  return <section className="real-report-page">
    <header className="real-report-topbar"><div><button className="real-report-back" type="button" onClick={onBack}>← Volver a reportes</button><h1>Detalle del reporte</h1><p>Consultá las evidencias guardadas, validá y descargá el reporte.</p></div><AppTopActions /></header>
    {loading && <LoadingState text="Cargando reporte..." compact />}
    {error && <p className="real-report-error" role="alert">{error}</p>}
    {report && <>
      <div className="real-report-document-actions"><button type="button" onClick={() => void exportPdf(true)}><Eye size={17}/> Visualizar PDF</button><button type="button" onClick={() => void exportPdf(false)}><Download size={17}/> Descargar PDF</button></div>
      <div className={`real-report-status ${status.tone}`} role="status">{report.status === "VALIDATED" ? <CheckCircle2 size={22}/> : report.status === "REJECTED" ? <Ban size={22}/> : <AlertTriangle size={22}/>}<div><span>Estado del reporte</span><strong>{status.label}</strong></div></div>
      <dl className="real-report-summary"><div><dt>Código</dt><dd>{report.code}</dd></div><div><dt>Activo</dt><dd>{report.assetName}</dd></div><div><dt>Misión</dt><dd>{report.missionName}</dd></div><div><dt>Fecha</dt><dd>{new Date(report.createdAt).toLocaleString("es-AR")}</dd></div><div><dt>Hallazgos</dt><dd>{report.findingsCount}<small> ({report.corrosionFindingsCount ?? 0} corrosión · {report.crackFindingsCount ?? 0} fisuras)</small></dd></div><div><dt>Severidad</dt><dd>{getBackendSeverityLabel(report.severity)}</dd></div></dl>
      <div className="real-report-grid"><article className="real-report-card"><h2>Hallazgos y evidencias</h2><p>Resultados de la inspección asociados a este activo.</p><div className="real-report-photo-list">{report.photos.map((photo, index) => <PhotoResultCard key={photo.idInspectionPhoto} index={index} canRemove={false} onRemove={() => {}} photo={{ id: photo.idInspectionPhoto, waypointId: photo.idMissionWaypoint, previewUrl: photo.rawImageUrl, photoDate: { value: photo.capturedAt, source: "captura" }, analysis: photo, error: "", isAnalyzing: false }}/>)}</div><p className="real-report-warning"><AlertTriangle size={18}/> Los resultados siempre requieren revisión humana.</p></article>
      <article className="real-report-card real-report-validation"><div className="real-report-card-title"><PenLine size={22}/><div><h2>Firma y validación</h2><p>Revise todos los resultados antes de decidir.</p></div></div><label><span>Comentarios del validador</span><textarea disabled={closed || saving} rows={5} placeholder="Agregue observaciones o correcciones..." value={comments} onChange={e => setComments(e.target.value)}/></label><label><span>Firma digital</span><input disabled={closed || saving} placeholder="Nombre y apellido" value={signature} onChange={e => setSignature(e.target.value)}/></label><div className="real-report-decision-actions"><button className="real-report-discard" disabled={closed || saving} type="button" onClick={() => void decide(false)}><Ban size={18}/>{report.status === "REJECTED" ? "Reporte descartado" : "Descartar"}</button><button className="real-report-validate" disabled={closed || saving} type="button" onClick={() => void decide(true)}><CheckCircle2 size={18}/>{report.status === "VALIDATED" ? "Reporte validado" : "Validar"}</button></div></article></div>
    </>}
  </section>;
}
