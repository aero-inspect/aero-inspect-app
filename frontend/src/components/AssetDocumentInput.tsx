import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Trash2, ExternalLink, Download } from "lucide-react";
import type { AssetDocument } from "../api/types";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
  csv: "text/csv", txt: "text/plain"
};
const ACCEPT = Object.keys(MIME_TYPES).map(extension => `.${extension}`).join(",");

function DocumentRow({ document, disabled, onRemove }: { document: AssetDocument; disabled?: boolean; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>();
  const type = MIME_TYPES[document.name.split(".").pop()!.toLowerCase()];
  const preview = type === "application/pdf" || type?.startsWith("image/");
  useEffect(() => {
    const bytes = Uint8Array.from(atob(document.data.split(",")[1]), char => char.charCodeAt(0));
    const next = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [document.data, type]);
  return <div className={onRemove ? "asset-document-control" : "asset-document-detail-row"}>
    <FileText size={18} className="asset-document-file-icon" aria-hidden="true" />
    <a className="asset-document-link" title={document.name} href={url} target={preview ? "_blank" : undefined} rel="noopener noreferrer" download={preview ? undefined : document.name}><span>{document.name}</span>{preview ? <ExternalLink size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}</a>
    {onRemove && <button className="asset-document-icon-button asset-document-remove" type="button" aria-label={`Quitar ${document.name}`} title="Quitar archivo" disabled={disabled} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>}
  </div>;
}

export function AssetDocumentInput({ documents = [], disabled, onChange, onReadingChange }: {
  documents: AssetDocument[]; disabled: boolean; onChange: (documents: AssetDocument[]) => void;
  onReadingChange: (reading: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onReadingChange(false); }; }, [onReadingChange]);
  return <div className="asset-document-field">
    <span className="asset-document-label">Documentación adicional <span className="asset-document-optional">({documents.length}/3)</span></span>
    <input ref={input} hidden multiple type="file" accept={ACCEPT} aria-label="Seleccionar documentación adicional" disabled={disabled || reading} onChange={async event => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!files.length) return;
      setError(null);
      if (documents.length + files.length > 3) { setError("Puede adjuntar hasta 3 archivos por activo."); return; }
      if (files.some(file => !MIME_TYPES[file.name.split(".").pop()!.toLowerCase()] || file.size === 0 || file.size > 5 * 1024 * 1024 || file.name.length > 255)) {
        setError("Seleccione PDF, imágenes, Excel, Word, CSV o TXT de hasta 5 MB por archivo."); return;
      }
      setReading(true); onReadingChange(true);
      try {
        const added = await Promise.all(files.map(async file => {
          const type = MIME_TYPES[file.name.split(".").pop()!.toLowerCase()];
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(new Blob([file], { type }));
          });
          return { name: file.name, data };
        }));
        if (mounted.current) onChange([...documents, ...added]);
      } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "No se pudo leer el archivo."); }
      finally { if (mounted.current) { setReading(false); onReadingChange(false); } }
    }} />
    <div className="asset-document-list">
      {documents.map((document, index) => <DocumentRow key={`${index}-${document.name}`} document={document} disabled={disabled || reading} onRemove={() => { onChange(documents.filter((_, position) => position !== index)); setError(null); }} />)}
      {documents.length < 3 && <div className="asset-document-control"><button type="button" className="asset-document-upload" aria-label="Adjuntar documentación adicional" disabled={disabled || reading} onClick={() => input.current?.click()}><Upload size={20} aria-hidden="true" /><span>{reading ? "Leyendo archivos…" : documents.length ? "Adjuntar otro archivo" : "Adjuntar archivos"}</span></button></div>}
    </div>
    <small className="asset-document-hint">PDF, imágenes, Excel, Word, CSV o TXT · 5 MB por archivo</small>
    {error && <p className="asset-document-error" role="alert">{error}</p>}
  </div>;
}

export function AssetDocumentLink({ documents = [] }: { documents: AssetDocument[] }) {
  return <div className="asset-document-detail"><span className="asset-document-label">Documentación adicional</span>
    {documents.length ? <div className="asset-document-list">{documents.map((document, index) => <DocumentRow key={`${index}-${document.name}`} document={document} />)}</div> : <span className="asset-document-empty">Sin documentación adjunta</span>}
  </div>;
}
