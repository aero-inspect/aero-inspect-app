import { useEffect, useRef, useState, type ComponentProps } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Crosshair, LocateFixed, Minus, Plus } from "lucide-react";
import type { BragadoPlant3DMap } from "./BragadoPlant3DMap";
import { createStool, disposeAssetGroup } from "./lujan/assets";
import { createHeater } from "./lujan/heater";
import { createMetalDrum } from "./lujan/metalDrum";
import { assetBelongsToPlant } from "../data/plantScope";
import { UTN_PLANT } from "../data/plants";
import { BACKEND_ASSET_TYPE_LABELS } from "../api/constants";
import { buildPitchMarkings, smallPitchGoalAreaCenter } from "./utn/pitch";
import { surface } from "./utn/materials";
import { buildSpaceTwo } from "./utn/spaceTwo";
import { buildUtnBuildings } from "./utn/buildings";
import { UTN_FOOTPRINTS } from "../data/utnFootprints";
import { addMissionDrone } from "./bragado/drone";
import { createMissionPlayback, type PlaybackGeoreference } from "./bragado/missionPlayback";

const UTN_DRONE_SCALE = .6;
const utnPlaybackReference: PlaybackGeoreference = {
  northRotationDegrees: 0,
  groundHeight: .113 * UTN_DRONE_SCALE,
  storagePrefix: 'aeroinspect.utn.mission-trail.',
  stayAtDockUntilTelemetry: true,
  showActualTrail: true,
  toPosition(point) {
    const height = point.relativeAltitude ?? point.altitude;
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
        height === undefined || !Number.isFinite(height)) return null;
    return local([point.longitude, point.latitude]).setY(.113 * UTN_DRONE_SCALE + Math.max(0, height));
  }
};

