import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, Ban, CalendarDays, CheckCircle2, ImagePlus, LoaderCircle, PenLine, X } from "lucide-react";
import { analyzeCorrosionImage } from "../api/client";
import type { AiCorrosionPrediction } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const CORROSION_AREA_THRESHOLD = 1;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ReportState = "pending" | "validated" | "discarded";

type PhotoDate = {
  value: string;
  source: "captura" | "archivo";
};

type PhotoAnalysis = {
  id: string;
  file: File;
  previewUrl: string;
  photoDate: PhotoDate;
  analysis: AiCorrosionPrediction | null;
  error: string;
  isAnalyzing: boolean;
};

export function ReporteDetalleRealView({ onBack }: { onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const [photos, setPhotos] = useState<PhotoAnalysis[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [validatorComments, setValidatorComments] = useState("");
  const [signature, setSignature] = useState("");
  const [validationError, setValidationError] = useState("");
  const [reportState, setReportState] = useState<ReportState>("pending");

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const isClosed = reportState !== "pending";

  const resetDecision = () => {
    setReportState("pending");
    setValidationError("");
  };

  const updatePhoto = (id: string, changes: Partial<PhotoAnalysis>) => {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...changes } : photo)));
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosenFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!chosenFiles.length) return;

    setSelectionError("");
    resetDecision();

    const availableSlots = MAX_IMAGES - photos.length;
    if (availableSlots <= 0) {
      setSelectionError("Ya se seleccionaron las 5 imagenes permitidas.");
      return;
    }

    const acceptedFiles: File[] = [];
    const errors: string[] = [];
    for (const file of chosenFiles) {
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: formato no permitido.`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: supera los 20 MB.`);
      } else if (acceptedFiles.length < availableSlots) {
        acceptedFiles.push(file);
      }
    }

    if (chosenFiles.length > availableSlots) {
      errors.push(`Solo se agregaron ${availableSlots} imagenes para respetar el maximo de ${MAX_IMAGES}.`);
    }

    const newPhotos = await Promise.all(acceptedFiles.map(async (file, index) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        previewUrl,
        photoDate: await readPhotoDate(file),
        analysis: null,
        error: "",
        isAnalyzing: false
      } satisfies PhotoAnalysis;
    }));

    setPhotos((current) => [...current, ...newPhotos]);
    setSelectionError(errors.join(" "));
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      return current.filter((photo) => photo.id !== id);
    });
    resetDecision();
  };

  const analyzeAllPhotos = async () => {
    if (!photos.length) {
      setSelectionError("Seleccione al menos una imagen antes de analizar.");
      return;
    }

    setIsAnalyzingAll(true);
    setSelectionError("");
    resetDecision();

    for (const photo of photos) {
      updatePhoto(photo.id, { analysis: null, error: "", isAnalyzing: true });
      try {
        const analysis = await analyzeCorrosionImage(photo.file);
        updatePhoto(photo.id, { analysis, error: "", isAnalyzing: false });
      } catch (error) {
        updatePhoto(photo.id, {
          analysis: null,
          error: error instanceof Error ? error.message : "No se pudo analizar esta imagen.",
          isAnalyzing: false
        });
      }
    }

    setIsAnalyzingAll(false);
  };

  const validateReport = () => {
    if (!photos.length || photos.some((photo) => !photo.analysis)) {
      setValidationError("Todas las imagenes deben analizarse correctamente antes de validar.");
      return;
    }
    if (!signature.trim()) {
      setValidationError("Ingrese el nombre de quien firma la validacion.");
      return;
    }

    setValidationError("");
    setReportState("validated");
  };

  const discardReport = () => {
    setValidationError("");
    setReportState("discarded");
  };

  const status = getReportStatus(reportState);

  return (
    <section className="real-report-page">
      <header className="real-report-topbar">
        <div>
          <button className="real-report-back" onClick={onBack} type="button">&larr; Volver a reportes</button>
          <h1>Validacion de reporte</h1>
          <p>Cargue hasta cinco evidencias, analicelas y valide el resultado.</p>
        </div>
        <AppTopActions />
      </header>

      <div className={`real-report-status ${status.tone}`} role="status">
        {reportState === "validated" ? <CheckCircle2 size={22} /> : reportState === "discarded" ? <Ban size={22} /> : <AlertTriangle size={22} />}
        <div>
          <span>Estado del reporte</span>
          <strong>{status.label}</strong>
        </div>
      </div>

      <div className="real-report-grid">
        <article className="real-report-card">
          <div className="real-report-card-title">
            <ImagePlus size={22} />
            <div>
              <h2>Analisis de corrosion</h2>
              <p>Seleccione entre una y cinco fotografias del activo inspeccionado.</p>
            </div>
          </div>

          {photos.length < MAX_IMAGES && !isClosed && (
            <div className="real-report-upload">
              <ImagePlus size={28} />
              <strong>Seleccione hasta {MAX_IMAGES - photos.length} {MAX_IMAGES - photos.length === 1 ? "imagen" : "imagenes"}</strong>
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Seleccionar archivos de imagen"
                className="real-report-file-input"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />
              <span>JPG, PNG o WebP · Maximo 20 MB por imagen</span>
            </div>
          )}

          {selectionError && <p className="real-report-error" role="alert">{selectionError}</p>}

          {!!photos.length && (
            <div className="real-report-photo-list">
              {photos.map((photo, index) => (
                <PhotoResultCard
                  canRemove={!isAnalyzingAll && !isClosed}
                  index={index}
                  key={photo.id}
                  onRemove={() => removePhoto(photo.id)}
                  photo={photo}
                />
              ))}
            </div>
          )}

          {photos.some((photo) => photo.analysis) && (
            <p className="real-report-warning"><AlertTriangle size={18} /> Los resultados son preliminares y siempre requieren revision humana.</p>
          )}

          <button
            className="real-report-analyze"
            disabled={!photos.length || isAnalyzingAll || isClosed}
            onClick={analyzeAllPhotos}
            type="button"
          >
            {isAnalyzingAll ? <LoaderCircle className="real-report-spinner" size={18} /> : <ImagePlus size={18} />}
            {isAnalyzingAll ? "Analizando imagenes..." : photos.length ? `Analizar ${photos.length} ${photos.length === 1 ? "imagen" : "imagenes"}` : "Analizar imagenes"}
          </button>
        </article>

        <article className="real-report-card real-report-validation">
          <div className="real-report-card-title">
            <PenLine size={22} />
            <div>
              <h2>Firma y validacion</h2>
              <p>Revise todos los resultados antes de decidir.</p>
            </div>
          </div>

          <label>
            <span>Comentarios del validador</span>
            <textarea
              disabled={isClosed}
              onChange={(event) => setValidatorComments(event.target.value)}
              placeholder="Agregue observaciones o correcciones..."
              rows={5}
              value={validatorComments}
            />
          </label>

          <label>
            <span>Firma digital</span>
            <input
              disabled={isClosed}
              onChange={(event) => setSignature(event.target.value)}
              placeholder="Nombre y apellido"
              type="text"
              value={signature}
            />
          </label>

          {validationError && <p className="real-report-error" role="alert">{validationError}</p>}

          <div className="real-report-decision-actions">
            <button className="real-report-discard" disabled={isClosed} onClick={discardReport} type="button">
              <Ban size={18} />
              {reportState === "discarded" ? "Reporte descartado" : "Descartar"}
            </button>
            <button className="real-report-validate" disabled={isClosed} onClick={validateReport} type="button">
              <CheckCircle2 size={18} />
              {reportState === "validated" ? "Reporte validado" : "Validar"}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function PhotoResultCard({ canRemove, index, onRemove, photo }: { canRemove: boolean; index: number; onRemove: () => void; photo: PhotoAnalysis }) {
  const result = photo.analysis ? getResult(photo.analysis) : null;
  const overlayUrl = photo.analysis ? `data:${photo.analysis.overlay.media_type};base64,${photo.analysis.overlay.data}` : "";

  return (
    <section className="real-report-photo-card">
      <header className="real-report-photo-header">
        <img alt={`Evidencia ${index + 1}`} src={photo.previewUrl} />
        <div>
          <span>Evidencia {index + 1}</span>
          <strong>{photo.file.name}</strong>
          <small>{formatFileSize(photo.file.size)}</small>
        </div>
        {canRemove && <button aria-label={`Quitar imagen ${index + 1}`} onClick={onRemove} type="button"><X size={18} /></button>}
      </header>

      {photo.isAnalyzing && <p className="real-report-photo-progress"><LoaderCircle className="real-report-spinner" size={18} /> Procesando esta imagen...</p>}
      {photo.error && <p className="real-report-error" role="alert">{photo.error}</p>}

      {photo.analysis && result && (
        <div className="real-report-result" aria-live="polite">
          <div className="real-report-images">
            <figure>
              <img alt={`Imagen original ${index + 1}`} src={photo.previewUrl} />
              <figcaption>Imagen original</figcaption>
            </figure>
            <figure>
              <img alt={`Corrosion resaltada en evidencia ${index + 1}`} src={overlayUrl} />
              <figcaption>Resultado del analisis</figcaption>
            </figure>
          </div>
          <div className={`real-report-result-badge ${result.tone}`}>{result.label}</div>
          <dl className="real-report-result-data">
            <div><dt>Tipo de anomalia</dt><dd>Corrosion</dd></div>
            <div><dt>Fecha de la foto</dt><dd><CalendarDays size={15} /> {photo.photoDate.value} <small>({photo.photoDate.source === "captura" ? "metadato de captura" : "fecha del archivo"})</small></dd></div>
            <div><dt>Area detectada</dt><dd>{photo.analysis.report.detected_area_percent.toFixed(2)}%</dd></div>
            <div><dt>Descripcion del resultado</dt><dd>{result.description}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}

function getReportStatus(state: ReportState) {
  if (state === "validated") return { label: "Validado", tone: "validated" };
  if (state === "discarded") return { label: "Descartado", tone: "discarded" };
  return { label: "Pendiente de validacion", tone: "pending" };
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

async function readPhotoDate(file: File): Promise<PhotoDate> {
  if (file.type === "image/jpeg") {
    try {
      const exifDate = readExifCaptureDate(await file.slice(0, 512 * 1024).arrayBuffer());
      if (exifDate) return { value: formatDate(exifDate), source: "captura" };
    } catch {
      // Algunas imagenes no incluyen EXIF o contienen metadatos no estandar.
    }
  }
  return { value: formatDate(new Date(file.lastModified)), source: "archivo" };
}

function readExifCaptureDate(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;

  let markerOffset = 2;
  while (markerOffset + 4 <= view.byteLength) {
    const marker = view.getUint16(markerOffset, false);
    markerOffset += 2;
    if ((marker & 0xff00) !== 0xff00 || markerOffset + 2 > view.byteLength) break;
    const segmentLength = view.getUint16(markerOffset, false);
    if (segmentLength < 2 || markerOffset + segmentLength > view.byteLength) break;

    if (marker === 0xffe1 && segmentLength >= 14 && ascii(view, markerOffset + 2, 6) === "Exif\u0000\u0000") {
      return readTiffDate(view, markerOffset + 8);
    }
    markerOffset += segmentLength;
  }
  return null;
}

function readTiffDate(view: DataView, tiffStart: number) {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart, false);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return null;

  const read16 = (offset: number) => view.getUint16(offset, littleEndian);
  const read32 = (offset: number) => view.getUint32(offset, littleEndian);
  if (read16(tiffStart + 2) !== 42) return null;

  const readTag = (ifdOffset: number, tag: number) => {
    const directory = tiffStart + ifdOffset;
    if (directory + 2 > view.byteLength) return null;
    const count = read16(directory);
    for (let index = 0; index < count; index += 1) {
      const entry = directory + 2 + index * 12;
      if (entry + 12 > view.byteLength) return null;
      if (read16(entry) === tag) return entry;
    }
    return null;
  };

  const ifd0Offset = read32(tiffStart + 4);
  const exifPointer = readTag(ifd0Offset, 0x8769);
  const originalDateEntry = exifPointer ? readTag(read32(exifPointer + 8), 0x9003) : null;
  const dateEntry = originalDateEntry ?? readTag(ifd0Offset, 0x0132);
  if (!dateEntry) return null;

  const characterCount = read32(dateEntry + 4);
  const valueStart = characterCount <= 4 ? dateEntry + 8 : tiffStart + read32(dateEntry + 8);
  if (!characterCount || valueStart + characterCount > view.byteLength) return null;
  const rawDate = ascii(view, valueStart, characterCount).replace(/\u0000/g, "").trim();
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(rawDate);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
}

function ascii(view: DataView, start: number, length: number) {
  let value = "";
  for (let index = 0; index < length && start + index < view.byteLength; index += 1) {
    value += String.fromCharCode(view.getUint8(start + index));
  }
  return value;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
