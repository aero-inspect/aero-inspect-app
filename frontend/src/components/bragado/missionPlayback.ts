import * as T from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TelemetryUpdate } from '../../types/telemetry';
import { toPlantPosition, plantGeoreference, type GeographicPosition } from './georeference';

export type MissionRoutePoint={latitude:number;longitude:number;altitude:number;sequence:number;droneDegree?:number};
export type MissionPlaybackData={id:string;status:string;points:MissionRoutePoint[];telemetry:TelemetryUpdate|null};
type Sample={position:number[];heading:number;time:number};
export type PlaybackGeoreference={toPosition:(point:GeographicPosition)=>T.Vector3|null;northRotationDegrees:number;groundHeight:number;storagePrefix:string;stayAtDockUntilTelemetry?:boolean};
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
  const passedMaterial=new T.LineBasicMaterial({color:'#258aff',toneMapped:false});
  const planned=new T.Line(new T.BufferGeometry(),plannedMaterial),passed=new T.Line(new T.BufferGeometry(),passedMaterial);scene.add(planned,passed);
  planned.name='Planned mission route';passed.name='Passed part of the planned route';
  // El tramo recorrido sigue la ruta planificada, no la posición real del dron: progress es el índice
  // fraccionario sobre la ruta (segmento + fracción) y sólo avanza.
  let route:{position:T.Vector3;sequence:number}[]=[],progress=0;
  let id='',last:Sample|null=null,routeKey='',terminal=false,following=false;
  let start=0,duration=0,from=drone.position.clone(),target=from.clone(),fromRotation=drone.quaternion.clone(),targetRotation=fromRotation.clone();
  let previousFrame=performance.now();
  function redraw(){
    const whole=Math.min(Math.floor(progress),Math.max(route.length-1,0)),positions=route.slice(0,whole+1).map(p=>p.position);
    if(whole<route.length-1&&progress>whole)positions.push(route[whole].position.clone().lerp(route[whole+1].position,progress-whole));
    passed.geometry.dispose();passed.geometry=new T.BufferGeometry().setFromPoints(positions.length>1?positions:[]);
  }
  function advance(position:T.Vector3,currentWaypoint:number|null|undefined){
    if(route.length<2)return;
    const heading=currentWaypoint==null?-1:route.findIndex(p=>p.sequence===currentWaypoint);
    // Con waypoint actual conocido, el dron va por el segmento que termina en él; si no, se busca el más cercano cerca del avance.
    const first=heading>0?heading-1:Math.floor(progress),end=heading>0?heading-1:Math.min(route.length-2,Math.floor(progress)+3);
    if(heading===0)return;
    let best=progress,bestDistance=Infinity;
    for(let i=first;i<=end;i++){
      const a=route[i].position,ab=route[i+1].position.clone().sub(a),lengthSq=ab.lengthSq();
      const t=lengthSq>0?T.MathUtils.clamp(position.clone().sub(a).dot(ab)/lengthSq,0,1):0;
      const distance=a.clone().addScaledVector(ab,t).distanceToSquared(position);
      if(distance<bestDistance){bestDistance=distance;best=i+t;}
    }
    if(best>progress){progress=best;redraw();}
  }
  function save(){if(!id)return;try{sessionStorage.setItem(storagePrefix+id,JSON.stringify({last,progress}));}catch{/* Rendering remains available when storage is full. */}}
  function update(data:MissionPlaybackData){
    if(data.id!==id){save();id=data.id;last=null;progress=0;routeKey='';terminal=false;following=false;drone.position.copy(home);drone.quaternion.identity();
      try{const saved=JSON.parse(sessionStorage.getItem(storagePrefix+id)||'null');if(saved&&saved.last&&Number.isFinite(saved.last.time)&&Number.isFinite(saved.last.heading)&&Array.isArray(saved.last.position)&&saved.last.position.length===3&&saved.last.position.every(Number.isFinite)){last=saved.last;if(Number.isFinite(saved.progress)&&saved.progress>0)progress=saved.progress;drone.position.fromArray(last!.position);drone.rotation.y=last!.heading;}}catch{/* Ignore invalid saved visualization data. */}redraw();duration=0;
    }
    const points=[...data.points].sort((a,b)=>a.sequence-b.sequence),key=JSON.stringify(points);
    if(key!==routeKey){routeKey=key;route=points.map(point=>({position:project(point),sequence:point.sequence})).filter((p):p is {position:T.Vector3;sequence:number}=>p.position!==null);const positions=route.map(p=>p.position);planned.geometry.dispose();planned.geometry=new T.BufferGeometry().setFromPoints(positions);redraw();if(!last&&positions.length&&!reference?.stayAtDockUntilTelemetry){drone.position.copy(positions[0]);drone.rotation.y=T.MathUtils.degToRad(-(points[0].droneDegree??0)+northRotation);} }
    if(!last&&data.status==='PLANNED')drone.position.y=reference?.stayAtDockUntilTelemetry?home.y:groundHeight;
    const finished=['COMPLETED','CANCELLED','FAILED'].includes(data.status);
    spinning=data.status==='IN_PROGRESS'&&!finished;
    if(terminal&&data.status==='IN_PROGRESS')terminal=false;
    if(terminal)return;
    const packet=data.telemetry;
    if(packet&&packet.missionId===id&&packet.position&&data.status!=='PLANNED'){
      const position=project(packet.position),time=Date.parse(packet.timestamp);
      if(position&&Number.isFinite(time)&&(!last||time>last.time)){
        const delta=last?position.clone().sub(new T.Vector3().fromArray(last.position)):new T.Vector3();
        const heading=Number.isFinite(packet.velocity?.headingDegree)?T.MathUtils.degToRad(-packet.velocity!.headingDegree+northRotation):delta.x*delta.x+delta.z*delta.z>.04?Math.atan2(-delta.x,-delta.z):last?.heading??drone.rotation.y;
from.copy(drone.position);target.copy(position);fromRotation.copy(drone.quaternion);targetRotation.setFromEuler(new T.Euler(0,heading,0));start=performance.now();duration=last?T.MathUtils.clamp(time-last.time,80,650):150;
        last={position:position.toArray(),heading,time};
        advance(position,packet.currentWaypoint);
        save();
      }
    }
    if(finished){terminal=true;if(data.status==='COMPLETED'&&route.length>1){progress=route.length-1;redraw();}if(last){drone.position.fromArray(last.position);drone.rotation.y=last.heading;duration=0;}save();}
  }
  return {update,setFollowing(value:boolean){following=value;},getDronePosition(){return drone.position.clone();},animate(now=performance.now()){
    const dt=Math.min(.1,(now-previousFrame)/1000);previousFrame=now;
    if(spinning&&!terminal)propellers.forEach((propeller,i)=>{propeller.rotation.y=(propeller.rotation.y+dt*90*(i%2?1:-1))%(Math.PI*2);});
    if(duration){const t=Math.min(1,(now-start)/duration);drone.position.lerpVectors(from,target,t);drone.quaternion.slerpQuaternions(fromRotation,targetRotation,t);if(t===1)duration=0;}
    if(following){const movement=drone.position.clone().sub(controls.target).multiplyScalar(1-Math.exp(-dt*5));controls.target.add(movement);camera.position.add(movement);}
  },destroy(){save();planned.geometry.dispose();passed.geometry.dispose();plannedMaterial.dispose();passedMaterial.dispose();planned.removeFromParent();passed.removeFromParent();}};
}
