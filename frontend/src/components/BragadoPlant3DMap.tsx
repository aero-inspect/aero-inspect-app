import { createEnvironment } from "./bragado/environment";
import { createAssetSelection, type AssetSelectionData } from "./bragado/assetSelection";
import { createMissionPlayback, type MissionPlaybackData } from "./bragado/missionPlayback";
import { ENVIRONMENT_MODES, setEnvironmentMode, useEnvironmentMode, type EnvironmentMode } from "./bragado/timeOfDay";
import { addMissionDrone } from "./bragado/drone";
import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "../data/bragado-assets.json";
import { buildPlant } from "./bragado/geometry.js";
import { Maximize2, Minimize2, SlidersHorizontal, X, Focus, ArrowUp } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BackendAsset, BackendAssetStatus } from "../api/types";

type EquipmentType = "silo" | "flotante" | "celda" | "noria" | "secadora";
type DisplayStatus = "Activo" | "Inactivo" | "En mantenimiento" | "Sin confirmar";
type ViewMode = "top" | "perspective" | "street";

type Equipment = {
  id: string;
  name: string;
  short: string;
  type: EquipmentType;
  status: DisplayStatus;
  capacity?: number;
  description: string;
  position: THREE.Vector3;
  asset?: BackendAsset;
  radius: number;
  height: number;
};

type ProjectedTag = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
};


const TYPE_LABELS: Record<EquipmentType, string> = {
  silo: "Silo",
  flotante: "Silo flotante",
  celda: "Celda",
  noria: "Noria",
  secadora: "Secadora"
};

const STATUS_FROM_BACKEND: Record<BackendAssetStatus, DisplayStatus> = {
  ACTIVE: "Activo",
  MAINTENANCE: "En mantenimiento",
  OUT_OF_SERVICE: "Inactivo",
  UNCONFIRMED: "Sin confirmar"
};

const SIZES = {
  cell: { capacity: 10000 },
  silos: { 1: 450, 2: 450, 3: 450, 4: 450, 5: 900, 6: 900, 7: 900, 8: 900, 9: 1760, 10: 2750, 11: 2750 } as Record<number, number>
};

const siloNumbers: Record<string, number> = { G1: 10, G2: 11, G3: 9, M1: 5, M3: 6, M2: 3, M4: 4, M5: 2, M6: 1, M7: 8, M8: 7 };

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function statusFor(id: string, name: string, assets: BackendAsset[]): { status: DisplayStatus; asset?: BackendAsset } {
  const lookup = [id, name].map(normalize);
  const asset = assets.find((candidate) => {
    const fields = [candidate.name, candidate.code, candidate.locationDetail ?? ""].map(normalize);
    return fields.some((field) => lookup.some((key) => key && field === key));
  });
  if (asset) return { status: STATUS_FROM_BACKEND[asset.status], asset };
  if (id === "silo-10" || id === "silo-11") return { status: "Inactivo" };
  if (id === "secadora-1") return { status: "Activo" };
  return { status: "Sin confirmar" };
}

function buildEquipment(assets: BackendAsset[], heightScale: number): Equipment[] {
  const types: Record<string, EquipmentType> = { SILO: "silo", SILO_FLOTANTE: "flotante", CELDA: "celda", NORIA: "noria", SECADORA: "secadora" };
  return catalog.map(record => {
    const matched = assets.find(asset => asset.code === record.code);
    const linked = matched ? {asset: matched, status: STATUS_FROM_BACKEND[matched.status]} : statusFor(record.id, record.name, assets);
    const height = record.h * (["SILO", "SILO_FLOTANTE", "NORIA"].includes(record.type) ? heightScale : 1);
    return {id:record.id, name:record.name, short:record.name, type:types[record.type], ...linked,
      capacity: record.type === "SILO" ? SIZES.silos[Number(record.id.slice(5))] : record.type === "CELDA" ? 10000 : undefined,
      description: linked.asset?.locationDetail ?? "Planta Bragado",
      position:new THREE.Vector3(record.x,height * .6,record.z),radius:record.r,height};
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite)) return;
    if (child instanceof THREE.Mesh) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    });
  });
}

