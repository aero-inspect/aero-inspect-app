import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, Ban, CheckCircle2, ImagePlus, LoaderCircle, PenLine } from "lucide-react";
import { createReport, downloadInspectionPdf, downloadReportPdf, getAssets, getInspectionPhoto, getMissions, getReport, uploadInspectionPhoto, validateReport as saveValidation } from "../api/client";
import type { BackendAsset, BackendInspectionPhoto, BackendMission, BackendReport } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";
import { PhotoResultCard, getReportStatus, getBackendSeverityLabel } from "../components/reports/PhotoResultCard";
import type { PhotoAnalysis, PhotoDate, ReportState } from "../components/reports/PhotoResultCard";

import { useSelectedPlant } from "../data/PlantContext";
import { manualAssetOptions } from "../utils/manualInspection";

const MAX_IMAGES = 50;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_ATTEMPTS = 120;

export function ManualAnalysisView({ onBack }: { onBack: () => void }) {
  const plant = useSelectedPlant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const [photos, setPhotos] = useState<PhotoAnalysis[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [validatorComments, setValidatorComments] = useState("");
  const [signature, setSignature] = useState("");
  const [validationError, setValidationError] = useState("");
  const [reportState, setReportState] = useState<ReportState>("pending");
  const [missions, setMissions] = useState<BackendMission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [selectedWaypointId, setSelectedWaypointId] = useState("");
  const [missionsError, setMissionsError] = useState("");
  const [isLoadingMissions, setIsLoadingMissions] = useState(true);
  const [assets, setAssets] = useState<BackendAsset[]>([]);
  const [generatedReports, setGeneratedReports] = useState<BackendReport[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMissions(plant), getAssets(plant)])
      .then(([availableMissions, availableAssets]) => {
        if (cancelled) return;
        setAssets(availableAssets);
        const withWaypoints = availableMissions.filter(mission => manualAssetOptions(mission, availableAssets).length);
        setMissions(withWaypoints);
        if (withWaypoints[0]) {
          setSelectedMissionId(withWaypoints[0].idMission);
          setSelectedWaypointId(manualAssetOptions(withWaypoints[0], availableAssets).length === 1 ? manualAssetOptions(withWaypoints[0], availableAssets)[0].waypointId : "");
        } else if (!withWaypoints.length) {
          setMissionsError("No hay una misión con puntos de inspección disponibles.");
        }
      })
      .catch((error) => {
        if (!cancelled) setMissionsError(error instanceof Error ? error.message : "No se pudieron cargar las misiones.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMissions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plant.id]);

  const activeReports = generatedReports;
  const mission = missions.find(item => item.idMission === selectedMissionId);
  const assetOptions = manualAssetOptions(mission, assets);
  const assignmentsComplete = photos.every(photo => assetOptions.some(option => option.waypointId === photo.waypointId));
  const busy = isAnalyzingAll || isSavingDecision;
  const assignmentLocked = busy || activeReports.some(report => report.status === "VALIDATED" || report.status === "REJECTED");
  const isClosed = reportState !== "pending";

  const resetDecision = () => {
    setReportState("pending");
    setValidationError("");
  };

  const handleMissionChange = (idMission: string) => {
    if (activeReports.length || busy) return;
    setSelectedMissionId(idMission);
    const options = manualAssetOptions(missions.find(item => item.idMission === idMission), assets);
    const automatic = options.length === 1 ? options[0].waypointId : "";
    setSelectedWaypointId(automatic);
    setPhotos(current => current.map(photo => ({ ...photo, waypointId: automatic })));
    setSelectedPhotos(new Set());
  };

  const assignSelectedPhotos = () => {
    if (!assetOptions.some(option => option.waypointId === selectedWaypointId)) return;
    setPhotos(current => current.map(photo => selectedPhotos.has(photo.id) && !photo.analysis
      ? { ...photo, waypointId: selectedWaypointId } : photo));
    setSelectedPhotos(new Set());
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
      setSelectionError(`Ya se alcanzó el máximo de ${MAX_IMAGES} imágenes.`);
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
      errors.push(`Solo se agregaron ${availableSlots} imágenes para respetar el máximo de ${MAX_IMAGES}.`);
    }

    const newPhotos = await Promise.all(acceptedFiles.map(async (file, index) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        waypointId: assetOptions.length === 1 ? assetOptions[0].waypointId : "",
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
    setSelectedPhotos(current => { const next = new Set(current); next.delete(id); return next; });
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

  const rememberReport = (report: BackendReport) => {
    setGeneratedReports(current => [...current.filter(item => item.code !== report.code), report]);
  };

  const analyzeAllPhotos = async () => {
    if (!photos.length || !selectedMissionId || !assignmentsComplete) {
      setSelectionError("Asigná un activo del recorrido a cada foto antes de analizar.");
      return;
    }
    setIsAnalyzingAll(true);
    setSelectionError("");
    setSelectedPhotos(new Set());
    resetDecision();
    const reportsByAsset = new Map(activeReports.map(report => [report.idAsset, report]));
    try {
      for (const photo of photos) {
        if (photo.analysis?.status === "ANALYZED" || !photo.file) continue;
        const option = assetOptions.find(item => item.waypointId === photo.waypointId)!;
        updatePhoto(photo.id, { error: "", isAnalyzing: true });
        try {
          let report = reportsByAsset.get(option.idAsset);
          if (!report) {
            report = await createReport(selectedMissionId, option.idAsset);
            reportsByAsset.set(option.idAsset, report);
            rememberReport(report);
          }
          // Preserve a registered photo on retry, so polling never uploads it twice.
          let registered = photo.analysis;
          if (!registered) {
            registered = await uploadInspectionPhoto(photo.file, selectedMissionId, photo.waypointId, report.code);
            updatePhoto(photo.id, { analysis: registered });
          }
          if (registered.status === "ANALYSIS_FAILED") throw new Error(registered.findings || "El análisis falló. Revisá esta evidencia; podés descartar esta carga y crear una nueva.");
          const analysis = await waitForAnalysis(registered);
          updatePhoto(photo.id, { analysis, isAnalyzing: false });
        } catch (error) {
          updatePhoto(photo.id, { error: error instanceof Error ? error.message : "No se pudo analizar esta imagen.", isAnalyzing: false });
        }
      }
      for (const report of reportsByAsset.values()) {
        try { rememberReport(await getReport(report.code)); }
        catch { setSelectionError("Los resultados se guardaron, pero no se pudo actualizar el resumen. Consultá el historial."); }
      }
    } finally { setIsAnalyzingAll(false); }
  };

  const saveDecision = async (approved: boolean) => {
    if (!activeReports.length || !signature.trim()) {
      setValidationError("Primero generá los reportes e ingresá la firma."); return;
    }
    if (approved && (!photos.length || photos.some(photo => photo.analysis?.status !== "ANALYZED"))) {
      setValidationError("Todas las imágenes deben analizarse correctamente antes de validar."); return;
    }
    setIsSavingDecision(true); setValidationError("");
    try {
      for (const report of activeReports) {
        if (report.status === (approved ? "VALIDATED" : "REJECTED")) continue;
        rememberReport(await saveValidation(report.code, signature, validatorComments, approved));
      }
      setReportState(approved ? "validated" : "discarded");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "No se pudo guardar la decisión. Podés reintentar; los cambios ya guardados se conservan.");
    } finally { setIsSavingDecision(false); }
  };

  const status = getReportStatus(reportState);

  return (
    <section className="real-report-page">
      <header className="real-report-topbar">
        <div>
          <button className="real-report-back" onClick={onBack} type="button">&larr; Volver a reportes</button>
          <h1>Módulo de IA</h1>
          <p>Carga manual temporal · Asigná las fotos a los activos del recorrido y analizá la inspección.</p>
        </div>
        <AppTopActions />
      </header>

      {generatedReports.length > 0 && <section className="real-report-card manual-generated-reports">
        <h2>Resultados de la inspección · {generatedReports.length} activos</h2>
        <p>La firma y los comentarios se aplicarán a todos los reportes de esta carga.</p>
        {generatedReports.map(report => <div key={report.code}><strong>{report.assetName}</strong><span>{report.code} · {getBackendSeverityLabel(report.severity)} · {report.status === "VALIDATED" ? "Validado" : report.status === "REJECTED" ? "Descartado" : "Pendiente"}</span><button type="button" onClick={() => void downloadReportPdf(report.code)}>Descargar PDF del activo</button></div>)}
        <button type="button" onClick={() => void downloadInspectionPdf(selectedMissionId, generatedReports.map(report => report.idAsset)).catch(error => setSelectionError(error instanceof Error ? error.message : "No se pudo descargar el PDF"))}>Descargar inspección completa</button>
      </section>}

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
              <h2>Hallazgos y evidencias</h2>
              <p>Cargá hasta 50 fotografías y asigná a cada una su activo del recorrido.</p>
            </div>
          </div>

          {missionsError && <p className="real-report-error" role="alert">{missionsError}</p>}

          {!!missions.length && (
            <div className="real-report-selectors">
              <label>Inspección / misión
                <select disabled={isLoadingMissions || busy || activeReports.length > 0} onChange={event => handleMissionChange(event.target.value)} value={selectedMissionId}>
                  {missions.map(item => <option key={item.idMission} value={item.idMission}>{item.name}</option>)}
                </select>
              </label>
              <p>{assetOptions.length} activos en el recorrido. {assetOptions.length === 1 ? "Las fotos se asignan automáticamente." : "Elegí el activo de cada foto o asigná varias juntas."}</p>
            </div>
          )}
          {photos.length > 0 && <div className="manual-photo-assignment">
            <label><input type="checkbox" disabled={assignmentLocked || isClosed} checked={photos.filter(photo => !photo.analysis).length > 0 && photos.filter(photo => !photo.analysis).every(photo => selectedPhotos.has(photo.id))}
              onChange={event => setSelectedPhotos(event.target.checked ? new Set(photos.filter(photo => !photo.analysis).map(photo => photo.id)) : new Set())}/> Seleccionar fotos sin enviar</label>
            <label>Asignar a las seleccionadas
              <select value={selectedWaypointId} disabled={assignmentLocked || isClosed} onChange={event => setSelectedWaypointId(event.target.value)}>
                <option value="">Elegir activo</option>{assetOptions.map(option => <option key={option.idAsset} value={option.waypointId}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={!selectedPhotos.size || !selectedWaypointId || assignmentLocked || isClosed} onClick={assignSelectedPhotos}>Asignar a {selectedPhotos.size} fotos</button>
            <span>{photos.filter(photo => !photo.waypointId).length} fotos sin activo</span>
          </div>}

          {photos.length < MAX_IMAGES && !isClosed && !assignmentLocked && (
            <div className="real-report-upload">
              <ImagePlus size={28} />
              <strong>Seleccione hasta {MAX_IMAGES - photos.length} {MAX_IMAGES - photos.length === 1 ? "imagen" : "imágenes"}</strong>
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Seleccionar archivos de imagen"
                className="real-report-file-input"
                multiple
                disabled={isLoadingMissions || !mission || busy}
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />
              <span>JPG, PNG o WebP · Máximo 20 MB por imagen</span>
            </div>
          )}

          {selectionError && <p className="real-report-error" role="alert">{selectionError}</p>}

          {!!photos.length && (
            <div className="real-report-photo-list">
              {photos.map((photo, index) => (
                <PhotoResultCard
                  canRemove={!assignmentLocked && !isClosed && !photo.analysis}
                  assignment={<div className="manual-photo-assignment">
                    <label><input type="checkbox" aria-label={`Seleccionar foto ${index + 1}`} checked={selectedPhotos.has(photo.id)} disabled={assignmentLocked || isClosed || !!photo.analysis}
                      onChange={event => setSelectedPhotos(current => { const next = new Set(current); if (event.target.checked) next.add(photo.id); else next.delete(photo.id); return next; })}/> Seleccionar</label>
                    <label>Activo de la foto {index + 1}
                      <select value={photo.waypointId} disabled={assignmentLocked || isClosed || !!photo.analysis} onChange={event => updatePhoto(photo.id, { waypointId: event.target.value })}>
                        <option value="">Elegir activo del recorrido</option>{assetOptions.map(option => <option key={option.idAsset} value={option.waypointId}>{option.label}</option>)}
                      </select>
                    </label>
                    {photo.analysis && <small>Foto enviada · {photo.analysis.reportCode}</small>}
                  </div>}
                  index={index}
                  key={photo.id}
                  onRemove={() => removePhoto(photo.id)}
                  photo={photo}
                />
              ))}
            </div>
          )}

          {photos.some((photo) => photo.analysis) && (
            <p className="real-report-warning"><AlertTriangle size={18} /> Los resultados son preliminares y siempre requieren revisión humana.</p>
          )}

          {photos.length > 0 && !assignmentsComplete && <p className="real-report-warning">Asigná un activo a todas las fotos para habilitar el análisis.</p>}
          {<button
            className="real-report-analyze"
            disabled={!photos.length || isLoadingMissions || !selectedMissionId || !assignmentsComplete || assignmentLocked || isClosed || photos.every(photo => photo.analysis?.status === "ANALYZED")}
            onClick={analyzeAllPhotos}
            type="button"
          >
            {isAnalyzingAll ? <LoaderCircle className="real-report-spinner" size={18} /> : <ImagePlus size={18} />}
            {isAnalyzingAll ? "Analizando imágenes..." : photos.length ? `Analizar ${photos.length} ${photos.length === 1 ? "imagen" : "imágenes"}` : "Analizar imágenes"}
          </button>}
        </article>

        <article className="real-report-card real-report-validation">
          <div className="real-report-card-title">
            <PenLine size={22} />
            <div>
              <h2>Firma y validación</h2>
              <p>Revise todos los resultados antes de decidir.</p>
            </div>
          </div>

          <label>
            <span>Comentarios del validador</span>
            <textarea
              disabled={isClosed || busy}
              onChange={(event) => setValidatorComments(event.target.value)}
              placeholder="Agregue observaciones o correcciones..."
              rows={5}
              value={validatorComments}
            />
          </label>

          <label>
            <span>Firma digital</span>
            <input
              disabled={isClosed || busy}
              onChange={(event) => setSignature(event.target.value)}
              placeholder="Nombre y apellido"
              type="text"
              value={signature}
            />
          </label>

          {validationError && <p className="real-report-error" role="alert">{validationError}</p>}

          <div className="real-report-decision-actions">
            <button className="real-report-discard" disabled={isClosed || busy} onClick={() => void saveDecision(false)} type="button">
              <Ban size={18} />
              {reportState === "discarded" ? "Reporte descartado" : "Descartar"}
            </button>
            <button className="real-report-validate" disabled={isClosed || busy} onClick={() => void saveDecision(true)} type="button">
              <CheckCircle2 size={18} />
              {reportState === "validated" ? "Reporte validado" : "Validar"}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

async function waitForAnalysis(initial: BackendInspectionPhoto) {
  let current = initial;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (current.status === "ANALYZED") return current;
    if (current.status === "ANALYSIS_FAILED") {
      throw new Error(current.findings || "El worker no pudo analizar la imagen.");
    }
    await delay(POLL_INTERVAL_MS);
    current = await getInspectionPhoto(current.idInspectionPhoto);
  }
  throw new Error("El análisis demoró demasiado. Intente nuevamente.");
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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