// Local metric frame: east/right, south/forward. KML elevations are all zero.
const lat0 = -34.6584, lon0 = -58.4678;
const lonScale = 111320 * Math.cos(lat0 * Math.PI / 180);
const local = ([lon, lat]: readonly number[]) => new THREE.Vector3((lon-lon0)*lonScale, 0, -(lat-lat0)*110940);
// Align the small goal-area corners with the two fixed demo stools; flight coordinates stay untouched.
const stoolCenter = local([
  (-58.46697110019356 - 58.46704569581885) / 2,
  (-34.65817664557261 - 34.658225717413075) / 2
]);
const smallPitchOffset = stoolCenter.sub(smallPitchGoalAreaCenter(local));
const smallPitchProject = (point: readonly number[]) => local(point).add(smallPitchOffset);
export function UTNPlant3DMap({ onSelect, selectedLocation, assets=[], filters, onViewAsset, focusedAssetCode, assetSelection, playback }: ComponentProps<typeof BragadoPlant3DMap> & { selectedLocation?: { latitude: string; longitude: string }; onSelect?: (location: { latitude: string; longitude: string }) => void }) {
  const playbackRef=useRef(playback);playbackRef.current=playback;
  const playbackController=useRef<ReturnType<typeof createMissionPlayback>|null>(null);
  const stopAutoFrame=useRef<() => void>(()=>{});
  const [following,setFollowing]=useState(false);
  useEffect(()=>{if(playback)playbackController.current?.update(playback);},[playback]);
  useEffect(()=>{setFollowing(false);playbackController.current?.setFollowing(false);},[playback?.id]);
  const assetProps=useRef({assets,filters,onViewAsset,focusedAssetCode,assetSelection});
  assetProps.current={assets,filters,onViewAsset,focusedAssetCode,assetSelection};
  const refreshAssets=useRef<() => void>(()=>{});
  useEffect(()=>{refreshAssets.current();},[assets,filters,onViewAsset,focusedAssetCode,assetSelection]);
  useEffect(()=>{refreshAssets.current();},[playback?.points]);
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect); select.current = onSelect;
  const markerRef = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.visible = Boolean(selectedLocation);
    if (selectedLocation) marker.position.copy(local([Number(selectedLocation.longitude), Number(selectedLocation.latitude)])).setY(.6);
  }, [selectedLocation]);
  const location = useRef(selectedLocation); location.current = selectedLocation;
  const zoomIn = useRef<() => void>(()=>{});
  const zoomOut = useRef<() => void>(()=>{});
  const centerMap = useRef<() => void>(()=>{});
  const [error, setError] = useState(false);
  useEffect(()=>{
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({antialias:true}); } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "UTN Lugano: dos espacios de césped, dos canchas con cuatro arcos, laboratorio, galpones y bancos de cemento");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#dce6ec");
    const camera = new THREE.PerspectiveCamera(45,1,.1,1000);
    const controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor=.075; controls.rotateSpeed=.85; controls.panSpeed=1.05; controls.zoomSpeed=1.15;
    controls.minDistance=.65; controls.maxDistance=350; controls.maxPolarAngle=Math.PI/2-.02;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = false;
    // Keep both the orbit target and the camera above the ground after pan/zoom.
    const constrainCamera = () => {
      controls.target.y = Math.max(0, controls.target.y);
      camera.position.y = Math.max(.12, camera.position.y);
    };
    controls.addEventListener("change", constrainCamera);
    let automaticFrame=true;
    controls.addEventListener("start",()=>{automaticFrame=false;});
    stopAutoFrame.current=()=>{automaticFrame=false;};
    camera.position.set(65,80,-95);controls.target.set(-12,0,8);controls.update();
    zoomIn.current = () => {
      automaticFrame=false;
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(Math.max(controls.minDistance, offset.length() * .8));
      camera.position.copy(controls.target).add(offset);controls.update();
    };
    zoomOut.current = () => {
      automaticFrame=false;
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(Math.min(controls.maxDistance, offset.length() * 1.25));
      camera.position.copy(controls.target).add(offset);controls.update();
    };
    scene.add(new THREE.HemisphereLight(0xe7edf2,0x7e806b,2.5));
    const sun = new THREE.DirectionalLight(0xf5f4ee,1.25); sun.position.set(-65,100,45); sun.castShadow=true;
    sun.shadow.bias=-.00015; sun.shadow.normalBias=.035; sun.shadow.radius=3;
    sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,far:300}); scene.add(sun);
    const grass=surface(0x728753,"grass");
    const pitchGrass=surface(0x50743c,"pitch");
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(270,270),grass);
    ground.rotation.x=-Math.PI/2; ground.position.y=-.025; ground.receiveShadow=true; scene.add(ground);
    const areas: THREE.Mesh[]=[];
    for (const [name, ring] of Object.entries(UTN_FOOTPRINTS).sort(([a],[b])=>Number(b==="Espacio 2")-Number(a==="Espacio 2"))) {
      // User confirmed Galpon and Galpon2 refer to the same building.
      if (name.startsWith("Arco") || name === "Galpon2") continue;
      const points=ring.map(name === "Cancha 2" ? smallPitchProject : local);
      const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
      const color=name==="Cancha 1"?0x6e9154:name==="Pasillo abierto"?0x77915a:name.includes("descanso")?0xa4b68a:0x8999a5;
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),name.startsWith("Cancha") ? pitchGrass : name==="Pasillo abierto" || name==="Espacio 2" || name.includes("descanso") ? grass : new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:1}));
      mesh.rotation.x=-Math.PI/2; mesh.position.y=name==="Espacio 2" ? .001 : .005; mesh.receiveShadow=true; scene.add(mesh); areas.push(mesh);
      // KML sectors delimit geometry; they are not painted white lines on site.
    }
    scene.add(buildPitchMarkings(local));
    scene.add(buildPitchMarkings(smallPitchProject,true));
    const buildings=buildUtnBuildings(local);buildings.add(buildSpaceTwo(local,smallPitchProject));scene.add(buildings);
    let missionPlayback: ReturnType<typeof createMissionPlayback> | null = null;
    if (playbackRef.current) {
      const dock=addMissionDrone(scene);
      dock.scale.setScalar(UTN_DRONE_SCALE);
      // Reduce the platform footprint by 15%, preserving aircraft size and ground height.
      const platform = new THREE.Group();
      platform.name = "Lugano landing platform";
      for (const child of [...dock.children]) {
        if (child.name !== "Reference quadcopter") platform.add(child);
      }
      platform.scale.set(.85, 1, .85);
      dock.add(platform);
      // Base del dron = TAKEOFF del plan demo de Lugano (mismo punto que el home del simulador PX4).
      // Base del dron en Lugano: despegue del plan "Rectangulo Lugano" y home del simulador.
      dock.position.copy(local([-58.466981,-34.658170]));
      missionPlayback=createMissionPlayback(scene,dock,camera,controls,utnPlaybackReference);
      playbackController.current=missionPlayback;
      missionPlayback.update(playbackRef.current);
    }
    const assetLayer=new THREE.Group();scene.add(assetLayer);
    // Al armar una misión, el recorrido del plan elegido queda dibujado como referencia:
    // la línea a la altura de vuelo y un punto por waypoint (más grande en las paradas).
    const routeLayer=new THREE.Group();routeLayer.name="Selected plan route";scene.add(routeLayer);
    const routeLineMaterial=new THREE.LineBasicMaterial({color:0x38c6e0,toneMapped:false});
    const routePointMaterial=new THREE.MeshBasicMaterial({color:0x1f8fb0,toneMapped:false});
    const clearRoute=()=>{routeLayer.children.forEach(o=>(o as THREE.Mesh|THREE.Line).geometry.dispose());routeLayer.clear();};
    // Puntos a encuadrar mientras el usuario no mueva la cámara: el recorrido, si hay uno dibujado.
    let routeFrame: THREE.Vector3[] | null = null;
    const frameCamera={current:()=>{}};
    const drawRoute=(route:NonNullable<typeof assetSelection>["route"])=>{
      clearRoute();
      const hadFrame=routeFrame!==null;routeFrame=null;
      const points=[...route].sort((a,b)=>a.sequence-b.sequence)
        .map(point=>({point,position:utnPlaybackReference.toPosition(point)}))
        .filter((item):item is {point:typeof item.point;position:THREE.Vector3}=>item.position!==null);
      if(points.length<2){if(hadFrame)frameCamera.current();return;}
      // Margen de unos metros alrededor del recorrido, a ras del piso y a la altura de vuelo.
      const box=new THREE.Box3().setFromPoints(points.map(item=>item.position)).expandByScalar(4);
      routeFrame=[];
      for(const x of [box.min.x,box.max.x])for(const y of [0,box.max.y])for(const z of [box.min.z,box.max.z])routeFrame.push(new THREE.Vector3(x,y,z));
      frameCamera.current();
      routeLayer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(item=>item.position)),routeLineMaterial));
      for(const {point,position} of points){
        const isStop=(point as {action?:string}).action==="STOP";
        const dot=new THREE.Mesh(new THREE.SphereGeometry(isStop?.18:.1,16,12),routePointMaterial);
        dot.position.copy(position);routeLayer.add(dot);
      }
    };
    // Las etiquetas de los activos sólo se muestran al clickear el activo (o si es el enfocado).
    let labels: Array<{button:HTMLButtonElement;position:THREE.Vector3;idAsset:number;focused:boolean}>=[];
    let openLabel: number | null = null;
    let lastFocus: string | null | undefined;
    refreshAssets.current=()=>{
      disposeAssetGroup(assetLayer);labels.forEach(l=>l.button.remove());labels=[];
      const props=assetProps.current;
      drawRoute(props.assetSelection?.route ?? []);
      const route = props.assetSelection?.route ?? playbackRef.current?.points ?? [];
      const isRectangleDemo = [
        [-34.658288, -58.46683],
        [-34.658342, -58.466892]
      ].every(([latitude, longitude]) => route.some(point =>
        Math.abs(point.latitude - latitude) < .000015 && Math.abs(point.longitude - longitude) < .000015));
      const statuses={ACTIVE:"Activo",MAINTENANCE:"En mantenimiento",OUT_OF_SERVICE:"Fuera de servicio",UNCONFIRMED:"Sin confirmar"};
      for(const asset of props.assets) {
        if(asset.idAsset<=0 || !assetBelongsToPlant(asset,UTN_PLANT))continue;
        const f=props.filters;
        if(f && f.type!=="Todos" && f.type!==BACKEND_ASSET_TYPE_LABELS[asset.type])continue;
        if(f && f.status!=="Todos" && f.status!==statuses[asset.status])continue;
        if(f?.search && !`${asset.name} ${asset.code}`.toLocaleLowerCase().includes(f.search.trim().toLocaleLowerCase()))continue;
        const position=local([asset.longitude,asset.latitude]);
        const ray=new THREE.Raycaster(position.clone().setY(40),new THREE.Vector3(0,-1,0));
        position.y=(ray.intersectObject(buildings,true)[0]?.point.y ?? 0)+.01;
        const item=new THREE.Group();item.userData.idAsset=asset.idAsset;assetLayer.add(item);
        if (asset.type === "TAMBOR_METALICO") {
          const drum=createMetalDrum();drum.position.copy(position);item.add(drum);
        } else if (asset.type === "ESTUFA") {
          const heater=createHeater();heater.position.copy(position);item.add(heater);
        } else if (asset.type === "BANQUETA") {
          // The demo route keeps both stools as selectable waypoints without rendering their 3D bodies.
          if (!(isRectangleDemo && ["ACT-8B586BAC", "ACT-F536EFAF"].includes(asset.code))) {
            const stool=createStool();stool.position.copy(position);item.add(stool);
          }
        } else {
          // The map must expose every asset in the plant.  A neutral marker avoids
          // representing roofs, sheds and industrial equipment as benches.
          const markerGroup=new THREE.Group();
          const markerMaterial=new THREE.MeshStandardMaterial({color:0x295b87,metalness:.08,roughness:.58});
          const stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.55,12),markerMaterial);
          stem.position.y=.28;stem.castShadow=true;markerGroup.add(stem);
          const head=new THREE.Mesh(new THREE.OctahedronGeometry(.22),markerMaterial);
          head.position.y=.68;head.castShadow=true;markerGroup.add(head);
          markerGroup.position.copy(position);item.add(markerGroup);
        }
        const selected=asset.code===props.focusedAssetCode || props.assetSelection?.selectedIds.includes(asset.idAsset);
        const halo=new THREE.Mesh(new THREE.RingGeometry(.45,.6,32),new THREE.MeshBasicMaterial({color:selected?0x34b57a:0x3289c6,side:THREE.DoubleSide}));
        halo.rotation.x=-Math.PI/2;halo.position.copy(position).add(new THREE.Vector3(0,.01,0));item.add(halo);
        const button=document.createElement("button");button.type="button";button.textContent=asset.name;
        button.setAttribute("aria-label",`Ver ${asset.name} en el mapa`);
        Object.assign(button.style,{position:"absolute",padding:"4px 8px",borderRadius:"6px",border:"1px solid #b8c9d6",background:selected?"#d3f4e1":"white",color:"#20394e",fontSize:"11px",cursor:"pointer",zIndex:"1"});
        button.disabled=Boolean(select.current || props.assetSelection?.disabledIds?.includes(asset.idAsset));
        button.onclick=()=>{const current=assetProps.current;if(current.assetSelection)current.assetSelection.onSelect(asset.idAsset);else current.onViewAsset?.(asset.idAsset);};
        container.appendChild(button);labels.push({button,position:position.clone().add(new THREE.Vector3(0,.75,0)),idAsset:asset.idAsset,focused:asset.code===props.focusedAssetCode});
        if(asset.code===props.focusedAssetCode && lastFocus!==asset.code) {
          automaticFrame=false;controls.target.copy(position);camera.position.copy(position).add(new THREE.Vector3(6,5,6));lastFocus=asset.code;
        }
      }
    };
    refreshAssets.current();
    const material=new THREE.MeshStandardMaterial({color:0xf7f7f3,metalness:.3,roughness:.5});
    function tube(a:THREE.Vector3,b:THREE.Vector3) {
      const delta=b.clone().sub(a);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,delta.length(),12),material);
      mesh.position.copy(a).add(b).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); mesh.castShadow=true; scene.add(mesh);
    }
    for (const [name,ring] of Object.entries(UTN_FOOTPRINTS)) {
      if (!name.startsWith("Arco") || name.includes("cancha 2")) continue;
      const p=ring.map(local);
      // Average the short sides of each goal footprint to place the posts.
      const shortest=p.reduce((best,a,i)=>a.distanceTo(p[(i+1)%4])<p[best].distanceTo(p[(best+1)%4])?i:best,0);
      const a=p[shortest].clone().add(p[(shortest+1)%4]).multiplyScalar(.5);
      const b=p[(shortest+2)%4].clone().add(p[(shortest+3)%4]).multiplyScalar(.5);
      const topA=a.clone().setY(2.44),topB=b.clone().setY(2.44);
      tube(a,topA);tube(b,topB);tube(topA,topB);
    }
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.6),new THREE.MeshStandardMaterial({color:0xe69932})); marker.visible=Boolean(location.current);scene.add(marker); markerRef.current=marker;
    if(location.current) marker.position.copy(local([Number(location.current.longitude),Number(location.current.latitude)])).setY(.6);
    let down=[0,0];
    const start=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
    const pick=(e:PointerEvent)=>{
      if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;
      const rect=renderer.domElement.getBoundingClientRect();
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      if(!select.current) {
        // Click sobre un activo: muestra su etiqueta y, al armar una misión, lo elige o lo saca.
        let target: THREE.Object3D | null = ray.intersectObject(assetLayer,true)[0]?.object ?? null;
        while(target && target.userData.idAsset===undefined)target=target.parent;
        const idAsset=target?.userData.idAsset as number | undefined;
        if(idAsset===undefined){openLabel=null;return;}
        const selection=assetProps.current.assetSelection;
        if(selection){openLabel=idAsset;if(!selection.disabledIds?.includes(idAsset))selection.onSelect(idAsset);}
        else openLabel=openLabel===idAsset?null:idAsset;
        return;
      }
      const hit=ray.intersectObjects([...areas,buildings],true)[0];if(!hit)return;
      marker.position.copy(hit.point).setY(.6);marker.visible=true;
      select.current({latitude:String(lat0-hit.point.z/110940),longitude:String(lon0+hit.point.x/lonScale)});
    };
    renderer.domElement.addEventListener("pointerdown",start);renderer.domElement.addEventListener("pointerup",pick);
    const bounds=new THREE.Box3().setFromPoints(Object.values(UTN_FOOTPRINTS).flatMap(ring=>ring.map(local)));
    bounds.max.y=11;
    const corners: THREE.Vector3[]=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [0,11])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z));
    centerMap.current = () => {
      automaticFrame=false;
      const center=bounds.getCenter(new THREE.Vector3());
      controls.target.copy(center).setY(0);
      camera.position.copy(controls.target).add(new THREE.Vector3(0,185,.01));
      camera.lookAt(controls.target);controls.update();
    };
    // Encuadre automático (hasta que el usuario mueva la cámara): todo el predio o, si hay un
    // recorrido dibujado, sólo el recorrido.
    frameCamera.current=()=>{
      if(!automaticFrame || !container.clientWidth || !container.clientHeight)return;
      const targets=routeFrame ?? corners;
      controls.target.copy(routeFrame ? new THREE.Box3().setFromPoints(routeFrame).getCenter(new THREE.Vector3()).setY(0) : bounds.getCenter(new THREE.Vector3()));
      const direction=select.current ? new THREE.Vector3(0,1,.001) : new THREE.Vector3(.65,.8,-.95).normalize();
      for(let distance=routeFrame ? 8 : 60;distance<=350;distance*=1.1) {
        camera.position.copy(controls.target).addScaledVector(direction,distance);
        camera.lookAt(controls.target);camera.updateMatrixWorld();
        if(targets.every(c=>{const p=c.clone().project(camera);return Math.abs(p.x)<.88 && Math.abs(p.y)<.88;}))break;
      }
      controls.update();
    };
    const observer=new ResizeObserver(()=>{
      const w=container.clientWidth,h=container.clientHeight;if(!w || !h)return;
      renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
      frameCamera.current();
    });observer.observe(container);
    renderer.setAnimationLoop(()=>{
      missionPlayback?.animate();
      controls.update();constrainCamera();camera.updateMatrixWorld();
      for(const label of labels) {
        const p=label.position.clone().project(camera);
        label.button.hidden=(label.idAsset!==openLabel && !label.focused) || p.z < -1 || p.z > 1 || Math.abs(p.x)>1 || Math.abs(p.y)>1;
        label.button.style.left=`${(p.x+1)/2*container.clientWidth}px`;
        label.button.style.top=`${(1-p.y)/2*container.clientHeight}px`;
        label.button.style.transform="translate(-50%, -100%)";
      }
      renderer.render(scene,camera);
    });
    return ()=>{missionPlayback?.destroy();playbackController.current=null;refreshAssets.current=()=>{};labels.forEach(l=>l.button.remove());markerRef.current=null;observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();renderer.domElement.removeEventListener("pointerdown",start);renderer.domElement.removeEventListener("pointerup",pick);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <section className="utn-map" style={{position:"relative",width:"100%",height:"100%",minHeight:360,background:"#dce6ec",borderRadius:16,overflow:"hidden"}}>
    <div ref={host} style={{height:"100%",minHeight:360}} />
    <div className="utn-map-controls" aria-label="Controles del mapa">
      <button type="button" aria-label="Acercar mapa" title="Acercar" onClick={()=>zoomIn.current()}><Plus size={20}/></button>
      <button type="button" aria-label="Alejar mapa" title="Alejar" onClick={()=>zoomOut.current()}><Minus size={20}/></button>
      <button type="button" aria-label="Centrar vista superior de la planta" title="Centrar planta" onClick={()=>centerMap.current()}><LocateFixed size={19}/></button>
      {playback && <button className="utn-map-follow" type="button" aria-label="Seguir dron" title="Seguir dron" aria-pressed={following} onClick={()=>{
        const next=!following;if(next)stopAutoFrame.current();setFollowing(next);playbackController.current?.setFollowing(next);
      }}><Crosshair size={19}/></button>}
    </div>
    {error && <p role="alert" style={{position:"absolute",bottom:16,left:16}}>No se pudo iniciar la vista 3D.</p>}
  </section>;
}
