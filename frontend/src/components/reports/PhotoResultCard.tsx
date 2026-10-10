import type { ReactNode } from "react";
import { CalendarDays, LoaderCircle, X } from "lucide-react";
import type { AiAnalysisFindings, AiCorrosionReport, AiCrackReport, AiDeformationReport, AiSeverityReport, BackendInspectionPhoto, BackendReport } from "../../api/types";
const CORROSION_AREA_THRESHOLD = 70;

export type ReportState = "pending" | "validated" | "discarded";

export type PhotoDate = {
  value: string;
  source: "captura" | "archivo";
};

export type PhotoAnalysis = {
  id: string;
  file?: File;
  waypointId: string;
  previewUrl: string;
  photoDate: PhotoDate;
  analysis: BackendInspectionPhoto | null;
  error: string;
  isAnalyzing: boolean;
};

export function PhotoResultCard({ canRemove, index, onRemove, photo, assignment, hideSeverity = false }: { canRemove: boolean; index: number; onRemove: () => void; photo: PhotoAnalysis; assignment?: ReactNode; hideSeverity?: boolean }) {
  const findings = parseFindings(photo.analysis?.findings);
  const report = findings?.corrosion ?? null;
  const severity = findings?.severity ?? null;
  const crack = findings?.crack ?? null;
  const deformation = findings?.deformation ?? null;
  const result = report ? getResult(report, severity) : null;
  const crackResult = crack ? getCrackResult(crack) : null;
  const deformationResult = deformation ? getDeformationResult(deformation) : null;
  const overlayUrl = report?.status === "corrosion_candidate_detected" ? photo.analysis?.analyzedImageUrl ?? null : null;
  const crackOverlayUrl = crack?.status === "crack_candidate_detected" ? crack.overlay_url ?? null : null;
  const deformationOverlayUrl = deformation?.status === "deformation_candidate_detected" ? deformation.overlay_url ?? null : null;
  const imageCount = 1 + (overlayUrl ? 1 : 0) + (crackOverlayUrl ? 1 : 0) + (deformationOverlayUrl ? 1 : 0);

  return (
    <section className="real-report-photo-card">
      {canRemove && <header className="real-report-photo-header">
        <img alt={`Evidencia ${index + 1}`} src={photo.previewUrl} />
        <div>
          <span>Evidencia {index + 1}</span>
          <strong>{photo.file?.name ?? `Evidencia ${index + 1}`}</strong>
          <small>{photo.file ? formatFileSize(photo.file.size) : new Date(photo.photoDate.value).toLocaleString("es-AR")}</small>
        </div>
        {canRemove && <button aria-label={`Quitar imagen ${index + 1}`} onClick={onRemove} type="button"><X size={18} /></button>}
      </header>}

      {assignment}
      {photo.isAnalyzing && <p className="real-report-photo-progress"><LoaderCircle className="real-report-spinner" size={18} /> Procesando esta imagen...</p>}
      {photo.error && <p className="real-report-error" role="alert">{photo.error}</p>}

      {photo.analysis && report && result && (
        <div className="real-report-result" aria-live="polite">
          <div className={`real-report-images${imageCount === 3 ? " three" : imageCount === 1 ? " single" : ""}`}>
            <figure>
              <img alt={`Imagen original ${index + 1}`} src={photo.previewUrl} />
              <figcaption>Imagen original</figcaption>
            </figure>
            {overlayUrl && (
              <figure>
                <img alt={`Corrosión resaltada en evidencia ${index + 1}`} src={overlayUrl} />
                <figcaption>Corrosión resaltada</figcaption>
              </figure>
            )}
            {crackOverlayUrl && (
              <figure>
                <img alt={`Fisuras resaltadas en evidencia ${index + 1}`} src={crackOverlayUrl} />
                <figcaption>Fisuras resaltadas</figcaption>
              </figure>
            )}
            {deformationOverlayUrl && (
              <figure>
                <img alt={`Deformaciones resaltadas en evidencia ${index + 1}`} src={deformationOverlayUrl} />
                <figcaption>Deformaciones resaltadas</figcaption>
              </figure>
            )}
          </div>
          <div className={`real-report-result-badge ${result.tone}`}>{result.label}</div>
          {crackResult && <div className={`real-report-result-badge ${crackResult.tone}`}>{crackResult.label}</div>}
          {deformationResult && <div className={`real-report-result-badge ${deformationResult.tone}`}>{deformationResult.label}</div>}
          <dl className="real-report-result-data">
            <div><dt>Tipo de anomalia</dt><dd>{getAnomalyType(report, crack, deformation)}</dd></div>
            <div><dt>Fecha de la foto</dt><dd><CalendarDays size={15} /> {/^\d{4}-\d{2}-/.test(photo.photoDate.value) ? new Date(photo.photoDate.value).toLocaleString("es-AR") : photo.photoDate.value} <small>({photo.photoDate.source === "captura" ? "metadato de captura" : "fecha del archivo"})</small></dd></div>
            <div><dt>Área con corrosión</dt><dd>{formatPercent(report.detected_area_percent)}</dd></div>
            {crack && <div><dt>Área con fisuras</dt><dd>{formatPercent(crack.detected_area_percent)}</dd></div>}
            {deformation && <div><dt>Área con deformaciones</dt><dd>{formatPercent(deformation.detected_area_percent)}</dd></div>}
            {!hideSeverity && report.status === "corrosion_candidate_detected" && <div><dt>Gravedad de corrosión</dt><dd><span className={`real-report-severity ${severityTone(severity)}`} data-severity={photo.analysis?.corrosionSeverity??({baja:"LOW",media:"MEDIUM",alta:"HIGH",sin_corrosion:"NOT_REPORTED"}[severity?.predicted_severity??"sin_corrosion"])}>{photo.analysis?.corrosionSeverity ? getBackendSeverityLabel(photo.analysis.corrosionSeverity) : getSeverityLabel(severity)}</span></dd></div>}
            {!hideSeverity && crack?.status === "crack_candidate_detected" && <div><dt>Gravedad de grietas</dt><dd><span className="real-report-severity" data-severity={photo.analysis?.crackSeverity??"NOT_REPORTED"}>{photo.analysis?.crackSeverity ? getBackendSeverityLabel(photo.analysis.crackSeverity) : "Sin determinar"}</span></dd></div>}
            {!hideSeverity && deformation?.status === "deformation_candidate_detected" && <div><dt>Gravedad de deformación</dt><dd><span className="real-report-severity" data-severity={photo.analysis?.deformationSeverity??"NOT_REPORTED"}>{photo.analysis?.deformationSeverity ? getBackendSeverityLabel(photo.analysis.deformationSeverity) : "Sin determinar"}</span></dd></div>}
            <div><dt>Descripción del resultado</dt><dd>{[result.description, crackResult?.description, deformationResult?.description].filter(Boolean).join(" ")}</dd></div>

          </dl>
        </div>
      )}
      {photo.analysis && !report && <div className="real-report-result"><div className="real-report-result-badge review">RESULTADO DISPONIBLE</div><dl className="real-report-result-data"><div><dt>Tipo</dt><dd>Análisis de imagen</dd></div><div><dt>Severidad</dt><dd>No informada por IA</dd></div><div><dt>Resultado</dt><dd>{photo.analysis.findings ?? photo.analysis.status}</dd></div></dl></div>}
    </section>
  );
}