function createScene(root: HTMLDivElement, heightScale: number, onProject: (projected: ProjectedTag[]) => void, onCamera: (value: {bearing:number;zoom:number}) => void, playbackMode=false, selectionMode=false) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.append(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 1600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 1000;
  let motion: {start:number;from:THREE.Vector3;to:THREE.Vector3;target:THREE.Vector3;fromTarget:THREE.Vector3} | null = null;
  controls.addEventListener("start", () => { motion = null; });
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  let street = false;
  let currentView: ViewMode = "top";
  let pointer: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener("pointerdown", event => {
    if (!street) return;
    pointer = { x: event.clientX, y: event.clientY };
    camera.rotation.order = "YXZ";
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", event => {
    if (!pointer) return;
    camera.rotation.y -= (event.clientX - pointer.x) * 0.004;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - (event.clientY - pointer.y) * 0.004, -1.3, 1.3);
    pointer = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener("pointerup", () => { pointer = null; });
  renderer.domElement.addEventListener("pointercancel", () => { pointer = null; });

  const visualTubes = [10, 11, 9, 5, 3, 6, 4, 2, 1, 8, 7, "F1", "F2", "F3"].map((to, index) => ({ id: `tube-${index}`, from: "", to: String(to), noria: index < 7 ? 1 : 2 }));
  const collisionBounds = buildPlant(scene, heightScale, siloNumbers, visualTubes);
  const dock = addMissionDrone(scene);
  const facilityBounds = new THREE.Box3();
  collisionBounds.forEach(bounds => facilityBounds.union(bounds));
  facilityBounds.union(new THREE.Box3().setFromObject(dock));
  const environment = createEnvironment(scene, renderer, heightScale);
  const playback = playbackMode ? createMissionPlayback(scene,dock,camera,controls) : null;
  const picker = selectionMode ? createAssetSelection(scene,camera,renderer.domElement) : null;
  const highlightGroup = new THREE.Group();
  scene.add(highlightGroup);
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: "#3fbd68", transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const highlightEdgeMaterial = new THREE.LineBasicMaterial({ color: "#168244", transparent: true, opacity: 0.95 });
  const clearHighlight = () => {
    for (const child of [...highlightGroup.children]) {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) child.geometry.dispose();
      highlightGroup.remove(child);
    }
  };
  const highlight = (id: string | null) => {
    clearHighlight();
    if (!id) return;
    const record = catalog.find((item) => item.id === id);
    if (!record) return;
    const height = record.h * (["SILO", "SILO_FLOTANTE", "NORIA"].includes(record.type) ? heightScale : 1);
    if (record.r > 0) {
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(record.r * 1.025, record.r * 1.025, height * 0.98, 64), highlightMaterial);
      glow.position.set(record.x, height * 0.49, record.z);
      highlightGroup.add(glow);
      const ring = new THREE.Mesh(new THREE.RingGeometry(record.r * 1.02, record.r * 1.12, 64), highlightMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(record.x, 0.12, record.z);
      highlightGroup.add(ring);
      const topRing = ring.clone();
      topRing.position.y = height * 0.98;
      highlightGroup.add(topRing);
      if(selectionMode){
        const roof=new THREE.Mesh(new THREE.ConeGeometry(record.r*1.025,record.r*.3,64),highlightMaterial);
        roof.position.set(record.x,height+record.r*.15+.04,record.z);
        highlightGroup.add(roof);
      }
      return;
    }
    const size = record.type === "CELDA" ? [27, 14, 43] : record.type === "SECADORA" ? [4.8, 11.2, 4.4] : [5.5, 25, 5.5];
    const glow = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), highlightMaterial);
    glow.position.set(record.x, size[1] / 2, record.z);
    if (record.type === "CELDA") glow.rotation.y = Math.PI / 4;
    highlightGroup.add(glow);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(glow.geometry), highlightEdgeMaterial);
    outline.position.copy(glow.position);
    outline.rotation.copy(glow.rotation);
    highlightGroup.add(outline);
  };

  const resize = () => {
    const rect = root.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    const previousDistance = Math.max(175, 145 / camera.aspect);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    if (!street && camera.position.lengthSq() > 0) {
      const ratio = Math.max(175, 145 / camera.aspect) / previousDistance;
      camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
    }
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const setView = (view: ViewMode) => {
    if (motion) return;
    currentView = view;
    street = view === "street";
    controls.enabled = view !== "street";
    if (view === "street") {
      camera.fov = 68;
      camera.position.set(-51, 1.7, 0);
      controls.target.set(-16, 12, -9);
      camera.lookAt(controls.target);
    } else {
      camera.fov = 55;
      const distance = Math.max(175, 145 / camera.aspect);
      controls.target.set(-16, 0, -32);
      camera.position.set(-16, view === "top" ? distance : distance * 0.8, view === "top" ? -31.99 : -32 + distance * 0.65);
    }
    camera.updateProjectionMatrix();
    controls.update();
  };
  setView("top");
  const centerPlant = () => {
    const sphere = facilityBounds.getBoundingSphere(new THREE.Sphere());
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = sphere.radius / Math.sin(Math.min(vertical, horizontal)) * 1.08;
    controls.maxDistance = Math.max(1000, distance * 1.2);
    const direction = street ? new THREE.Vector3(0, 1, .8).normalize() : camera.position.clone().sub(controls.target).normalize();
    motion = {start:performance.now(),from:camera.position.clone(),to:sphere.center.clone().addScaledVector(direction,distance),target:sphere.center.clone(),fromTarget:controls.target.clone()};
    street = false; controls.enabled = true;
  };

  let frameId = 0;
  let lastCameraUpdate = 0;
  const animate = () => {
    const now = performance.now();
    if(motion){const t=Math.min(1,(now-motion.start)/1200),s=t*t*(3-2*t);camera.position.lerpVectors(motion.from,motion.to,s);controls.target.lerpVectors(motion.fromTarget,motion.target,s);if(t===1)motion=null;}
    environment.update();
    playback?.animate();
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
    if(now-lastCameraUpdate>100){const north=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion.clone().invert());onCamera({bearing:Math.atan2(north.x,north.y)*180/Math.PI,zoom:Math.round(100*(1-THREE.MathUtils.clamp((camera.position.distanceTo(controls.target)-controls.minDistance)/(controls.maxDistance-controls.minDistance),0,1)))});lastCameraUpdate=now;}
    frameId = requestAnimationFrame(animate);
  };
  animate();

  return {
    updateSelection: (data:AssetSelectionData) => picker?.update(data),
    updatePlayback: (data:MissionPlaybackData) => playback?.update(data),
    followDrone: (value:boolean) => {if(value&&street)setView('perspective');playback?.setFollowing(value);},
    centerPlant,
    setView,
    highlight,
    project(items: Equipment[]) {
      const rect = root.getBoundingClientRect();
      const placed: Array<{ x: number; y: number }> = [];
      onProject(items.map((item) => {
        const anchor = item.position.clone();
        if (currentView === "top") {
          anchor.y = item.height + item.radius * .3;
        } else if (item.radius > 0) {
          // Attach the label to the camera-facing wall, not above the roof.
          const facing = new THREE.Vector3(camera.position.x - anchor.x, 0, camera.position.z - anchor.z).normalize();
          anchor.addScaledVector(facing, item.radius + .08);
        }
        const ray = anchor.clone().sub(camera.position);
        const horizontal = ray.x * ray.x + ray.z * ray.z;
        const occluded = currentView !== "top" && horizontal > 0 && catalog.some(other => {
          if (other.id === item.id || !other.r) return false;
          const ox = camera.position.x - other.x, oz = camera.position.z - other.z;
          const linear = 2 * (ox * ray.x + oz * ray.z);
          const discriminant = linear * linear - 4 * horizontal * (ox * ox + oz * oz - other.r * other.r);
          if (discriminant < 0) return false;
          const entry = Math.max(0, (-linear - Math.sqrt(discriminant)) / (2 * horizontal));
          const exit = Math.min(.99, (-linear + Math.sqrt(discriminant)) / (2 * horizontal));
          if (exit < entry) return false;
          const y1 = camera.position.y + ray.y * entry, y2 = camera.position.y + ray.y * exit;
          return Math.max(y1, y2) > 0 && Math.min(y1, y2) < other.h * heightScale;
        });
        const point = anchor.project(camera);
        const x = (point.x + 1) * rect.width / 2;
        const y = (1 - point.y) * rect.height / 2;
        const visible = !occluded && point.z >= -1 && point.z <= 1 && x > 38 && x < rect.width - 38 && y > 70 && y < rect.height - 14 &&
          !placed.some(tag => Math.abs(tag.x - x) < 76 && Math.abs(tag.y - y) < 26);
        if (visible) placed.push({ x, y });
        return {
          id: item.id,
          x, y, visible
        };
      }));
    },
    destroy() {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      playback?.destroy();
      picker?.destroy();
      environment.destroy();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };


}

