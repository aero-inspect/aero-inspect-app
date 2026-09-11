import { useEffect, useRef } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addMissionDrone } from './bragado/drone';
import '../styles/components/drone-model-viewer.css';

export function DroneModelViewer() {
  const root = useRef<HTMLDivElement>(null);
  const actions = useRef<{zoom:(factor:number)=>void;reset:()=>void}|null>(null);
  useEffect(()=>{
    if(!root.current) return;
    const host=root.current,scene=new T.Scene();scene.background=new T.Color('#ffffff');
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.toneMapping=T.ACESFilmicToneMapping;host.append(renderer.domElement);
    renderer.domElement.setAttribute('aria-label','Modelo tridimensional del dron');
    const model=addMissionDrone(scene,false);
    scene.add(new T.HemisphereLight('#ffffff','#85909b',2.7));
    const light=new T.DirectionalLight('#ffffff',3);light.position.set(3,5,4);scene.add(light);
    const fill=new T.DirectionalLight('#e1f4ff',1.5);fill.position.set(-3,2,-2);scene.add(fill);
    const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),radius=bounds.getBoundingSphere(new T.Sphere()).radius;
    const camera=new T.PerspectiveCamera(38,1,.01,100);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=radius*.8;controls.maxDistance=radius*10;
    function reset(){const limitingFov=Math.min(T.MathUtils.degToRad(camera.fov),2*Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect));const distance=radius/Math.sin(limitingFov/2)*1.12;controls.target.copy(center);camera.position.copy(center).addScaledVector(new T.Vector3(1,.55,1.5).normalize(),distance);controls.update();}
    function resize(){const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();reset();}
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    actions.current={reset,zoom(factor){const offset=camera.position.clone().sub(controls.target);offset.setLength(T.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();}};
    let frame=0;function animate(){controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate);}animate();
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();actions.current=null;
      const materials=new Set<T.Material>(),textures=new Set<T.Texture>();model.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
      materials.forEach(m=>{Object.values(m).forEach(value=>{if(value instanceof T.Texture)textures.add(value);});m.dispose();});textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <section className="drone-model-viewer" aria-label="Vista 3D del dron">
    <div className="drone-model-canvas" ref={root}/>
    <div className="drone-model-tools">
      <button type="button" title="Acercar dron" aria-label="Acercar dron" onClick={()=>actions.current?.zoom(.8)}><ZoomIn size={18}/></button>
      <button type="button" title="Alejar dron" aria-label="Alejar dron" onClick={()=>actions.current?.zoom(1.25)}><ZoomOut size={18}/></button>
      <button type="button" title="Restablecer vista" aria-label="Restablecer vista" onClick={()=>actions.current?.reset()}><RotateCcw size={18}/></button>
    </div>
  </section>;
}
