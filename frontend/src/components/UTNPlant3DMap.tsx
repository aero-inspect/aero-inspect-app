import { useEffect, useRef, useState, type ComponentProps } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BragadoPlant3DMap } from "./BragadoPlant3DMap";
import { surface } from "./utn/materials";
import { buildUtnBuildings } from "./utn/buildings";
import { UTN_FOOTPRINTS } from "../data/utnFootprints";

// Local metric frame: east/right, south/forward. KML elevations are all zero.
const lat0 = -34.6584, lon0 = -58.4678;
const lonScale = 111320 * Math.cos(lat0 * Math.PI / 180);
const local = ([lon, lat]: readonly number[]) => new THREE.Vector3((lon-lon0)*lonScale, 0, -(lat-lat0)*110940);
export function UTNPlant3DMap({ onSelect, selectedLocation }: ComponentProps<typeof BragadoPlant3DMap> & { selectedLocation?: { latitude: string; longitude: string }; onSelect?: (location: { latitude: string; longitude: string }) => void }) {
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
    renderer.domElement.setAttribute("aria-label", "UTN Lugano: cancha y dos arcos georreferenciados, laboratorio, galpón único y bancos de cemento");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#dce6ec");
    const camera = new THREE.PerspectiveCamera(45,1,.1,1000);
    const controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping = true; controls.minDistance=3; controls.maxDistance=350; controls.maxPolarAngle=Math.PI/2-.02;
    camera.position.set(120,110,130);controls.target.set(0,0,0);controls.update();
    zoomIn.current = () => {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(Math.max(controls.minDistance, offset.length() * .8));
      camera.position.copy(controls.target).add(offset);controls.update();
    };
    scene.add(new THREE.HemisphereLight(0xe7edf2,0x7e806b,2.5));
    const sun = new THREE.DirectionalLight(0xf5f4ee,1.25); sun.position.set(-65,100,45); sun.castShadow=true;
    sun.shadow.bias=-.00015; sun.shadow.normalBias=.035; sun.shadow.radius=3;
    sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,far:300}); scene.add(sun);
    const grass=surface(0x728753,"grass");
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(270,270),grass);
    ground.rotation.x=-Math.PI/2; ground.position.y=-.025; ground.receiveShadow=true; scene.add(ground);
    const areas: THREE.Mesh[]=[];
    for (const [name, ring] of Object.entries(UTN_FOOTPRINTS)) {
      // User confirmed Galpon and Galpon2 refer to the same building.
      if (name.startsWith("Arco") || name === "Galpon2") continue;
      const points=ring.map(local);
      const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
      const color=name==="Cancha 1"?0x6e9154:name==="Pasillo abierto"?0x77915a:name.includes("descanso")?0xa4b68a:0x8999a5;
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),name==="Cancha 1" || name==="Pasillo abierto" || name.includes("descanso") ? grass : new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:1}));
      mesh.rotation.x=-Math.PI/2; mesh.position.y=.005; mesh.receiveShadow=true; scene.add(mesh); areas.push(mesh);
      // KML sectors delimit geometry; they are not painted white lines on site.
    }
    scene.add(buildUtnBuildings(local));
    const material=new THREE.MeshStandardMaterial({color:0xf7f7f3,metalness:.3,roughness:.5});
    function tube(a:THREE.Vector3,b:THREE.Vector3) {
      const delta=b.clone().sub(a);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,delta.length(),12),material);
      mesh.position.copy(a).add(b).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); mesh.castShadow=true; scene.add(mesh);
    }
    for (const [name,ring] of Object.entries(UTN_FOOTPRINTS)) {
      if (!name.startsWith("Arco")) continue;
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
      if(!select.current || Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;
      const rect=renderer.domElement.getBoundingClientRect();
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      const hit=ray.intersectObjects(areas)[0];if(!hit)return;
      marker.position.copy(hit.point).setY(.6);marker.visible=true;
      select.current({latitude:String(lat0-hit.point.z/110940),longitude:String(lon0+hit.point.x/lonScale)});
    };
    renderer.domElement.addEventListener("pointerdown",start);renderer.domElement.addEventListener("pointerup",pick);
    const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();});observer.observe(container);
    renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
    return ()=>{markerRef.current=null;observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();renderer.domElement.removeEventListener("pointerdown",start);renderer.domElement.removeEventListener("pointerup",pick);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <section style={{position:"relative",width:"100%",minHeight:500,background:"#dce6ec",borderRadius:16,overflow:"hidden"}}>
    <div ref={host} style={{height:"min(70vh, 720px)",minHeight:500}} />
    <button type="button" aria-label="Acercar mapa" title="Zoom +" onClick={()=>zoomIn.current()}
      style={{position:"absolute",top:16,right:16,width:44,height:44,border:"1px solid #d6dce2",borderRadius:10,background:"white",color:"#233b55",fontSize:28,cursor:"pointer",boxShadow:"0 2px 8px #0002"}}>+</button>
    {error && <p role="alert" style={{position:"absolute",bottom:16,left:16}}>No se pudo iniciar la vista 3D.</p>}
  </section>;
}