export function getReportStatus(state: ReportState) {
  if (state === "validated") return { label: "Validado", tone: "validated" };
  if (state === "discarded") return { label: "Descartado", tone: "discarded" };
  return { label: "Pendiente de validación", tone: "pending" };
}

function getResult(report: AiCorrosionReport, severity: AiSeverityReport | null) {
  const area = report.detected_area_percent;
  const severityDescription = severity ? {
    baja: "El modelo detectó una cantidad baja de corrosión visible en la superficie analizada.",
    media: "El modelo detectó una cantidad moderada de corrosión visible en la superficie analizada.",
    alta: "El modelo detectó una cantidad alta de corrosión visible en la superficie analizada.",
    sin_corrosion: "El modelo no marcó zonas compatibles con corrosión visible en esta imagen."
  }[severity.predicted_severity] : "El modelo detectó indicios compatibles con corrosión visible en la superficie analizada.";
  if (area > CORROSION_AREA_THRESHOLD) {
    return {
      label: "CORROSIÓN DETECTADA",
      tone: "detected",
      description: severityDescription
    };
  }
  if (report.status === "corrosion_candidate_detected") {
    return {
      label: "REQUIERE REVISION",
      tone: "review",
      description: severityDescription
    };
  }
  return {
    label: "SIN CORROSIÓN DETECTADA",
    tone: "clear",
    description: "El modelo no marcó zonas compatibles con corrosión visible en esta imagen."
  };
}