export type MapFilters = { type: string; status: string; search?: string };
export function BragadoPlant3DMap({ assets, onViewAsset, filters, focusedAssetCode, playback, assetSelection }: { assets: BackendAsset[]; onViewAsset?: (idAsset: number) => void; filters?: MapFilters; focusedAssetCode?: string | null; playback?:MissionPlaybackData; assetSelection?:AssetSelectionData }) {
  const playbackMode=Boolean(playback);
  const selectionMode=Boolean(assetSelection);
  const [following,setFollowing]=useState(false);
  const [cameraInfo,setCameraInfo]=useState({bearing:0,zoom:0});
  const [expanded, setExpanded] = useState(false);
  const environmentMode = useEnvironmentMode();
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const [heightScale, setHeightScale] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("top");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projected, setProjected] = useState<ProjectedTag[]>([]);
  const [types, setTypes] = useState<Set<EquipmentType>>(new Set(["silo", "flotante", "celda", "noria", "secadora"]));
  const [states, setStates] = useState<Set<DisplayStatus>>(new Set(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"]));

  const equipment = useMemo(() => buildEquipment(assets, heightScale), [assets, heightScale]);
  const visibleEquipment = useMemo(
    () => equipment.filter((item) => {
      if (!filters) return types.has(item.type) && states.has(item.status);
      const label = TYPE_LABELS[item.type];
      const status = item.status === "Inactivo" ? "Fuera de servicio" : item.status;
      return (filters.type === "Todos" || filters.type === label) &&
        (filters.status === "Todos" || filters.status === status) &&
        (!filters.search || normalize(`${item.name} ${label} ${status}`).includes(normalize(filters.search)));
    }),
    [equipment, states, types, filters]
  );
  const focusedId = focusedAssetCode ? equipment.find((item) => item.asset?.code === focusedAssetCode)?.id ?? null : null;
  const activeHighlightId = focusedId ?? selectedId;
  const selected = visibleEquipment.find((item) => item.id === activeHighlightId);
  const projectedById = new Map(projected.map((tag) => [tag.id, tag]));

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [expanded]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    sceneRef.current?.destroy();
    sceneRef.current = createScene(root, heightScale, setProjected, setCameraInfo, playbackMode, selectionMode);
    sceneRef.current.setView(viewMode);
    return () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [heightScale, playbackMode, selectionMode]);
  useEffect(()=>{if(assetSelection)sceneRef.current?.updateSelection(assetSelection);},[assetSelection,heightScale]);
  useEffect(()=>{if(playback)sceneRef.current?.updatePlayback(playback);},[playback,heightScale]);
  useEffect(()=>{setFollowing(false);},[playback?.id]);
  useEffect(()=>{sceneRef.current?.followDrone(following);},[following,playback?.id]);

  useEffect(() => {
    sceneRef.current?.setView(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = window.setInterval(() => sceneRef.current?.project(visibleEquipment), 32);
    sceneRef.current?.project(visibleEquipment);
    return () => window.clearInterval(timer);
  }, [visibleEquipment]);

  useEffect(() => {
    sceneRef.current?.highlight(activeHighlightId);
  }, [activeHighlightId, heightScale]);


  const toggleType = (type: EquipmentType) => setTypes((current) => {
    const next = new Set(current);
    next.has(type) ? next.delete(type) : next.add(type);
    return next;
  });
  const toggleState = (status: DisplayStatus) => setStates((current) => {
    const next = new Set(current);
    next.has(status) ? next.delete(status) : next.add(status);
    return next;
  });

  const resetFilters = () => {
    setTypes(new Set(["silo", "flotante", "celda", "noria", "secadora"]));
    setStates(new Set(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"]));
  };

  return (
    <div className={`bragado-map${expanded ? " bragado-map-expanded" : ""}`}>
      <div className="bragado-map-stage" ref={rootRef} />
      <div className="bragado-map-toolbar">
        <button type="button" title={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-label={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        {!playbackMode && !selectionMode && <button type="button" title={panelOpen ? "Minimizar panel" : "Equipos y controles"} aria-label={panelOpen ? "Minimizar panel" : "Equipos y controles"} aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><SlidersHorizontal size={18} /></button>}
        <select aria-label="Vista 3D" onChange={(event) => setViewMode(event.target.value as ViewMode)} value={viewMode}>
          <option value="top">Desde arriba</option>
          <option value="perspective">Perspectiva</option>
          <option value="street">Nivel suelo</option>
        </select>
        <select aria-label="Iluminación del ambiente" title="Iluminación del ambiente" value={environmentMode} onChange={event => setEnvironmentMode(event.target.value as EnvironmentMode)}>
          {Object.entries(ENVIRONMENT_MODES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="bragado-camera-tools">
        <span className="bragado-compass" title="Norte" aria-label="Norte"><span style={{transform:`rotate(${cameraInfo.bearing}deg)`}}><b>N</b><ArrowUp size={16}/></span></span>
        <button type="button" title="Centrar planta" aria-label="Centrar planta" onClick={()=>{setFollowing(false);sceneRef.current?.followDrone(false);sceneRef.current?.centerPlant();if(viewMode==='street')setViewMode('perspective');}}><Focus size={17}/></button>
        {playbackMode && <button className="bragado-follow" type="button" title="Seguir dron" aria-pressed={following} onClick={()=>setFollowing(!following)}>Seguir dron</button>}
        <span className="bragado-zoom">Zoom {cameraInfo.zoom}%</span>
      </div>
      {panelOpen && !playbackMode && !selectionMode && <aside className="bragado-map-panel">
        <header>
          <span>{visibleEquipment.length} de {equipment.length}</span>
          <strong>Mapa 3D Bragado</strong>
          <button type="button" title="Minimizar panel" aria-label="Minimizar panel" onClick={() => setPanelOpen(false)}><X size={16} /></button>
        </header>
        <label>Altura <input aria-label="Altura estimada" max="1.35" min="0.75" onChange={(event) => setHeightScale(Number(event.target.value))} step="0.01" type="range" value={heightScale} /></label>
        {!filters && <>
        <div className="bragado-map-filter-block">
          <span>Tipo</span>
          <div>
            {(Object.keys(TYPE_LABELS) as EquipmentType[]).map((type) => (
              <button className={types.has(type) ? "active" : undefined} key={type} onClick={() => toggleType(type)} type="button">
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="bragado-map-filter-block">
          <span>Estado</span>
          <div>
            {(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"] as DisplayStatus[]).map((status) => (
              <button className={states.has(status) ? "active" : undefined} key={status} onClick={() => toggleState(status)} type="button">
                {status}
              </button>
            ))}
          </div>
        </div>
        <button className="bragado-map-reset" onClick={resetFilters} type="button">Ver todo</button>
        </>}
        {selected && (
          <section className="bragado-map-detail">
            <p>{TYPE_LABELS[selected.type]} · <span className={`state ${selected.status}`}>{selected.status}</span></p>
            <h3>{selected.name}</h3>
            <span>{selected.capacity ? `${selected.capacity.toLocaleString("es-AR")} t` : selected.description}</span>
            {selected.asset && onViewAsset && (
              <button onClick={() => onViewAsset(selected.asset!.idAsset)} type="button">Ver activo</button>
            )}
          </section>
        )}
        <div className="bragado-map-list">
          {visibleEquipment.map((item) => (
            <button className={item.id === selectedId ? "selected" : undefined} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
              <strong>{item.name}</strong>
              <span>{TYPE_LABELS[item.type]} · {item.status}</span>
            </button>
          ))}
        </div>
      </aside>}
    </div>
  );
}
