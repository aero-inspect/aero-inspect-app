import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Upload, FileText, Trash2, ExternalLink, Download } from "lucide-react";
import { downloadAssetDocument } from "../api/client";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
  csv: "text/csv", txt: "text/plain"
};
const ACCEPT = Object.keys(MIME_TYPES).map(extension => `.${extension}`).join(",");

// Un adjunto ya guardado trae id (se baja del monolito); uno recién elegido trae el File y se
// sube al guardar el activo.
export type DocumentDraft = { id?: string; name: string; file?: File };

function DocumentRow({ idAsset, document, disabled, onRemove }: { idAsset?: number; document: DocumentDraft; disabled?: boolean; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const type = MIME_TYPES[document.name.split(".").pop()!.toLowerCase()];
  const preview = type === "application/pdf" || type?.startsWith("image/");
  useEffect(() => {
    if (!document.file) return;
    const next = URL.createObjectURL(new Blob([document.file], { type: type || "application/octet-stream" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [document.file, type]);
  const download = (event: MouseEvent) => {
    if (document.file || !document.id || idAsset == null) return;
    event.preventDefault();
    setError(null);
    downloadAssetDocument(idAsset, { id: document.id, name: document.name }, preview).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : "No se pudo descargar el archivo"));
  };
  return <div className={onRemove ? "asset-document-control" : "asset-document-detail-row"}>
    <FileText size={18} className="asset-document-file-icon" aria-hidden="true" />
    <a className="asset-document-link" title={error ?? document.name} href={url ?? "#"} onClick={download} target={preview && url ? "_blank" : undefined} rel="noopener noreferrer" download={preview || !url ? undefined : document.name}><span>{document.name}</span>{preview ? <ExternalLink size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}</a>
    {onRemove && <button className="asset-document-icon-button asset-document-remove" type="button" aria-label={`Quitar ${document.name}`} title="Quitar archivo" disabled={disabled} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>}
  </div>;
}

export function AssetDocumentInput({ idAsset, documents = [], disabled, onChange }: {
  idAsset?: number; documents: DocumentDraft[]; disabled: boolean; onChange: (documents: DocumentDraft[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return <div className="asset-document-field">
    <span className="asset-document-label">Documentación adicional <span className="asset-document-optional">({documents.length}/3)</span></span>
    <input ref={input} hidden multiple type="file" accept={ACCEPT} aria-label="Seleccionar documentación adicional" disabled={disabled} onChange={event => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!files.length) return;
      setError(null);
      if (documents.length + files.length > 3) { setError("Puede adjuntar hasta 3 archivos por activo."); return; }
      if (files.some(file => !MIME_TYPES[file.name.split(".").pop()!.toLowerCase()] || file.size === 0 || file.size > 5 * 1024 * 1024 || file.name.length > 255)) {
        setError("Seleccione PDF, imágenes, Excel, Word, CSV o TXT de hasta 5 MB por archivo."); return;
      }
      onChange([...documents, ...files.map(file => ({ name: file.name, file }))]);
    }} />
    <div className="asset-document-list">
      {documents.map((document, index) => <DocumentRow key={document.id ?? `${index}-${document.name}`} idAsset={idAsset} document={document} disabled={disabled} onRemove={() => { onChange(documents.filter((_, position) => position !== index)); setError(null); }} />)}
      {documents.length < 3 && <div className="asset-document-control"><button type="button" className="asset-document-upload" aria-label="Adjuntar documentación adicional" disabled={disabled} onClick={() => input.current?.click()}><Upload size={20} aria-hidden="true" /><span>{documents.length ? "Adjuntar otro archivo" : "Adjuntar archivos"}</span></button></div>}
    </div>
    <small className="asset-document-hint">PDF, imágenes, Excel, Word, CSV o TXT · 5 MB por archivo</small>
    {error && <p className="asset-document-error" role="alert">{error}</p>}
  </div>;
}

export function AssetDocumentLink({ idAsset, documents = [] }: { idAsset: number; documents: DocumentDraft[] }) {
  return <div className="asset-document-detail"><span className="asset-document-label">Documentación adicional</span>
    {documents.length ? <div className="asset-document-list">{documents.map((document, index) => <DocumentRow key={document.id ?? `${index}-${document.name}`} idAsset={idAsset} document={document} />)}</div> : <span className="asset-document-empty">Sin documentación adjunta</span>}
  </div>;
}
