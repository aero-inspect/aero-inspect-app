// Offline seed generation only. This module is not imported by the application.
import * as T from 'three';
import catalog from '../../data/bragado-assets.json';
import { buildPlant } from './geometry.js';
import { addMissionDrone } from './drone';
import { createEnvironment } from './environment';
import { plantGeoreference, toPlantPosition } from './georeference';

const CLEARANCE=0.9;
const numbers={G1:10,G2:11,G3:9,M1:5,M3:6,M2:3,M4:4,M5:2,M6:1,M7:8,M8:7};
export function generateInspectionPlans() {
  const scene=new T.Scene();
  const tubes=[10,11,9,5,3,6,4,2,1,8,7,'F1','F2','F3'].map((to,index)=>({id:`tube-${index}`,from:'',to:String(to),noria:index<7?1:2}));
  const captured:{box:T.Box3;matrix:T.Matrix4}[]=[];
  buildPlant(scene,1,numbers,tubes,captured);
  const renderer=new T.WebGLRenderer(),environment=createEnvironment(scene,renderer,1);
  scene.updateMatrixWorld(true);
  scene.getObjectByName('Shared plant environment')!.traverse(o=>{
    if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial){
      o.geometry.computeBoundingBox();captured.push({box:o.geometry.boundingBox!.clone(),matrix:o.matrixWorld.clone()});
    }
  });
  environment.destroy();renderer.dispose();
  const volumes=captured.filter(v=>v.box.clone().applyMatrix4(v.matrix).max.y>0.3).map(v=>{
    const scale=new T.Vector3().setFromMatrixScale(v.matrix);
    const box=v.box.clone().expandByScalar(CLEARANCE/Math.min(scale.x,scale.y,scale.z));
    return {box,broad:box.clone().applyMatrix4(v.matrix),inverse:v.matrix.clone().invert()};
  });
  const bounds=volumes.map(v=>v.broad);
  const buckets=new Map<string,Set<number>>(),bucketSize=6;
  volumes.forEach((v,i)=>{for(let x=Math.floor(v.broad.min.x/bucketSize);x<=Math.floor(v.broad.max.x/bucketSize);x++)for(let z=Math.floor(v.broad.min.z/bucketSize);z<=Math.floor(v.broad.max.z/bucketSize);z++){const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,new Set());buckets.get(key)!.add(i);}});
  function nearby(a:T.Vector3,b=a){const found=new Set<number>();for(let x=Math.floor(Math.min(a.x,b.x)/bucketSize);x<=Math.floor(Math.max(a.x,b.x)/bucketSize);x++)for(let z=Math.floor(Math.min(a.z,b.z)/bucketSize);z<=Math.floor(Math.max(a.z,b.z)/bucketSize);z++)for(const i of buckets.get(`${x},${z}`)??[])if(volumes[i].broad.max.y>=Math.min(a.y,b.y)&&volumes[i].broad.min.y<=Math.max(a.y,b.y))found.add(i);return [...found].map(i=>volumes[i]);}
  const dock=addMissionDrone(scene);scene.updateMatrixWorld(true);
  const home=dock.getObjectByName('Reference quadcopter')!.getWorldPosition(new T.Vector3());
  const cruise=Math.ceil(Math.max(...bounds.map(b=>b.max.y))+4);
  const ray=new T.Ray(),direction=new T.Vector3(),hit=new T.Vector3();
  const free=(p:T.Vector3)=>!nearby(p).some(v=>v.broad.containsPoint(p)&&v.box.containsPoint(p.clone().applyMatrix4(v.inverse)));
  const clear=(a:T.Vector3,b:T.Vector3)=>{
    const distance=a.distanceTo(b);ray.set(a,direction.copy(b).sub(a).normalize());
    return !nearby(a,b).some(v=>{
      ray.set(a,direction.copy(b).sub(a).normalize());
      if(!v.broad.containsPoint(a)&&!v.broad.containsPoint(b)&&!(ray.intersectBox(v.broad,hit)!==null&&hit.distanceTo(a)<=distance))return false;
      const localA=a.clone().applyMatrix4(v.inverse),localB=b.clone().applyMatrix4(v.inverse);
      ray.set(localA,direction.copy(localB).sub(localA).normalize());
      return v.box.containsPoint(localA)||v.box.containsPoint(localB)||(ray.intersectBox(v.box,hit)!==null&&hit.distanceTo(localA)<=localA.distanceTo(localB));
    });
  };
  type Point={position:T.Vector3;photo:boolean;target:T.Vector3};
  const reports:{code:string;levels:{height:number;accepted:number;omitted:number}[];segments:number}[]=[];
  const plans=catalog.filter(a=>['SILO','SILO_FLOTANTE','CELDA'].includes(a.type)).map(asset=>{
    const points:Point[]=[{position:home.clone(),photo:false,target:home.clone()}];
    const add=(p:T.Vector3,photo=false,target=p)=>{if(points[points.length-1].position.distanceTo(p)<.001&&!photo)return;points.push({position:p.clone(),photo,target:target.clone()});};
    add(new T.Vector3(home.x,cruise,home.z));
    const report={code:asset.code,levels:[] as {height:number;accepted:number;omitted:number}[],segments:0};
    const heights=asset.r?[asset.h*.65,asset.h+asset.r*.3+3]:[9,18];
    for(const rawHeight of heights){const y=Number(rawHeight.toFixed(2))+plantGeoreference.groundHeight;
      const candidates:T.Vector3[]=[];
      if(asset.r){for(const [dx,dz] of [[1,1],[-1,1],[-1,-1],[1,-1]]) candidates.push(new T.Vector3(asset.x+dx*(asset.r+2.6),y,asset.z+dz*(asset.r+2.6)));}
      else {
        const halfX=27/2+3,halfZ=43/2+3;
        for(const [sx,sz] of [[1,1],[-1,1],[-1,-1],[1,-1]]){
          const x=sx*halfX,z=sz*halfZ;
          candidates.push(new T.Vector3(asset.x+(x+z)/Math.sqrt(2),y,asset.z+(-x+z)/Math.sqrt(2)));
        }
      }
      const valid=candidates.filter(p=>free(p)&&clear(p,new T.Vector3(p.x,cruise,p.z)));
      report.levels.push({height:y,accepted:valid.length,omitted:candidates.length-valid.length});
      if(!valid.length)continue;
      const first=valid[0],highFirst=new T.Vector3(first.x,cruise,first.z);
      move(highFirst);move(first);
      const target=new T.Vector3(asset.x,Math.min(asset.h,y),asset.z);
      for(const p of valid){
        move(p);
        const last=points[points.length-1];last.photo=true;last.target.copy(target);
      }
      const last=points[points.length-1].position;
      move(new T.Vector3(last.x,cruise,last.z));
    }
    // Two roof observations complete the bounded photo set.
    if(asset.r){
      for(const dx of [-1,1]){
        move(new T.Vector3(asset.x+dx*asset.r*.5,cruise,asset.z));
        const last=points[points.length-1];last.photo=true;last.target.set(asset.x,asset.h+asset.r*.3,asset.z);
      }
    } else {
      for(const along of [-12,12]){
        const x=asset.x+along/Math.sqrt(2),z=asset.z+along/Math.sqrt(2);
        move(new T.Vector3(x,cruise,z));
        const last=points[points.length-1];last.photo=true;last.target.set(x,14,z);
      }
    }
    move(new T.Vector3(home.x,cruise,home.z));move(home);
    if(points.length>50||points.filter(p=>p.photo).length>10)throw Error(`${asset.code}: mission budget exceeded (${points.length})`);
    for(let i=1;i<points.length;i++){
      const d=points[i].position.clone().sub(points[i-1].position);
      if([d.x,d.y,d.z].filter(v=>Math.abs(v)>1e-6).length>1)throw Error('Non-orthogonal segment');
    }
    for(let i=1;i<points.length;i++)if(!clear(points[i-1].position,points[i].position))throw Error(`${asset.code}: blocked segment ${i}`);
    // MAVSDK consumes TAKEOFF as a destination, not a ground marker. Its altitude
    // must be the climb target (see flight-controller/docs/INTERFAZ_MQTT.md).
    // Keep sequence/photography IDs stable; the next point is the same climb target.
    points[0].position.copy(points[1].position);
    const g=plantGeoreference,rotation=T.MathUtils.degToRad(g.northRotationDegrees);
    const route=points.map((p,sequence)=>{
      const x=(p.position.x-g.x)/g.metresToUnits,z=(p.position.z-g.z)/g.metresToUnits;
      const latitude=g.latitude-(x*Math.sin(-rotation)+z*Math.cos(-rotation))/(111320*g.southSign);
      const longitude=g.longitude+(x*Math.cos(-rotation)-z*Math.sin(-rotation))/(111320*Math.cos(T.MathUtils.degToRad(g.latitude))*g.eastSign);
      const altitude=(p.position.y-g.groundHeight)/g.metresToUnits;
      const target=p.photo?p.target:points[Math.min(sequence+1,points.length-1)].position,delta=target.clone().sub(p.position);
      const heading=(T.MathUtils.radToDeg(Math.atan2(delta.x,-delta.z))+360)%360;
      return {latitude,longitude,altitude,sequence,action:sequence===0?'TAKEOFF':sequence===points.length-1?'LAND':p.photo?'STOP':'NAVIGATE',pointOfInterest:p.photo,stopSeconds:p.photo?3:0,droneDegree:heading,pitch:T.MathUtils.clamp(T.MathUtils.radToDeg(Math.atan2(delta.y,Math.hypot(delta.x,delta.z))),-90,30)};
    });
    if(route[0].action!=='TAKEOFF'||route[0].altitude<=0)throw Error('TAKEOFF requires a positive relative altitude');
    // Validate the actual serialized GPS round trip, not only the source model positions.
    route.forEach((p,i)=>{const converted=toPlantPosition(p)!;if(converted.distanceTo(points[i].position)>1e-6)throw Error('Georeference round-trip mismatch');if(i&&!clear(toPlantPosition(route[i-1])!,converted))throw Error('GPS segment collision');});
    report.segments=route.length-1;reports.push(report);return {code:asset.code,type:asset.type,route};
    function move(p:T.Vector3){
      const last=points[points.length-1].position;
      if(last.distanceTo(p)<.001)return;
      if(Math.abs(last.y-p.y)>.001){
        if(last.x!==p.x||last.z!==p.z||!clear(last,p))throw Error('Blocked vertical ascent');
        add(p);return;
      }
      for(const corner of [new T.Vector3(p.x,last.y,last.z),new T.Vector3(last.x,last.y,p.z)]){
        if(clear(last,corner)&&clear(corner,p)){add(corner);add(p);return;}
      }
      if(last.y===cruise)throw Error('Blocked cruise corridor');
      move(new T.Vector3(last.x,cruise,last.z));
      move(new T.Vector3(p.x,cruise,p.z));move(p);
    }
  });
  return {plans,reports,clearance:CLEARANCE,cruise,home:home.toArray(),bounds:bounds.length};
}
