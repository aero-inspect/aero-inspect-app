import * as T from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TelemetryUpdate } from '../../types/telemetry';
import { toPlantPosition, plantGeoreference, type GeographicPosition } from './georeference';

export type MissionRoutePoint={latitude:number;longitude:number;altitude:number;sequence:number;droneDegree?:number};
// trailMode: 'guide' (default, hack de demo) pinta el recorrido hecho calcado de la ruta guía, avanzando según
// donde esté el dron; 'real' pinta el recorrido efectivamente volado. El marcador del dron siempre usa la posición real.
export type MissionPlaybackData={id:string;status:string;points:MissionRoutePoint[];telemetry:TelemetryUpdate|null;trailMode?:'guide'|'real'};
type Sample={position:number[];heading:number;time:number};
const MAX_POINTS=4096;
export type PlaybackGeoreference={toPosition:(point:GeographicPosition)=>T.Vector3|null;northRotationDegrees:number;groundHeight:number;storagePrefix:string;stayAtDockUntilTelemetry?:boolean;showActualTrail?:boolean};
export function createMissionPlayback(scene:T.Scene,dock:T.Group,camera:T.PerspectiveCamera,controls:OrbitControls,reference?:PlaybackGeoreference){
  const project=reference?.toPosition ?? toPlantPosition;
  const northRotation=reference?.northRotationDegrees ?? plantGeoreference.northRotationDegrees;
  const groundHeight=reference?.groundHeight ?? plantGeoreference.groundHeight;
  const storagePrefix=reference?.storagePrefix ?? 'aeroinspect.mission-trail.';
  const drone=dock.getObjectByName('Reference quadcopter')!;
  drone.scale.multiplyScalar(1.25);
  const propellers:T.Object3D[]=[];
  drone.traverse(part=>{if(part.name==='Two-blade propeller')propellers.push(part);});
  let spinning=false;
  dock.updateMatrixWorld(true);scene.attach(drone);
  const home=drone.position.clone();
  const plannedMaterial=new T.LineBasicMaterial({color:'#52cee6',transparent:true,opacity:.5,depthWrite:false,toneMapped:false});
  const actualMaterial=new T.LineBasicMaterial({color:'#258aff',toneMapped:false});
  const planned=new T.Line(new T.BufferGeometry(),plannedMaterial),actual=new T.Line(new T.BufferGeometry(),actualMaterial);scene.add(planned);
  planned.name='Planned mission route';actual.name='Actual mission trail';
  if(reference?.showActualTrail)scene.add(actual);
  let id='',last:Sample|null=null,trail:number[][]=[],routeKey='',terminal=false,following=false;
  let mode:'guide'|'real'='guide',guideRoute:T.Vector3[]=[],guideProgress=0;
  let start=0,duration=0,from=drone.position.clone(),target=from.clone(),fromRotation=drone.quaternion.clone(),targetRotation=fromRotation.clone();
  let previousFrame=performance.now();
  // Ruta guía recortada hasta guideProgress (índice de segmento + fracción).
  function guideTrail():T.Vector3[]{
    if(!guideRoute.length)return [];
    const i=Math.min(Math.floor(guideProgress),guideRoute.length-1),t=guideProgress-i,out=guideRoute.slice(0,i+1);
    if(t>0&&i+1<guideRoute.length)out.push(guideRoute[i].clone().lerp(guideRoute[i+1],t));
    return out;
  }
  function redraw(){actual.geometry.dispose();actual.geometry=new T.BufferGeometry().setFromPoints(mode==='guide'?guideTrail():trail.map(p=>new T.Vector3(...p as [number,number,number])));}
  // Avanza (nunca retrocede) el progreso sobre la guía proyectando la posición del dron en los próximos segmentos.
  function advanceGuide(position:T.Vector3){
    if(guideRoute.length<2)return;
    const first=Math.min(Math.floor(guideProgress),guideRoute.length-2),segment=new T.Vector3(),offset=new T.Vector3();
    let best=Infinity,bestProgress=guideProgress;
    for(let i=first;i<=Math.min(first+3,guideRoute.length-2);i++){
      segment.subVectors(guideRoute[i+1],guideRoute[i]);const length2=segment.lengthSq();
      const t=length2>0?T.MathUtils.clamp(offset.subVectors(position,guideRoute[i]).dot(segment)/length2,0,1):0;
      const distance=guideRoute[i].clone().addScaledVector(segment,t).distanceToSquared(position);
      if(distance<best){best=distance;bestProgress=i+t;}
    }
    if(bestProgress>guideProgress)guideProgress=bestProgress;
  }
  function save(){if(!id)return;try{sessionStorage.setItem(storagePrefix+id,JSON.stringify({last,trail,guide:guideProgress}));}catch{/* Rendering remains available when storage is full. */}}
  function update(data:MissionPlaybackData){
    const nextMode=data.trailMode==='real'?'real':'guide',modeChanged=nextMode!==mode;mode=nextMode;
    if(data.id!==id){save();id=data.id;last=null;trail=[];guideProgress=0;routeKey='';terminal=false;following=false;drone.position.copy(home);drone.quaternion.identity();
      try{const saved=JSON.parse(sessionStorage.getItem(storagePrefix+id)||'null');if(saved&&Number.isFinite(saved.guide))guideProgress=Math.max(0,saved.guide);if(saved&&Array.isArray(saved.trail)&&saved.trail.every((p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))&&saved.last&&Number.isFinite(saved.last.time)&&Number.isFinite(saved.last.heading)&&Array.isArray(saved.last.position)&&saved.last.position.length===3&&saved.last.position.every(Number.isFinite)){trail=saved.trail.slice(-MAX_POINTS);last=saved.last;drone.position.fromArray(last!.position);drone.rotation.y=last!.heading;}}catch{/* Ignore invalid saved visualization data. */}redraw();duration=0;
    }
    const points=[...data.points].sort((a,b)=>a.sequence-b.sequence),key=JSON.stringify(points);
    if(key!==routeKey){routeKey=key;const positions=points.map(project).filter((p):p is T.Vector3=>p!==null);planned.geometry.dispose();planned.geometry=new T.BufferGeometry().setFromPoints(positions);guideRoute=positions;if(mode==='guide')redraw();if(!last&&positions.length&&!reference?.stayAtDockUntilTelemetry){drone.position.copy(positions[0]);drone.rotation.y=T.MathUtils.degToRad(-(points[0].droneDegree??0)+northRotation);} }
    if(!last&&data.status==='PLANNED')drone.position.y=reference?.stayAtDockUntilTelemetry?home.y:groundHeight;
    const finished=['COMPLETED','CANCELLED','FAILED'].includes(data.status);
    spinning=data.status==='IN_PROGRESS'&&!finished;
    if(terminal&&data.status==='IN_PROGRESS')terminal=false;
    if(modeChanged)redraw();
    if(terminal)return;
    const packet=data.telemetry;
    if(packet&&packet.missionId===id&&packet.position&&data.status!=='PLANNED'){
      const position=project(packet.position),time=Date.parse(packet.timestamp);
      if(position&&Number.isFinite(time)&&(!last||time>last.time)){
        const delta=last?position.clone().sub(new T.Vector3().fromArray(last.position)):new T.Vector3();
        const heading=Number.isFinite(packet.velocity?.headingDegree)?T.MathUtils.degToRad(-packet.velocity!.headingDegree+northRotation):delta.x*delta.x+delta.z*delta.z>.04?Math.atan2(-delta.x,-delta.z):last?.heading??drone.rotation.y;
from.copy(drone.position);target.copy(position);fromRotation.copy(drone.quaternion);targetRotation.setFromEuler(new T.Euler(0,heading,0));start=performance.now();duration=last?T.MathUtils.clamp(time-last.time,80,650):150;
        last={position:position.toArray(),heading,time};
        const previousGuide=guideProgress;advanceGuide(position);
        if(!trail.length||position.distanceToSquared(new T.Vector3().fromArray(trail[trail.length-1]))>=.0625){trail.push(position.toArray());if(trail.length>MAX_POINTS)trail=trail.filter((_,i)=>i===0||i%2===1||i===trail.length-1);if(mode==='real')redraw();}
        if(mode==='guide'&&guideProgress!==previousGuide)redraw();
        save();
      }
    }
    if(finished){terminal=true;if(last){drone.position.fromArray(last.position);drone.rotation.y=last.heading;if(!trail.length||!new T.Vector3().fromArray(trail[trail.length-1]).equals(drone.position)){trail.push(drone.position.toArray());if(mode==='real')redraw();}duration=0;save();}
      if(data.status==='COMPLETED'&&guideRoute.length&&guideProgress<guideRoute.length-1){guideProgress=guideRoute.length-1;if(mode==='guide')redraw();save();}}
  }
  return {update,setFollowing(value:boolean){following=value;},getDronePosition(){return drone.position.clone();},animate(now=performance.now()){
    const dt=Math.min(.1,(now-previousFrame)/1000);previousFrame=now;
    if(spinning&&!terminal)propellers.forEach((propeller,i)=>{propeller.rotation.y=(propeller.rotation.y+dt*90*(i%2?1:-1))%(Math.PI*2);});
    if(duration){const t=Math.min(1,(now-start)/duration);drone.position.lerpVectors(from,target,t);drone.quaternion.slerpQuaternions(fromRotation,targetRotation,t);if(t===1)duration=0;}
    if(following){const movement=drone.position.clone().sub(controls.target).multiplyScalar(1-Math.exp(-dt*5));controls.target.add(movement);camera.position.add(movement);}
  },destroy(){save();planned.geometry.dispose();actual.geometry.dispose();plannedMaterial.dispose();actualMaterial.dispose();planned.removeFromParent();actual.removeFromParent();}};
}
