import { Maximize2, Minimize2, SlidersHorizontal, X, Focus, ArrowUp } from "lucide-react";
import { MapToolbarSelect } from "./MapToolbarSelect";
import { ENVIRONMENT_MODES, getEnvironmentMode, setEnvironmentMode, useEnvironmentMode, resolveEnvironment, type EnvironmentMode } from "./bragado/timeOfDay";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildLujan, houseToWorld } from "./lujan/geometry";
import { isInsideLujan, lujanToGeographic, lujanToLocal } from "../data/plants";
import "../styles/components/lujan-map.css";
import type { BackendAsset } from "../api/types";
import type { MapFilters } from "./BragadoPlant3DMap";
import type { AssetSelectionData } from "./bragado/assetSelection";
import { createStool, disposeAssetGroup, savedLujanAssets } from "./lujan/assets";

type View = "perspective" | "top" | "patio" | "entrance" | "service";

type Location = { latitude: string; longitude: string };
export function LujanPlant3DMap({onSelect, selectedLocation, assets=[], filters, onViewAsset, focusedAssetCode, assetSelection}: {
  onSelect?: (location: Location) => void;
  selectedLocation?: Location;
  assets?: BackendAsset[];
  filters?: MapFilters;
  onViewAsset?: (id:number) => void;
  focusedAssetCode?: string | null;
  assetSelection?: AssetSelectionData;
} = {}) {
  const assetProps=useRef({assets,filters,onViewAsset,focusedAssetCode,assetSelection});
  assetProps.current={assets,filters,onViewAsset,focusedAssetCode,assetSelection};
  const updateAssets=useRef<() => void>(()=>{});
  useEffect(()=>{updateAssets.current();},[assets,filters,onViewAsset,focusedAssetCode,assetSelection]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const locationRef = useRef(selectedLocation);
  locationRef.current = selectedLocation;
  const updateMarker = useRef<() => void>(() => {});
  const [selectionError, setSelectionError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLSpanElement>(null);
  const updateEnvironment = useRef<(mode: EnvironmentMode) => void>(() => {});
  const environmentMode = useEnvironmentMode();
  const [panelOpen,setPanelOpen] = useState(false);
  const actions = useRef<(view: View) => void>(() => {});
  const [view,setView] = useState<View>("perspective");
  const [labelsVisible,setLabelsVisible] = useState(false);
  const [expanded,setExpanded] = useState(false);
  const [error,setError] = useState(false);
  useEffect(() => { updateMarker.current(); }, [selectedLocation?.latitude, selectedLocation?.longitude]);
  useEffect(() => {
    const escape = (event:KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown",escape);
    return () => window.removeEventListener("keydown",escape);
  },[]);
  useEffect(() => {
    const update = () => updateEnvironment.current(environmentMode);
    update();
    const timer = window.setInterval(update,60000);
    return () => window.clearInterval(timer);
  },[environmentMode]);
  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({antialias:true}); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label","Mapa 3D de Planta Luján: casa, pileta, patio y límites del terreno");
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#d5e1e6"); scene.fog = new THREE.Fog("#d5e1e6",130,300);
    const camera = new THREE.PerspectiveCamera(42,1,0.1,500);
    const controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping = true; controls.minDistance = 3.5; controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI/2-0.03;
    actions.current = (next: View) => {
      setView(next);
      if (next === "top") {
        controls.target.set(1,0,0);camera.position.set(1,91,.01);
      } else if (next === "patio") {
        controls.target.copy(houseToWorld(5,1,1.1));camera.position.copy(houseToWorld(-17,12,7));
      } else if (next === "service") {
        controls.target.copy(houseToWorld(3.5,16,1.6));camera.position.copy(houseToWorld(-6,28,5));
      } else if (next === "entrance") {
        controls.target.copy(houseToWorld(15,-1,1.6));camera.position.copy(houseToWorld(42,7,4.2));
      } else {
        controls.target.copy(houseToWorld(2,0,0));camera.position.copy(houseToWorld(-36,35,39));
      }
      controls.update();
    };
    actions.current(selectRef.current ? "top" : "perspective");
    const hemisphere = new THREE.HemisphereLight("#e5f0ff","#7b8068",1.65);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight("#fff3de",2.1);
    sun.position.set(-35,60,-25); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,far:180});
    sun.shadow.bias=-0.0003; sun.shadow.normalBias=.035; scene.add(sun);
    updateEnvironment.current = mode => {
      const lighting = resolveEnvironment(mode);
      hemisphere.color.copy(lighting.ambientColor);hemisphere.intensity=lighting.ambient;
      sun.color.copy(lighting.sunColor);sun.intensity=lighting.sun;
      sun.position.copy(lighting.sunPosition).multiplyScalar(.5);
      scene.background = lighting.horizon.clone();
      if(scene.fog instanceof THREE.Fog) scene.fog.color.copy(lighting.horizon);
      renderer.toneMappingExposure=lighting.exposure;
    };
    updateEnvironment.current(getEnvironmentMode());
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(350,350),new THREE.MeshStandardMaterial({color:"#99a27a",roughness:1}));
    backdrop.rotation.x=-Math.PI/2; backdrop.position.y=-0.08; backdrop.receiveShadow=true; scene.add(backdrop);
    const {root,landmarks} = buildLujan(); scene.add(root);
    root.updateMatrixWorld(true);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.38,16,12), new THREE.MeshBasicMaterial({color:"#e94832",depthTest:false,depthWrite:false,transparent:true}));
    marker.renderOrder=100;marker.visible=false;scene.add(marker);
    const pickable: THREE.Object3D[]=[];
    root.traverse(object=>{if(object instanceof THREE.Mesh) pickable.push(object);});
    const raycaster=new THREE.Raycaster();
    const assetLayer=new THREE.Group();scene.add(assetLayer);
    let assetLabels:Array<{position:THREE.Vector3;element:HTMLButtonElement;assetId:number}>=[];
    let hoveredId:number|null=null;
    let hoverPointer:THREE.Vector2|null=null;
    const hoverHighlight=new THREE.Group();scene.add(hoverHighlight);
    const hoverMaterial=new THREE.MeshBasicMaterial({color:"#3fbd68",transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
    const hoverEdgeMaterial=new THREE.LineBasicMaterial({color:"#168244",transparent:true,opacity:.95});
    const setHovered=(object:THREE.Object3D|null)=>{
      const id=object?.userData.assetId ?? null;
      if(id===hoveredId) return;
      hoveredId=id;
      for(const child of [...hoverHighlight.children]) {
        if(child instanceof THREE.Mesh || child instanceof THREE.LineSegments) child.geometry.dispose();
        hoverHighlight.remove(child);
      }
      renderer.domElement.style.cursor=id ? "pointer" : "";
      if(!object) return;
      const bounds=new THREE.Box3().setFromObject(object).expandByScalar(.015);
      const size=bounds.getSize(new THREE.Vector3());
      const geometry=new THREE.BoxGeometry(size.x,size.y,size.z);
      hoverHighlight.position.copy(bounds.getCenter(new THREE.Vector3()));
      hoverHighlight.add(new THREE.Mesh(geometry,hoverMaterial),new THREE.LineSegments(new THREE.EdgesGeometry(geometry),hoverEdgeMaterial));
    };
    let lastFocused:string|null|undefined;
    const viewAsset=(id:number)=>{
      const props=assetProps.current;
      if(props.assetSelection?.disabledIds?.includes(id) || selectRef.current) return;
      if(props.assetSelection) props.assetSelection.onSelect(id);else props.onViewAsset?.(id);
    };
    updateAssets.current=()=>{
      setHovered(null);
      disposeAssetGroup(assetLayer);assetLabels.forEach(l=>l.element.remove());assetLabels=[];
      const props=assetProps.current;
      for(const asset of savedLujanAssets(props.assets,props.filters)) {
        const [x,z]=lujanToLocal(asset.latitude,asset.longitude);
        raycaster.set(new THREE.Vector3(x,50,z),new THREE.Vector3(0,-1,0));
        const y=raycaster.intersectObjects(pickable,false)[0]?.point.y ?? 0;
        const stool=createStool();stool.position.set(x,y+.008,z);stool.userData.assetId=asset.idAsset;assetLayer.add(stool);
        const focused=asset.code===props.focusedAssetCode || props.assetSelection?.selectedIds.includes(asset.idAsset);
        if(focused) {
          const halo=new THREE.Mesh(new THREE.RingGeometry(.26,.33,32),new THREE.MeshBasicMaterial({color:"#ffcb4b",side:THREE.DoubleSide}));
          halo.rotation.x=-Math.PI/2;halo.position.set(x,y+.012,z);assetLayer.add(halo);
        }
        const element=document.createElement("button");element.type="button";element.className="lujan-asset-label";
        element.style.display="none";
        element.textContent=asset.name;element.title=`${asset.name} · Banqueta`;element.setAttribute("aria-label",`Ver ${asset.name} en el mapa`);
        element.disabled=!!selectRef.current || !!props.assetSelection?.disabledIds?.includes(asset.idAsset);
        element.onclick=()=>viewAsset(asset.idAsset);host.appendChild(element);
        assetLabels.push({position:new THREE.Vector3(x,y+.65,z),element,assetId:asset.idAsset});
        if(asset.code===props.focusedAssetCode && lastFocused!==props.focusedAssetCode) {
          controls.target.set(x,y+.2,z);camera.position.set(x+2.5,y+2.3,z+3.2);controls.update();
        }
      }
      lastFocused=props.focusedAssetCode;
    };
    updateAssets.current();
    updateMarker.current=()=>{
      const location=locationRef.current;
      const lat=Number(location?.latitude),lon=Number(location?.longitude);
      const [x,z]=lujanToLocal(lat,lon);
      marker.visible=!!location && !!location.latitude.trim() && !!location.longitude.trim() && isInsideLujan(x,z);
      if(!marker.visible) return;
      raycaster.set(new THREE.Vector3(x,50,z),new THREE.Vector3(0,-1,0));
      const hit=raycaster.intersectObjects(pickable,false)[0];
      marker.position.set(x,(hit?.point.y ?? 0)+.45,z);
    };
    updateMarker.current();
    let pointerStart: {x:number;y:number;id:number} | null=null;
    const pointerMove=(event:PointerEvent)=>{
      if(event.buttons || selectRef.current) {hoverPointer=null;setHovered(null);return;}
      const rect=renderer.domElement.getBoundingClientRect();
      hoverPointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    };
    const pointerLeave=()=>{hoverPointer=null;setHovered(null);};
    const pointerDown=(event:PointerEvent)=>{
      pointerLeave();
      if(event.button===0 && event.isPrimary) pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};
      else pointerStart=null;
    };
    const pointerCancel=()=>{pointerStart=null;};
    const pointerUp=(event:PointerEvent)=>{
      const start=pointerStart;pointerStart=null;
      if(!start || start.id!==event.pointerId || Math.hypot(event.clientX-start.x,event.clientY-start.y)>5) return;
      // DOM rect includes CSS zoom; renderer dimensions alone give wrong clicks.
      const rect=renderer.domElement.getBoundingClientRect();
      const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
      if(!selectRef.current) {
        const hit=raycaster.intersectObjects([...pickable,assetLayer],true)[0];
        let object:THREE.Object3D | undefined=hit?.object;
        while(object && !object.userData.assetId) object=object.parent ?? undefined;
        if(object?.userData.assetId) viewAsset(object.userData.assetId);
        return;
      }
      // Intersect the visible surface, not a ground plane behind the building.
      const hit=raycaster.intersectObjects(pickable,false)[0];
      if(!hit || !isInsideLujan(hit.point.x,hit.point.z)) {
        setSelectionError("Seleccioná un punto dentro del perímetro del terreno.");return;
      }
      const location=lujanToGeographic(hit.point.x,hit.point.z);
      setSelectionError("");
      selectRef.current({latitude:location.latitude.toFixed(7),longitude:location.longitude.toFixed(7)});
    };
    renderer.domElement.addEventListener("pointerdown",pointerDown);
    renderer.domElement.addEventListener("pointerup",pointerUp);
    renderer.domElement.addEventListener("pointercancel",pointerCancel);
    renderer.domElement.addEventListener("pointermove",pointerMove);
    renderer.domElement.addEventListener("pointerleave",pointerLeave);
    const labels = landmarks.map(landmark => {
      const element=document.createElement("span"); element.className="lujan-landmark"; element.textContent=landmark.name;
      host.appendChild(element); return {...landmark,element};
    });
    const resize = () => { const width=host.clientWidth, height=host.clientHeight; if (!width || !height) return;
      renderer.setSize(width,height); camera.aspect=width/height; camera.updateProjectionMatrix(); };
    const observer=new ResizeObserver(resize); observer.observe(host); resize();
    let frame=0;
    const animate=() => {
      frame=requestAnimationFrame(animate); controls.update();
      if(hoverPointer && !selectRef.current) {
        camera.updateMatrixWorld();assetLayer.updateMatrixWorld(true);raycaster.setFromCamera(hoverPointer,camera);
        let object:THREE.Object3D|undefined=raycaster.intersectObjects([...pickable,assetLayer],true)[0]?.object;
        while(object && !object.userData.assetId) object=object.parent ?? undefined;
        setHovered(object ?? null);
      }
      renderer.render(scene,camera);
      if(compass.current) compass.current.style.transform=`rotate(${Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z)*180/Math.PI}deg)`;
      [...labels,...assetLabels].forEach(label => { const {position,element}=label; const p=position.clone().project(camera);
        const hiddenAsset="assetId" in label && label.assetId!==hoveredId;
        element.style.display = hiddenAsset || p.z < -1 || p.z>1 || Math.abs(p.x)>1 || Math.abs(p.y)>1 ? "none" : "block";
        element.style.left=`${(p.x+1)*50}%`; element.style.top=`${(1-p.y)*50}%`;
      });
    }; animate();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); actions.current=()=>{};updateEnvironment.current=()=>{};
      updateMarker.current=()=>{};
      updateAssets.current=()=>{};assetLabels.forEach(l=>l.element.remove());
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointerup",pointerUp);
      renderer.domElement.removeEventListener("pointercancel",pointerCancel);
      renderer.domElement.removeEventListener("pointermove",pointerMove);
      renderer.domElement.removeEventListener("pointerleave",pointerLeave);
      hoverMaterial.dispose();hoverEdgeMaterial.dispose();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose(); (Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));
        }
      }); materials.forEach(m=>{ Object.values(m).forEach(value=>{if(value instanceof THREE.Texture) textures.add(value);});m.dispose(); });
      textures.forEach(t=>t.dispose()); sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove(); labels.forEach(l=>l.element.remove());
    };
  },[]);
  return <div className={`bragado-map lujan-map${expanded ? " bragado-map-expanded" : ""}${labelsVisible ? "" : " lujan-hide-labels"}`}>
    <div className="lujan-map-viewport">
    <div className="bragado-map-stage" ref={stage}/>
    <div className="bragado-map-toolbar">
      <button type="button" title={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-label={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button>
      <button type="button" title={panelOpen ? "Minimizar panel" : "Equipos y controles"} aria-label={panelOpen ? "Minimizar panel" : "Equipos y controles"} aria-expanded={panelOpen} onClick={()=>setPanelOpen(v=>!v)}><SlidersHorizontal size={18}/></button>
      <MapToolbarSelect ariaLabel="Vista 3D" value={view} options={[
        {value:"top",label:"Desde arriba"},{value:"perspective",label:"Perspectiva"},
        {value:"patio",label:"Patio"},{value:"entrance",label:"Entrada"},{value:"service",label:"Lateral"}
      ]} onChange={(next: View)=>actions.current(next)}/>
      <MapToolbarSelect ariaLabel="Iluminación del ambiente" title="Iluminación del ambiente" value={environmentMode} options={(Object.entries(ENVIRONMENT_MODES) as Array<[EnvironmentMode,string]>).map(([value,label])=>({value,label}))} onChange={setEnvironmentMode}/>
    </div>
    <div className="bragado-camera-tools">
      <span className="bragado-compass" title="Norte" aria-label="Norte"><span ref={compass}><b>N</b><ArrowUp size={16}/></span></span>
      <button type="button" title="Centrar planta" aria-label="Centrar planta" onClick={()=>actions.current(view)}><Focus size={17}/></button>
    </div>
    {panelOpen && <aside className="bragado-map-panel">
      <header><span>{savedLujanAssets(assets,filters).length} activos</span><strong>Mapa 3D Luján</strong><button type="button" title="Minimizar panel" aria-label="Minimizar panel" onClick={()=>setPanelOpen(false)}><X size={16}/></button></header>
      <div className="bragado-map-filter-block"><span>Referencias del terreno</span><div><button type="button" className={labelsVisible ? "active" : undefined} aria-pressed={labelsVisible} onClick={()=>setLabelsVisible(v=>!v)}>Casa, pileta y patio</button></div></div>
    </aside>}
    {error && <p className="lujan-map-error" role="alert">No se pudo iniciar el mapa 3D. Activá WebGL en tu navegador y recargá la página.</p>}
    </div>
    {onSelect && <p className="lujan-coordinate-hint" role="status">{selectionError || "Hacé clic para ubicar el activo. Arrastrá para girar el mapa."}</p>}
  </div>;
}
