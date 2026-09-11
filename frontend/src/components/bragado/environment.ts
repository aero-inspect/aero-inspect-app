import * as T from 'three';
import {blendEnvironment,getEnvironmentMode,resolveEnvironment,subscribeEnvironment} from './timeOfDay';

export function createEnvironment(scene:T.Scene,renderer:T.WebGLRenderer,heightScale=1) {
  const rig=new T.Group();rig.name='Shared plant environment';scene.add(rig);
  const ambient=new T.HemisphereLight('#dcecff','#354338',1.6);rig.add(ambient);
  const sun=new T.DirectionalLight('#fff7ed',2.7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.07;sun.shadow.bias=-.0001;
  Object.assign(sun.shadow.camera,{left:-125,right:125,top:125,bottom:-125,near:.5,far:400});sun.target.position.set(-20,0,-35);rig.add(sun,sun.target);
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color()},horizon:{value:new T.Color()}},vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;varying vec3 direction;void main(){float h=max(normalize(direction).y,0.0);gl_FragColor=vec4(mix(horizon,top,smoothstep(0.0,0.65,h)),1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }'});
  const sky=new T.Mesh(new T.SphereGeometry(850,40,24),skyMaterial);sky.position.set(-20,0,-35);rig.add(sky);
  let seed=719;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const stars:T.Points<T.BufferGeometry,T.PointsMaterial>[]=[];
  for(let tier=0;tier<3;tier++){
    const positions:number[]=[];for(let i=0;i<170-tier*50;i++){const y=.07+random()*.93,angle=random()*Math.PI*2,r=Math.sqrt(1-y*y);positions.push(-20+780*r*Math.cos(angle),780*y,-35+780*r*Math.sin(angle));}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    const material=new T.PointsMaterial({color:tier===1?'#d8e6ff':'#fff5e7',size:1.8+tier*1.5,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:true,toneMapped:false,fog:false});
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() { if(distance(gl_PointCoord,vec2(0.5))>0.5) discard;');};
    const points=new T.Points(geometry,material);stars.push(points);rig.add(points);
  }
  const moonCanvas=document.createElement('canvas');moonCanvas.width=moonCanvas.height=128;const ctx=moonCanvas.getContext('2d')!;ctx.fillStyle='#dddeda';ctx.fillRect(0,0,128,128);for(let i=0;i<180;i++){ctx.fillStyle=`rgba(90,101,119,${.03+random()*.12})`;ctx.beginPath();ctx.arc(random()*128,random()*128,1+random()*10,0,Math.PI*2);ctx.fill();}
  const texture=new T.CanvasTexture(moonCanvas);texture.colorSpace=T.SRGBColorSpace;
  const moonMaterial=new T.MeshBasicMaterial({map:texture,color:'#cbd9f1',transparent:true,opacity:0,depthWrite:false,toneMapped:false,fog:false});
  const moon=new T.Mesh(new T.SphereGeometry(6.5,32,20),moonMaterial);moon.position.set(500,330,-180);rig.add(moon);
  const haloMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,uniforms:{opacity:{value:0}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform float opacity;varying vec3 n;varying vec3 v;void main(){float a=pow(max(0.,dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.6,.75,1.,a*opacity*.1);}'});
  const halo=new T.Mesh(new T.SphereGeometry(7.1,24,16),haloMaterial);halo.position.copy(moon.position);rig.add(halo);
  const solarMaterial=new T.MeshBasicMaterial({color:'#fff2ce',transparent:true,opacity:1,depthWrite:false,toneMapped:false});const solar=new T.Mesh(new T.SphereGeometry(5,20,12),solarMaterial);rig.add(solar);
  const lamps:Array<{light:T.Light;power:number}>=[],emissions=new Map<T.MeshStandardMaterial,number>();
  // Existing unloading lamps and dock LEDs share the same switching curve.
scene.traverse(o=>{if(o instanceof T.PointLight){lamps.push({light:o,power:o.intensity});o.castShadow=!o.userData.dockLight;o.shadow.mapSize.set(256,256);o.shadow.autoUpdate=false;o.shadow.needsUpdate=true;}if(o instanceof T.Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof T.MeshStandardMaterial&&material.emissive.getHex()!==0)emissions.set(material,material.emissiveIntensity);}});
  const metal=new T.MeshStandardMaterial({color:'#495153',metalness:.5,roughness:.65});
  const bulb=new T.MeshStandardMaterial({color:'#c5c9bf',emissive:'#fff0d6',emissiveIntensity:0});emissions.set(bulb,2);
  const beaconMaterial=new T.MeshStandardMaterial({color:'#681d1d',emissive:'#ff2424',emissiveIntensity:0,roughness:.4});
  const beaconGeometry=new T.SphereGeometry(.11,12,8);
  for(const [x,z,h] of [[-1,0,31],[12,5,25]]){
    const base=new T.Mesh(new T.CylinderGeometry(.15,.18,.16,12),metal);base.position.set(x,h*heightScale+.68,z);rig.add(base);
    const beacon=new T.Mesh(beaconGeometry,beaconMaterial);beacon.position.set(x,h*heightScale+.82,z);rig.add(beacon);
  }
  const poleGeometry=new T.CylinderGeometry(.09,.13,7,8),headGeometry=new T.BoxGeometry(.65,.14,.9),bulbGeometry=new T.BoxGeometry(.5,.04,.7);
  const sites=[[-75,-65,7],[38,30,7],[28,-11,7],[-1,0,29]];
  sites.forEach(([x,z,height])=>{
    if(height===7){const pole=new T.Mesh(poleGeometry,metal);pole.position.set(x,3.5,z);rig.add(pole);}
    const head=new T.Mesh(headGeometry,metal);head.position.set(x,height,z);rig.add(head);
    const emitter=new T.Mesh(bulbGeometry,bulb);emitter.position.set(x,height-.09,z);rig.add(emitter);
    const light=new T.SpotLight('#fff0db',0,height===7?38:65,Math.PI*.36,.65,2);light.position.set(x,height-.15,z);light.target.position.set(x,0,z+2);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.normalBias=.08;light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;rig.add(light,light.target);lamps.push({light,power:height===7?420:1800});
  });
  // Pedestrian and structure fixtures; only sector lights add shadow maps.
  const fixture=(x:number,y:number,z:number,tx:number,tz:number,power:number,pole=false)=>{
    if(pole){const support=new T.Mesh(new T.CylinderGeometry(.065,.1,y,8),metal);support.position.set(x,y/2,z);rig.add(support);}
    const head=new T.Mesh(headGeometry,metal);head.scale.set(.7,.8,.7);head.position.set(x,y,z);rig.add(head);
    const face=new T.Mesh(bulbGeometry,bulb);face.scale.set(.7,1,.7);face.position.set(x,y-.08,z);rig.add(face);
    if(power){const light=new T.SpotLight('#fff0db',0,y*3,Math.PI*.32,.75,2);light.position.set(x,y-.14,z);light.target.position.set(tx,.1,tz);light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.normalBias=.06;light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;rig.add(light,light.target);lamps.push({light,power});}
  };
  // Pedestrian ground pools share their geometry and material.
  const poolCanvas=document.createElement('canvas');poolCanvas.width=poolCanvas.height=64;
  const pc=poolCanvas.getContext('2d')!,gradient=pc.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,238,199,0.48)');gradient.addColorStop(.4,'rgba(255,238,199,0.2)');gradient.addColorStop(1,'rgba(255,238,199,0)');
  pc.fillStyle=gradient;pc.fillRect(0,0,64,64);
  const poolTexture=new T.CanvasTexture(poolCanvas);
  const poolMaterial=new T.MeshBasicMaterial({map:poolTexture,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});
  const poolGeometry=new T.PlaneGeometry(1,1);
  const pool=(x:number,z:number,size:number)=>{const m=new T.Mesh(poolGeometry,poolMaterial);m.rotation.x=-Math.PI/2;m.position.set(x,.07,z);m.scale.set(size,size,1);rig.add(m);};
  // Bollards follow the outside of the nine-metre access lane.
  for(const [x,z] of [[49,39],[49,25],[48,11],[33,-7],[-49,-33],[-39,-39]]){fixture(x,1.1,z,x,z,0,true);pool(x,z,4);}
  // Eave fixtures are placed using each building's local rotation.
  for(const side of [-1,1])for(const along of [-15,15]){
    const x=-51+(side*13.7+along)*Math.SQRT1_2,z=-77+(-side*13.7+along)*Math.SQRT1_2;
    fixture(x,7.8,z,x+side*3,z-side*3,along===15?240:0);
  }
  // Shell-mounted lamps sit above the silo rim, with a short physical bracket.
  for(const [x,z,r,h] of [[-18.08,-34.08,8.96,19],[-31.84,-17.44,8.96,19],[26.88,30.08,8.64,17],[-8, -21.12,5.76,14],[.96,-13.12,5.28,13],[-17.76,-9.44,5.92,14],[-8,-3.68,5.12,12],[11.36,-1.76,4.96,12],[3.84,7.84,5.44,14],[23.2,8.64,6.08,15],[12.96,18.88,6.24,15]]){
    const support=new T.Mesh(new T.CylinderGeometry(.045,.045,.9,6),metal);support.position.set(x,h+.3,z+r);rig.add(support);fixture(x,h+.75,z+r,x,z+r+3,0);
  }
  fixture(12,24,6.6,16,12,300);
  for(const side of [-1,1]){const x=14+(side*7-6.6)*Math.SQRT1_2,z=-18+(side*7+6.6)*Math.SQRT1_2;fixture(x,8.8,z,x,z+2,0);}
  let current=resolveEnvironment(getEnvironmentMode()),from=current,target=current,started=performance.now();
  function retarget(){from=current;target=resolveEnvironment(getEnvironmentMode());started=performance.now();}
  const unsubscribe=subscribeEnvironment(retarget),timer=window.setInterval(retarget,30000);
  const fog=new T.Fog(current.horizon,280,780);scene.fog=fog;
  function update(now=performance.now()){
    const t=Math.min(1,(now-started)/2200),smooth=t*t*(3-2*t);current=blendEnvironment(from,target,smooth);
    ambient.intensity=current.ambient;ambient.color.copy(current.ambientColor);sun.intensity=current.sun;sun.color.copy(current.sunColor);sun.position.copy(current.sunPosition);renderer.toneMappingExposure=current.exposure;
    skyMaterial.uniforms.top.value.copy(current.top);skyMaterial.uniforms.horizon.value.copy(current.horizon);fog.color.copy(current.horizon);
    stars.forEach((s,i)=>{s.material.opacity=current.stars*(.45+i*.23);s.visible=current.stars>.001;});moonMaterial.opacity=current.moon;haloMaterial.uniforms.opacity.value=current.moon;
    solar.position.copy(current.sunPosition).normalize().multiplyScalar(650);solarMaterial.opacity=1-current.moon;solarMaterial.color.copy(current.sunColor);
    lamps.forEach(({light,power})=>light.intensity=power*current.artificial);emissions.forEach((power,material)=>material.emissiveIntensity=power*current.artificial);
    poolMaterial.opacity=current.artificial;
    beaconMaterial.emissiveIntensity=current.artificial*(.25+1.75*Math.pow(.5+.5*Math.cos(now*Math.PI/1000),2));
  }
  update();
  return {update,destroy(){unsubscribe();clearInterval(timer);sun.shadow.map?.dispose();lamps.forEach(({light})=>{if(light instanceof T.SpotLight||light instanceof T.PointLight)light.shadow.map?.dispose();});const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();rig.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();poolTexture.dispose();rig.removeFromParent();}};
}
