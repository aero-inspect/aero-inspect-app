import * as T from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TelemetryUpdate } from '../../types/telemetry';
import { toPlantPosition, plantGeoreference } from './georeference';

export type MissionRoutePoint={latitude:number;longitude:number;altitude:number;sequence:number;droneDegree?:number};
export type MissionPlaybackData={id:string;status:string;points:MissionRoutePoint[];telemetry:TelemetryUpdate|null};
type Sample={position:number[];heading:number;time:number};
const MAX_POINTS=4096;
export function createMissionPlayback(scene:T.Scene,dock:T.Group,camera:T.PerspectiveCamera,controls:OrbitControls){
  const drone=dock.getObjectByName('Reference quadcopter')!;
  const propellers:T.Object3D[]=[];
  drone.traverse(part=>{if(part.name==='Two-blade propeller')propellers.push(part);});
  let spinning=false;
  dock.updateMatrixWorld(true);scene.attach(drone);
  const plannedMaterial=new T.LineBasicMaterial({color:'#52cee6',transparent:true,opacity:.5,depthWrite:false,toneMapped:false});
  const actualMaterial=new T.LineBasicMaterial({color:'#258aff',toneMapped:false});
  const planned=new T.Line(new T.BufferGeometry(),plannedMaterial),actual=new T.Line(new T.BufferGeometry(),actualMaterial);scene.add(planned,actual);
  let id='',last:Sample|null=null,trail:number[][]=[],routeKey='',terminal=false,following=false;
  let start=0,duration=0,from=drone.position.clone(),target=from.clone(),fromRotation=drone.quaternion.clone(),targetRotation=fromRotation.clone();
  let previousFrame=performance.now();
  function redraw(){actual.geometry.dispose();actual.geometry=new T.BufferGeometry().setFromPoints(trail.map(p=>new T.Vector3(...p as [number,number,number])));}
  function save(){if(!id)return;try{sessionStorage.setItem('aeroinspect.mission-trail.'+id,JSON.stringify({last,trail}));}catch{/* Rendering remains available when storage is full. */}}
  function update(data:MissionPlaybackData){
    if(data.id!==id){save();id=data.id;last=null;trail=[];routeKey='';terminal=false;following=false;drone.position.set(-72,.113,-65);drone.quaternion.identity();
      try{const saved=JSON.parse(sessionStorage.getItem('aeroinspect.mission-trail.'+id)||'null');if(saved&&Array.isArray(saved.trail)&&saved.trail.every((p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))&&saved.last&&Number.isFinite(saved.last.time)&&Number.isFinite(saved.last.heading)&&Array.isArray(saved.last.position)&&saved.last.position.length===3&&saved.last.position.every(Number.isFinite)){trail=saved.trail.slice(-MAX_POINTS);last=saved.last;drone.position.fromArray(last!.position);drone.rotation.y=last!.heading;}}catch{/* Ignore invalid saved visualization data. */}redraw();duration=0;
    }
    const points=[...data.points].sort((a,b)=>a.sequence-b.sequence),key=JSON.stringify(points);
    if(key!==routeKey){routeKey=key;const positions=points.map(toPlantPosition).filter((p):p is T.Vector3=>p!==null);planned.geometry.dispose();planned.geometry=new T.BufferGeometry().setFromPoints(positions);if(!last&&positions.length){drone.position.copy(positions[0]);drone.rotation.y=T.MathUtils.degToRad(-(points[0].droneDegree??0)+plantGeoreference.northRotationDegrees);} }
    const finished=['COMPLETED','CANCELLED','FAILED'].includes(data.status);
    spinning=data.status==='IN_PROGRESS'&&!finished;
    if(terminal)return;
    const packet=data.telemetry;
    if(packet&&packet.missionId===id&&packet.position&&data.status!=='PLANNED'){
      const position=toPlantPosition(packet.position),time=Date.parse(packet.timestamp);
      if(position&&Number.isFinite(time)&&(!last||time>last.time)){
        const delta=last?position.clone().sub(new T.Vector3().fromArray(last.position)):new T.Vector3();
        const heading=Number.isFinite(packet.velocity?.headingDegree)?T.MathUtils.degToRad(-packet.velocity!.headingDegree+plantGeoreference.northRotationDegrees):delta.x*delta.x+delta.z*delta.z>.04?Math.atan2(-delta.x,-delta.z):last?.heading??drone.rotation.y;
from.copy(drone.position);target.copy(position);fromRotation.copy(drone.quaternion);targetRotation.setFromEuler(new T.Euler(0,heading,0));start=performance.now();duration=last?T.MathUtils.clamp(time-last.time,80,650):150;
        last={position:position.toArray(),heading,time};
        if(!trail.length||position.distanceToSquared(new T.Vector3().fromArray(trail[trail.length-1]))>=.0625){trail.push(position.toArray());if(trail.length>MAX_POINTS)trail=trail.filter((_,i)=>i===0||i%2===1||i===trail.length-1);redraw();}
        save();
      }
    }
    if(finished){terminal=true;if(last){drone.position.fromArray(last.position);drone.rotation.y=last.heading;if(!trail.length||!new T.Vector3().fromArray(trail[trail.length-1]).equals(drone.position)){trail.push(drone.position.toArray());redraw();}duration=0;save();}}
  }
  return {update,setFollowing(value:boolean){following=value;},animate(now=performance.now()){
    const dt=Math.min(.1,(now-previousFrame)/1000);previousFrame=now;
    if(spinning&&!terminal)propellers.forEach((propeller,i)=>{propeller.rotation.y=(propeller.rotation.y+dt*90*(i%2?1:-1))%(Math.PI*2);});
    if(duration){const t=Math.min(1,(now-start)/duration);drone.position.lerpVectors(from,target,t);drone.quaternion.slerpQuaternions(fromRotation,targetRotation,t);if(t===1)duration=0;}
    if(following){const movement=drone.position.clone().sub(controls.target).multiplyScalar(1-Math.exp(-dt*5));controls.target.add(movement);camera.position.add(movement);}
  },destroy(){save();planned.geometry.dispose();actual.geometry.dispose();plannedMaterial.dispose();actualMaterial.dispose();planned.removeFromParent();actual.removeFromParent();}};
}
