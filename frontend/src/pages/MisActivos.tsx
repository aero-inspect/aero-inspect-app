import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft, Plus, Search, MapPin, Upload, X, Pencil, Trash2 } from "lucide-react";
import type { Asset, Plant } from "../types";
import type { BackendAsset, BackendAssetStatus, BackendAssetType, BackendReport, CreateAssetPayload } from "../api/types";
import { createAsset, deleteAsset, getAssets, updateAsset, getReports } from "../api/client";
import { AssetsOverviewMap } from "../components/AssetsOverviewMap";
import { assetTypesForPlant, ASSET_TYPE_OPTIONS } from "../data/assetTypes";
import { AssetDocumentInput, AssetDocumentLink } from "../components/AssetDocumentInput";

const STATUSES: Record<BackendAssetStatus,string> = { ACTIVE:"Activo", MAINTENANCE:"En mantenimiento", OUT_OF_SERVICE:"Fuera de servicio", UNCONFIRMED:"Sin confirmar" };
const REPORT_STATUS: Record<BackendReport["status"],string> = {PROCESSING:"Procesando",PENDING_VALIDATION:"Pendiente de validación",VALIDATED:"Validada",REJECTED:"Descartada"};
const typeName=(type:BackendAssetType)=>ASSET_TYPE_OPTIONS.find(t=>t.value===type)?.label ?? type;
const dateLabel=(date:string|null)=>date ? new Date(date).toLocaleDateString("es-AR") : "Sin registrar";
const coordinates=(asset:{latitude:number;longitude:number})=>`${asset.latitude.toFixed(6)}, ${asset.longitude.toFixed(6)}`;
const documents=(asset:BackendAsset)=>asset.documents ?? (asset.documentName && asset.documentData ? [{name:asset.documentName,data:asset.documentData}] : []);

