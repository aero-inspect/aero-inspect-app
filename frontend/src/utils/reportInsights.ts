import type { BackendAsset, BackendInspectionPhoto, BackendReport } from "../api/types";

export const severityLabels = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja", NOT_REPORTED: "Sin gravedad informada" };
export const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NOT_REPORTED: 0 };
export type EvidenceFinding = { corrosion: boolean; crack: boolean; deformation: boolean; severity: BackendReport["severity"]; readable: boolean; crackOverlay: string | null; crackSeverity: BackendReport["severity"]; deformationOverlay: string | null; deformationSeverity: BackendReport["severity"] };
export function evidenceFinding(photo: BackendInspectionPhoto): EvidenceFinding {
  const empty: EvidenceFinding = { corrosion: false, crack: false, deformation: false, severity: "NOT_REPORTED", readable: false, crackOverlay: null, crackSeverity: "NOT_REPORTED", deformationOverlay: null, deformationSeverity: "NOT_REPORTED" };
  if (photo.discarded || photo.status !== "ANALYZED" || !photo.findings) return empty;
  try {
    const root = JSON.parse(photo.findings);
    if (!root || typeof root !== "object") return empty;
    const c = root.corrosion ?? root;
    const corrosion = c.status === "corrosion_candidate_detected" || (c.status !== "no_corrosion_detected" && Number(c.detected_area_percent) > 0);
    const crack = root.crack?.status === "crack_candidate_detected";
    const deformation = root.deformation?.status === "deformation_candidate_detected";
    const severities: Record<string, BackendReport["severity"]> = { baja: "LOW", low: "LOW", media: "MEDIUM", medium: "MEDIUM", alta: "HIGH", high: "HIGH", critica: "CRITICAL", "crítica": "CRITICAL", critical: "CRITICAL" };
    return { corrosion, crack, deformation, crackSeverity: crack ? photo.crackSeverity ?? "NOT_REPORTED" : "NOT_REPORTED", deformationSeverity: deformation ? photo.deformationSeverity ?? "NOT_REPORTED" : "NOT_REPORTED", severity: corrosion ? photo.corrosionSeverity ?? severities[String(root.severity?.predicted_severity).toLowerCase()] ?? "NOT_REPORTED" : "NOT_REPORTED", readable: ["corrosion_candidate_detected", "no_corrosion_detected"].includes(c.status) || typeof c.detected_area_percent === "number" || ["crack_candidate_detected", "no_crack_detected"].includes(root.crack?.status) || ["deformation_candidate_detected", "no_deformation_detected"].includes(root.deformation?.status), crackOverlay: root.crack?.overlay_url ?? null, deformationOverlay: root.deformation?.overlay_url ?? null };
  } catch { return empty; }
}
export function reportTime(report: BackendReport): number {
  return Math.max(Date.parse(report.createdAt) || 0, ...report.photos.map(p => Date.parse(p.capturedAt) || 0));
}
export function reportPhotos(reports: BackendReport[]): BackendInspectionPhoto[] {
  return [...new Map(reports.flatMap(r => r.photos).map(p => [p.idInspectionPhoto, p])).values()];
}
export function maximumSeverity(reports: BackendReport[]): BackendReport["severity"] {
  return reports.reduce<BackendReport["severity"]>((max, r) => severityRank[r.severity] > severityRank[max] ? r.severity : max, "NOT_REPORTED");
}
export type InspectionGroup = { id: string; name: string; date: number; reports: BackendReport[]; assetsCount: number; severity: BackendReport["severity"] };
export function groupInspections(reports: BackendReport[]): InspectionGroup[] {
  const groups = new Map<string, BackendReport[]>();
  for (const r of reports) groups.set(r.idMission, [...(groups.get(r.idMission) ?? []), r]);
  return [...groups.entries()].map(([id, items]) => ({ id, name: items[0].missionName, date: Math.max(...items.map(reportTime)), reports: [...items].sort((a,b) => (a.status === "REJECTED" ? 1 : 0) - (b.status === "REJECTED" ? 1 : 0) || severityRank[b.severity]-severityRank[a.severity] || a.assetName.localeCompare(b.assetName)), assetsCount: new Set(items.flatMap(r=>r.assets?.map(a=>a.idAsset)??(r.idAsset===null?[]:[r.idAsset]))).size, severity: maximumSeverity(items.filter(r=>r.status !== "REJECTED")) })).sort((a,b)=>b.date-a.date);
}
export type AssetInsight = { asset: BackendAsset; reports: BackendReport[]; photos: BackendInspectionPhoto[]; severity: BackendReport["severity"]; findings: number; corrosion: number; cracks: number; deformations: number; pending: boolean; category: "high" | "medium" | "low" | "review" | "clear" | "unknown"; date: number | null; label: string; tone: string };
export function assetInsights(assets: BackendAsset[], reports: BackendReport[]): AssetInsight[] {
  return assets.map(asset => {
    const history = reports.filter(r=>r.idAsset===asset.idAsset).sort((a,b)=>reportTime(b)-reportTime(a));
    const latest = history[0];
    const current = latest ? history.filter(r=>r.idMission===latest.idMission) : [];
    const accepted = current.filter(r=>r.status !== "REJECTED");
    const photos = reportPhotos(current);
    const acceptedPhotos = reportPhotos(accepted).filter(p=>!p.discarded);
    const findings = acceptedPhotos.map(evidenceFinding);
    const corrosion = findings.filter(f=>f.corrosion).length, cracks = findings.filter(f=>f.crack).length, deformations = findings.filter(f=>f.deformation).length;
    const pending = acceptedPhotos.length > 0 && (accepted.some(r=>r.status !== "VALIDATED") || acceptedPhotos.some(p=>p.status !== "ANALYZED"));
    const severity = maximumSeverity(accepted);
    let category: AssetInsight["category"] = "unknown";
    let label = latest ? "Sin resultado concluyente" : "Sin inspección registrada";
    if (accepted.length && acceptedPhotos.length) {
      if (corrosion || cracks || deformations) {
        category = severityRank[severity]>=3 ? "high" : severity === "MEDIUM" ? "medium" : severity === "LOW" ? "low" : "review";
        label = severity !== "NOT_REPORTED" ? `Gravedad ${severityLabels[severity].toLowerCase()}` : "Hallazgo sin gravedad informada";
      } else if (pending) { category="review"; label="Pendiente de revisión"; }
      else if (findings.length && findings.every(f=>f.readable)) { category="clear"; label="Sin anomalías detectadas"; }
    } else if (current.length && current.every(r=>r.status==="REJECTED")) label="Resultados descartados";
    const tones = {high:"red",medium:"amber",low:"blue",review:"violet",clear:"green",unknown:"gray"};
    return {asset,reports:current,photos,severity,findings:findings.filter(f=>f.corrosion||f.crack||f.deformation).length,corrosion,cracks,deformations,pending,category,label,tone:tones[category],date:latest ? reportTime(latest) : null};
  }).sort((a,b)=>severityRank[b.severity]-severityRank[a.severity] || b.findings-a.findings || (b.date??0)-(a.date??0) || a.asset.name.localeCompare(b.asset.name));
}
export const formatReportDate = (value: string | number | null) => value ? new Date(value).toLocaleString("es-AR", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "Sin fecha";
export const localPhotoDay = (value: string) => { const d=new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

const area = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;

export function captureAnalytics(assets: BackendAsset[], reports: BackendReport[]) {
  const affected = assetInsights(assets, reports).filter(a => a.corrosion || a.cracks || a.deformations).map(a => {
    let corrosionArea: number | null = null, crackArea: number | null = null, deformationArea: number | null = null;
    for (const photo of reportPhotos(a.reports.filter(r => r.status !== "REJECTED"))) {
      const finding = evidenceFinding(photo);
      if (!finding.readable) continue;
      const root = JSON.parse(photo.findings!);
      const corrosion = root.corrosion ?? root;
      const c = finding.corrosion ? area(corrosion.detected_area_percent) : null;
      const g = finding.crack ? area(root.crack?.detected_area_percent) : null;
      const d = finding.deformation ? area(root.deformation?.detected_area_percent) : null;
      if (c !== null) corrosionArea = Math.max(corrosionArea ?? 0, c);
      if (g !== null) crackArea = Math.max(crackArea ?? 0, g);
      if (d !== null) deformationArea = Math.max(deformationArea ?? 0, d);
    }
    return { asset: a.asset, corrosion: a.corrosion > 0, crack: a.cracks > 0, deformation: a.deformations > 0, corrosionArea, crackArea, deformationArea };
  });
  const onlyCorrosion = affected.filter(a => a.corrosion && !a.crack && !a.deformation).length;
  const onlyCrack = affected.filter(a => a.crack && !a.corrosion && !a.deformation).length;
  const onlyDeformation = affected.filter(a => a.deformation && !a.corrosion && !a.crack).length;
  const multiple = affected.length - onlyCorrosion - onlyCrack - onlyDeformation;
  return {
    affected,
    distribution: [
      { label: "Corrosión", count: onlyCorrosion, color: "#ba7b17" },
      { label: "Grietas", count: onlyCrack, color: "#8062b0" },
      { label: "Deformaciones", count: onlyDeformation, color: "#c800c8" },
      { label: "Múltiples", count: multiple, color: "#376eb3" }
    ]
  };
}