function getCrackResult(crack: AiCrackReport) {
  if (crack.status === "crack_candidate_detected") {
    return {
      label: "FISURA DETECTADA - REQUIERE REVISION",
      tone: "review",
      description: "El modelo marco lineas compatibles con fisuras. Validar en campo: juntas, bordes o sombras pueden generar falsas alarmas."
    };
  }
  return {
    label: "SIN FISURAS DETECTADAS",
    tone: "clear",
    description: "El modelo no marco fisuras visibles en esta imagen."
  };
}

function getDeformationResult(deformation: AiDeformationReport) {
  if (deformation.status === "deformation_candidate_detected") {
    return {
      label: "DEFORMACIÓN DETECTADA - REQUIERE REVISION",
      tone: "review",
      description: "El modelo detecto zonas compatibles con deformaciones en metal. Validar en campo: reflejos, sombras o irregularidades de soldadura pueden generar falsas alarmas."
    };
  }
  return {
    label: "SIN DEFORMACIONES DETECTADAS",
    tone: "clear",
    description: "El modelo no detecto deformaciones visibles en esta imagen."
  };
}

function getAnomalyType(report: AiCorrosionReport, crack: AiCrackReport | null, deformation?: AiDeformationReport | null) {
  const parts: string[] = [];
  if (report.status === "corrosion_candidate_detected") parts.push("Corrosion");
  if (crack?.status === "crack_candidate_detected") parts.push("Fisura");
  if (deformation?.status === "deformation_candidate_detected") parts.push("Deformacion");
  return parts.length > 0 ? parts.join(", ") : "Sin anomalias";
}

function formatPercent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "—";
}

function parseFindings(findings: string | null | undefined): AiAnalysisFindings | null {
  if (!findings) return null;
  try {
    const parsed: unknown = JSON.parse(findings);
    if (!parsed || typeof parsed !== "object") return null;
    if ("corrosion" in parsed) {
      const wrapped = parsed as AiAnalysisFindings;
      return { ...wrapped, severity: wrapped.severity ?? null, crack: wrapped.crack ?? null, deformation: wrapped.deformation ?? null };
    }
    if ("status" in parsed) return { corrosion: parsed as AiCorrosionReport, severity: null, crack: null, deformation: null };
    return null;
  } catch {
    return null;
  }
}

function getSeverityLabel(severity: AiSeverityReport | null) {
  if (!severity || severity.predicted_severity === "sin_corrosion") return "Sin determinar";
  return { baja: "Baja", media: "Media", alta: "Alta" }[severity.predicted_severity];
}

function severityTone(severity: AiSeverityReport | null) {
  return severity?.predicted_severity ?? "sin_corrosion";
}

export function getBackendSeverityLabel(severity: BackendReport["severity"]) {
  return { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica", NOT_REPORTED: "Sin determinar" }[severity];
}


function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
