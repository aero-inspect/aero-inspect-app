import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, LoaderCircle, PenLine, X } from "lucide-react";
import { analyzeCorrosionImage } from "../api/client";
import type { AiCorrosionPrediction } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const CORROSION_AREA_THRESHOLD = 1;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ReporteDetalleRealView({ onBack }: { onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState<AiCorrosionPrediction | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validatorComments, setValidatorComments] = useState("");
  const [signature, setSignature] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const resetValidation = () => {
    setIsValidated(false);
    setValidationError("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setAnalysis(null);
    setAnalysisError("");
    resetValidation();

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setAnalysisError("Seleccione una imagen JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setAnalysisError("La imagen no puede superar los 20 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const clearImage = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setAnalysisError("");
    resetValidation();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyzeImage = async () => {
    if (!selectedFile) {
      setAnalysisError("Seleccione una imagen antes de analizar.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysis(null);
    resetValidation();
    try {
      setAnalysis(await analyzeCorrosionImage(selectedFile));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "No se pudo analizar la imagen.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const validateReport = () => {
    if (!analysis) {
      setValidationError("Primero debe analizar una imagen.");
      return;
    }
    if (!signature.trim()) {
      setValidationError("Ingrese el nombre de quien firma la validacion.");
      return;
    }

    setValidationError("");
    setIsValidated(true);
  };

  const result = analysis ? getResult(analysis) : null;
  const overlayUrl = analysis
    ? `data:${analysis.overlay.media_type};base64,${analysis.overlay.data}`
    : "";

  return (
    <section className="real-report-page">
      <header className="real-report-topbar">
        <div>
          <button className="real-report-back" onClick={onBack} type="button">← Volver a reportes</button>
          <h1>Validacion de reporte</h1>
          <p>Cargue una evidencia, analicela y valide el resultado.</p>
        </div>
        <AppTopActions />
      </header>

      <div className={`real-report-status ${isValidated ? "validated" : "pending"}`} role="status">
        {isValidated ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
        <div>
          <span>Estado del reporte</span>
          <strong>{isValidated ? "Validado" : "Pendiente de validacion"}</strong>
        </div>
      </div>

      <div className="real-report-grid">
        <article className="real-report-card">
          <div className="real-report-card-title">
            <ImagePlus size={22} />
            <div>
              <h2>Analisis de corrosion</h2>
              <p>Seleccione una fotografia del activo inspeccionado.</p>
            </div>
          </div>

          {!selectedFile ? (
            <div className="real-report-upload">
              <ImagePlus size={28} />
              <strong>Seleccione una imagen</strong>
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Seleccionar archivo de imagen"
                className="real-report-file-input"
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />
              <span>JPG, PNG o WebP · Maximo 20 MB</span>
            </div>
          ) : (
            <div className="real-report-selected-file">
              <img alt="Imagen seleccionada para analizar" src={previewUrl} />
              <div>
                <strong>{selectedFile.name}</strong>
                <span>{formatFileSize(selectedFile.size)}</span>
              </div>
              <button aria-label="Quitar imagen" onClick={clearImage} type="button"><X size={18} /></button>
            </div>
          )}

          <button className="real-report-analyze" disabled={!selectedFile || isAnalyzing} onClick={analyzeImage} type="button">
            {isAnalyzing ? <LoaderCircle className="real-report-spinner" size={18} /> : <ImagePlus size={18} />}
            {isAnalyzing ? "Analizando..." : "Analizar imagen"}
          </button>

          {analysisError && <p className="real-report-error" role="alert">{analysisError}</p>}

          {analysis && result && (
            <section className="real-report-result" aria-live="polite">
              <div className="real-report-images">
                <figure>
                  <img alt="Imagen original analizada" src={previewUrl} />
                  <figcaption>Imagen original</figcaption>
                </figure>
                <figure>
                  <img alt="Corrosion detectada resaltada" src={overlayUrl} />
                  <figcaption>Resultado del analisis</figcaption>
                </figure>
              </div>
              <div className={`real-report-result-badge ${result.tone}`}>{result.label}</div>
              <dl className="real-report-result-data">
                <div><dt>Area detectada</dt><dd>{analysis.report.detected_area_percent.toFixed(2)}%</dd></div>
                <div><dt>Descripcion del resultado</dt><dd>{result.description}</dd></div>
              </dl>
              <p className="real-report-warning"><AlertTriangle size={18} /> El resultado es preliminar y siempre requiere revision humana.</p>
            </section>
          )}
        </article>

        <article className="real-report-card real-report-validation">
          <div className="real-report-card-title">
            <PenLine size={22} />
            <div>
              <h2>Firma y validacion</h2>
              <p>Revise el resultado antes de validar el reporte.</p>
            </div>
          </div>

          <label>
            <span>Comentarios del validador</span>
            <textarea
              disabled={isValidated}
              onChange={(event) => setValidatorComments(event.target.value)}
              placeholder="Agregue observaciones o correcciones..."
              rows={5}
              value={validatorComments}
            />
          </label>

          <label>
            <span>Firma digital</span>
            <input
              disabled={isValidated}
              onChange={(event) => setSignature(event.target.value)}
              placeholder="Nombre y apellido"
              type="text"
              value={signature}
            />
          </label>

          {validationError && <p className="real-report-error" role="alert">{validationError}</p>}

          <button className="real-report-validate" disabled={isValidated} onClick={validateReport} type="button">
            <CheckCircle2 size={18} />
            {isValidated ? "Reporte validado" : "Validar reporte"}
          </button>
        </article>
      </div>
    </section>
  );
}

function getResult(prediction: AiCorrosionPrediction) {
  const area = prediction.report.detected_area_percent;
  if (area > CORROSION_AREA_THRESHOLD) {
    return {
      label: "CORROSION DETECTADA",
      tone: "detected",
      description: "El modelo marco zonas compatibles con corrosion visible en la superficie analizada."
    };
  }
  if (prediction.report.status === "corrosion_candidate_detected") {
    return {
      label: "REQUIERE REVISION",
      tone: "review",
      description: "El modelo encontro una zona pequena que debe ser confirmada por una persona."
    };
  }
  return {
    label: "SIN CORROSION DETECTADA",
    tone: "clear",
    description: "El modelo no marco zonas compatibles con corrosion visible en esta imagen."
  };
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