export function MisActivosView({initialCreate=false, selectedAssetId, plant, onDeleteAsset, onViewAssetHistory}: {
  initialCreate?:boolean; selectedAssetId?:number|null; plant:Plant; assets:Asset[];
  onBack:()=>void; onDeleteAsset:(id:number)=>void; onRegisterAsset:()=>void; onUpdateAsset:(asset:Asset)=>void;
  onViewAssetHistory?:(id:number)=>void;
}) {
  const [assets,setAssets]=useState<BackendAsset[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [search,setSearch]=useState(""),[type,setType]=useState("Todos"),[status,setStatus]=useState("Todos");
  const [selectedId,setSelectedId]=useState<number|null>(selectedAssetId??null);
  const [mode,setMode]=useState<"list"|"create"|"detail"|"edit">(initialCreate?"create":selectedAssetId?"detail":"list");
  const [notice,setNotice]=useState("");
  const [deleting,setDeleting]=useState<BackendAsset|null>(null),[busyDelete,setBusyDelete]=useState(false),[deleteError,setDeleteError]=useState("");
  const [history,setHistory]=useState<BackendReport[]>([]),[historyLoading,setHistoryLoading]=useState(false),[historyError,setHistoryError]=useState("");
  const selected=assets.find(a=>a.idAsset===selectedId);
  const load=()=>{setLoading(true);setError("");getAssets(plant).then(setAssets).catch(e=>setError(e.message)).finally(()=>setLoading(false));};
  useEffect(()=>{let active=true;setLoading(true);setError("");getAssets(plant).then(items=>{if(active)setAssets(items);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[plant]);
  useEffect(()=>{if(selectedAssetId){setSelectedId(selectedAssetId);setMode("detail");}},[selectedAssetId]);
  useEffect(()=>{if(initialCreate)setMode("create");},[initialCreate]);
  useEffect(()=>{
    if(mode!=="detail" || !selectedId)return;
    let active=true;setHistoryLoading(true);setHistoryError("");setHistory([]);
    getReports(plant).then(items=>{if(active)setHistory(items.filter(r=>r.idAsset===selectedId).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)));})
      .catch(e=>{if(active)setHistoryError(e.message);}).finally(()=>{if(active)setHistoryLoading(false);});
    return()=>{active=false;};
  },[selectedId,mode,plant]);
  const visible=useMemo(()=>assets.filter(a=>(type==="Todos"||typeName(a.type)===type)&&(status==="Todos"||STATUSES[a.status]===status)&&`${a.name} ${a.code} ${typeName(a.type)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[assets,type,status,search]);
  useEffect(()=>{if(selectedId && mode==="list" && !visible.some(a=>a.idAsset===selectedId))setSelectedId(null);},[visible,selectedId,mode]);
  const save=(asset:BackendAsset)=>{
    const created=mode==="create";
    setAssets(current=>created?[...current,asset]:current.map(a=>a.idAsset===asset.idAsset?asset:a));
    setSelectedId(asset.idAsset);setSearch("");setType("Todos");setStatus("Todos");setMode(created?"list":"detail");
    setNotice(created?`${asset.name} se creó y quedó ubicado en el mapa.`:"Cambios guardados.");
  };
  const remove=async()=>{if(!deleting)return;setBusyDelete(true);setDeleteError("");try{
    await deleteAsset(deleting.idAsset);onDeleteAsset(deleting.idAsset);setAssets(items=>items.filter(a=>a.idAsset!==deleting.idAsset));setDeleting(null);setSelectedId(null);setMode("list");setNotice("Activo eliminado.");
  }catch(e){setDeleteError(e instanceof Error?e.message:"No se pudo eliminar el activo.");}finally{setBusyDelete(false);}};
  const askDelete=(asset:BackendAsset)=>{setDeleting(asset);setDeleteError("");};
  const openDetail=(asset:BackendAsset)=>{setSelectedId(asset.idAsset);setMode("detail");};
  const rowActions=(asset:BackendAsset)=><div className="asset-row-actions" onClick={e=>e.stopPropagation()}>
    <button className="asset-icon-button" type="button" aria-label={`Editar ${asset.name}`} title="Editar" onClick={()=>{setSelectedId(asset.idAsset);setMode("edit");}}><Pencil size={17}/></button>
    <button className="asset-icon-button asset-delete-button" type="button" aria-label={`Eliminar ${asset.name}`} title="Eliminar" onClick={()=>askDelete(asset)}><Trash2 size={17}/></button>
  </div>;

  return <section className={`asset-workspace mode-${mode}`}>
    {mode==="create" || mode==="edit" && selected ? <AssetEditor key={mode+String(selectedId)} plant={plant} asset={mode==="edit"?selected:undefined} assets={assets} onCancel={()=>setMode(mode==="edit"?"detail":"list")} onSaved={save}/> : <>
      {mode==="detail"&&<header className="asset-workspace-heading">
        <div>{mode==="detail"&&<button className="asset-back" type="button" onClick={()=>setMode("list")}><ArrowLeft size={16}/>Todos los activos</button>}<h1 data-page-title="true">{mode==="detail"?(selected?.name??"Activo"):"Activos"}</h1>{mode==="detail"&&<p>{selected?.code??""} · {selected?typeName(selected.type):""}</p>}</div>
        {selected&&<div className="asset-heading-actions"><button className="asset-icon-button asset-heading-icon" type="button" aria-label="Editar activo" title="Editar" onClick={()=>setMode("edit")}><Pencil size={18}/></button><button className="asset-icon-button asset-heading-icon asset-delete-button" type="button" aria-label="Eliminar activo" title="Eliminar" onClick={()=>askDelete(selected)}><Trash2 size={18}/></button></div>}
      </header>}
      {notice&&<div className="asset-notice" role="status"><span>{notice}</span>{mode==="list"&&selected&&<button type="button" onClick={()=>openDetail(selected)}>Ver activo</button>}<button type="button" aria-label="Cerrar aviso" onClick={()=>setNotice("")}><X size={16}/></button></div>}
      {error&&<div className="asset-feedback" role="alert">{error} <button type="button" onClick={load}>Reintentar</button></div>}
      {mode==="detail"? selected?<>
        <div className="asset-detail-layout-v2">
          <section className="asset-detail-summary">
            <span className={`asset-status status-${selected.status}`}>{STATUSES[selected.status]}</span>
            {selected.imageData?<img className="asset-reference-photo" src={selected.imageData} alt={selected.name}/>:<div className="asset-no-photo">Sin fotografía de referencia</div>}
            <dl><div><dt>Ubicación</dt><dd>{selected.locationDetail||plant.name}</dd></div><div><dt>Descripción</dt><dd>{selected.description||"Sin descripción"}</dd></div><div><dt>Último mantenimiento</dt><dd>{dateLabel(selected.lastMaintenanceAt)}</dd></div><div><dt>Creado el</dt><dd>{dateLabel(selected.createdAt)}</dd></div></dl>
            <details className="asset-additional"><summary>Coordenadas y documentación</summary><p className="asset-mono">{coordinates(selected)}</p><AssetDocumentLink documents={documents(selected)}/></details>
          </section>
          <div className="asset-detail-map-v2"><AssetsOverviewMap assets={assets} focusedAssetCode={selected.code} plant={plant}/></div>
        </div>
        <section className="asset-history"><header><div><h2>Historial de inspecciones</h2><p>Resultados registrados para este activo.</p></div>{onViewAssetHistory&&<button className="asset-secondary" type="button" onClick={()=>onViewAssetHistory(selected.idAsset)}>Ver capturas y reportes →</button>}</header>
          {historyLoading?<p role="status">Cargando historial…</p>:historyError?<p role="alert">{historyError}</p>:history.length?<div className="asset-history-list">{history.map(r=><article key={r.idReport}><div><strong>{r.title||r.missionName}</strong><small>{dateLabel(r.createdAt)} · {r.photos.length} evidencias</small></div><span>{REPORT_STATUS[r.status]}</span><span>{r.findingsCount} hallazgos</span></article>)}</div>:<p className="asset-muted">Este activo todavía no tiene inspecciones registradas.</p>}
        </section>
      </>:<p role="status">{loading?"Cargando activo…":"No se encontró el activo en esta planta."}</p>:<>
        <div className="asset-toolbar"><label className="asset-search"><Search size={18}/><input aria-label="Buscar activos" placeholder="Buscar por nombre o código" value={search} onChange={e=>setSearch(e.target.value)}/></label><label><span className="sr-only">Tipo de activo</span><select aria-label="Tipo de activo" value={type} onChange={e=>setType(e.target.value)}><option value="Todos">Todos los tipos</option>{assetTypesForPlant(plant.id).map(t=><option key={t.value}>{t.label}</option>)}</select></label><label><span className="sr-only">Estado del activo</span><select aria-label="Estado del activo" value={status} onChange={e=>setStatus(e.target.value)}><option value="Todos">Todos los estados</option>{Object.values(STATUSES).map(s=><option key={s}>{s}</option>)}</select></label>{(search||type!=="Todos"||status!=="Todos")&&<button className="asset-text-button" type="button" onClick={()=>{setSearch("");setType("Todos");setStatus("Todos");}}>Limpiar filtros</button>}<button className="asset-primary asset-toolbar-create" type="button" onClick={()=>{setMode("create");setNotice("");}}><Plus size={17}/>Nuevo activo</button></div>
        <div className="asset-list-map-layout">
          <section className="asset-directory" aria-label="Listado de activos">
            <div className="asset-directory-head"><span>Activo</span><span>Estado</span><span className="sr-only">Acciones</span></div>
            {loading?<p role="status">Cargando activos…</p>:visible.length?visible.map(asset=><article className={`asset-directory-row${selectedId===asset.idAsset?" selected":""}`} key={asset.idAsset} tabIndex={0} aria-label={`Ubicar ${asset.name} en el mapa`} onClick={()=>setSelectedId(asset.idAsset)} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setSelectedId(asset.idAsset);}}}>
              <div><button className="asset-name-link" type="button" onClick={e=>{e.stopPropagation();openDetail(asset);}}>{asset.name}</button><small>{typeName(asset.type)}</small></div><span className={`asset-status status-${asset.status}`}>{STATUSES[asset.status]}</span>{rowActions(asset)}
            </article>):<div className="asset-directory-empty"><h2>{assets.length?"Sin coincidencias":"Todavía no hay activos"}</h2><p>{assets.length?"Probá con otro nombre o quitá los filtros.":"Creá el primero y marcá su ubicación en el mapa."}</p></div>}
            <p className="asset-directory-count">{visible.length} {visible.length===1?"activo":"activos"}{visible.length!==assets.length?` de ${assets.length}`:""}</p>
          </section>
          <section className="asset-directory-map" aria-label="Ubicación de activos"><div className="asset-map-canvas"><AssetsOverviewMap assets={assets} filters={{type,status,search}} onViewAsset={setSelectedId} focusedAssetCode={selected?.code??null} plant={plant}/></div></section>
        </div>
      </>}
    </>}
    {deleting&&<div className="asset-confirm-backdrop"><section className="asset-confirm" role="dialog" aria-modal="true" aria-labelledby="asset-delete-title"><h2 id="asset-delete-title">Eliminar {deleting.name}</h2><p>El activo se eliminará de la planta. Esta acción no se puede deshacer.</p>{deleteError&&<p role="alert">{deleteError}</p>}<div><button className="asset-secondary" type="button" disabled={busyDelete} onClick={()=>setDeleting(null)}>Cancelar</button><button className="asset-danger" type="button" disabled={busyDelete} onClick={remove}>{busyDelete?"Eliminando…":"Eliminar activo"}</button></div></section></div>}
  </section>;
}

function AssetEditor({plant,asset,assets,onCancel,onSaved}:{plant:Plant;asset?:BackendAsset;assets:BackendAsset[];onCancel:()=>void;onSaved:(asset:BackendAsset)=>void}) {
  const [form,setForm]=useState<CreateAssetPayload>(()=>asset?{name:asset.name,code:asset.code,type:asset.type,status:asset.status,locationDetail:asset.locationDetail||plant.name,latitude:asset.latitude,longitude:asset.longitude,lastMaintenanceAt:asset.lastMaintenanceAt,imageName:asset.imageName,imageData:asset.imageData,documents:documents(asset),description:asset.description}:{name:"",code:`ACT-${crypto.randomUUID().slice(0,8).toUpperCase()}`,type:assetTypesForPlant(plant.id)[0].value,status:"ACTIVE",locationDetail:plant.name,latitude:NaN,longitude:NaN,lastMaintenanceAt:null,imageName:null,imageData:null,documents:[],description:""});
  const [saving,setSaving]=useState(false),[reading,setReading]=useState(false),[error,setError]=useState(""),[dirty,setDirty]=useState(false),[confirmCancel,setConfirmCancel]=useState(false);
  const [invalid,setInvalid]=useState<string[]>([]);
  const location=Number.isFinite(form.latitude)&&Number.isFinite(form.longitude)?{latitude:String(form.latitude),longitude:String(form.longitude)}:undefined;
  const set=(patch:Partial<CreateAssetPayload>)=>{setForm(f=>({...f,...patch}));setDirty(true);setInvalid([]);setError("");};
  const cancel=()=>{if(dirty)setConfirmCancel(true);else onCancel();};
  useEffect(()=>{const leave=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",leave);return()=>window.removeEventListener("beforeunload",leave);},[dirty]);
  const save=async()=>{
    if(saving||reading)return;
    const missing=[!form.name.trim()?"name":"",!form.code.trim()?"code":"",!location||form.latitude < -90||form.latitude > 90||form.longitude < -180||form.longitude > 180?"location":"",!form.locationDetail.trim()?"sector":""].filter(Boolean);
    if(missing.length){setInvalid(missing);setError("Completá el nombre, el código, el sector y una ubicación válida en el mapa.");return;}
    setSaving(true);setError("");
    try {const payload={...form,name:form.name.trim(),code:form.code.trim(),description:form.description?.trim()||null};onSaved(asset?await updateAsset(asset.idAsset,payload):await createAsset(payload));}
    catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el activo. Tus datos se conservan.");}finally{setSaving(false);}
  };
  const image=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){setError("Usá una imagen JPG, PNG o WebP de hasta 5 MB.");return;}
    setReading(true);try{const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("No se pudo leer la imagen."));r.readAsDataURL(file);});set({imageName:file.name,imageData:data});}catch(e){setError(e instanceof Error?e.message:"No se pudo leer la imagen.");}finally{setReading(false);}
  };
  const localDate=form.lastMaintenanceAt?new Date(Date.parse(form.lastMaintenanceAt)-new Date(form.lastMaintenanceAt).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
  return <>
    <header className="asset-workspace-heading"><div><button className="asset-back" type="button" disabled={saving} onClick={cancel}><ArrowLeft size={16}/>Volver</button><h1 data-page-title="true">{asset?`Editar ${asset.name}`:"Nuevo activo"}</h1></div></header>
    <div className="asset-editor-layout">
      <form className="asset-editor-form" onSubmit={e=>{e.preventDefault();save();}}>
        <fieldset disabled={saving||reading}><legend>Datos del activo</legend>
          <label><span>Nombre *</span><input autoFocus required maxLength={100} aria-invalid={invalid.includes("name")} value={form.name} onChange={e=>set({name:e.target.value})} placeholder="Ej. Banqueta del laboratorio"/></label>
          <div className="asset-editor-pair"><label>Tipo<select value={form.type} onChange={e=>set({type:e.target.value as BackendAssetType})}>{assetTypesForPlant(plant.id).map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label>Estado<select value={form.status} onChange={e=>set({status:e.target.value as BackendAssetStatus})}>{Object.entries(STATUSES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
          <label><span>Código *</span><input required maxLength={60} aria-invalid={invalid.includes("code")} value={form.code} onChange={e=>set({code:e.target.value})}/><small>{asset?"Código interno del activo.":"Propuesto automáticamente. Podés usar tu código interno."}</small></label>
          <label>Sector o referencia<input maxLength={255} value={form.locationDetail} onChange={e=>set({locationDetail:e.target.value})}/></label>
          <div className={`asset-location-summary${invalid.includes("location")?" invalid":""}`}><MapPin size={18}/><div><strong>{location?"Ubicación seleccionada":"Falta marcar la ubicación"}</strong><small>{location?coordinates(form):"Hacé clic sobre el mapa para ubicar el activo."}</small></div></div>
          <label>Último mantenimiento <small>Opcional</small><input aria-label="Último mantenimiento" type="datetime-local" value={localDate} onChange={e=>set({lastMaintenanceAt:e.target.value?new Date(e.target.value).toISOString():null})}/><small>{form.lastMaintenanceAt?"":"Sin mantenimiento registrado"}</small></label>
          <details className="asset-additional"><summary>Foto, descripción y documentos <small>Opcional</small></summary>
            <label className="asset-image-upload">{form.imageData&&<img src={form.imageData} alt="Vista previa del activo"/>}<span><Upload size={16}/>{form.imageData?"Cambiar foto":"Agregar foto"}</span><input aria-label="Fotografía del activo" type="file" accept="image/jpeg,image/png,image/webp" onChange={image}/></label>{form.imageData&&<button className="asset-text-button" type="button" onClick={()=>set({imageData:null,imageName:null})}>Quitar foto</button>}
            <label>Descripción<textarea maxLength={500} value={form.description??""} onChange={e=>set({description:e.target.value})}/></label>
            <AssetDocumentInput documents={form.documents??[]} disabled={saving} onReadingChange={setReading} onChange={docs=>set({documents:docs})}/>
          </details>
        </fieldset>
        {error&&<p className="asset-form-feedback" role="alert">{error}</p>}
        {confirmCancel&&<div className="asset-unsaved" role="alert"><p>Tenés cambios sin guardar.</p><button type="button" onClick={()=>setConfirmCancel(false)}>Seguir editando</button><button type="button" onClick={onCancel}>Descartar cambios</button></div>}
        <footer className="asset-editor-footer"><button className="asset-secondary" type="button" disabled={saving||reading} onClick={cancel}>Cancelar</button><button className="asset-primary" type="submit" disabled={saving||reading}>{saving?"Guardando…":reading?"Leyendo archivo…":asset?"Guardar cambios":"Crear activo"}</button></footer>
      </form>
      <section className="asset-editor-map" aria-label="Ubicación del activo"><p><MapPin size={16}/>{location?"Podés elegir otro punto para cambiar la ubicación.":"Marcá en el mapa dónde está el activo."}</p><div><AssetsOverviewMap assets={assets} plant={plant} selectedLocation={location} onSelect={p=>{if(!saving&&!reading)set({latitude:Number(p.latitude),longitude:Number(p.longitude)});}}/></div></section>
    </div>
  </>;
}
