// Offline seed generation only. This module is not imported by the application.
import * as T from 'three';
import catalog from '../../data/bragado-assets.json';
import { buildPlant } from './geometry.js';
import { addMissionDrone } from './drone';
import { createEnvironment } from './environment';
import { plantGeoreference, toPlantPosition } from './georeference';

const CLEARANCE=1.1;
const numbers={G1:10,G2:11,G3:9,M1:5,M3:6,M2:3,M4:4,M5:2,M6:1,M7:8,M8:7};
export function generateInspectionPlans(assetCodes?:string[]) {
  const scene=new T.Scene();
  const tubes=[10,11,9,5,3,6,4,2,1,8,7,'F1','F2','F3'].map((to,index)=>({id:`tube-${index}`,from:'',to:String(to),noria:index<7?1:2}));
  const captured:{box:T.Box3;matrix:T.Matrix4;radius?:number}[]=[];
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
    return {box,broad:box.clone().applyMatrix4(v.matrix),inverse:v.matrix.clone().invert(),radius:v.radius===undefined?undefined:v.radius+CLEARANCE/Math.min(scale.x,scale.y,scale.z)};
  });
  const bounds=volumes.map(v=>v.broad);
  const buckets=new Map<string,Set<number>>(),bucketSize=6;
  volumes.forEach((v,i)=>{for(let x=Math.floor(v.broad.min.x/bucketSize);x<=Math.floor(v.broad.max.x/bucketSize);x++)for(let z=Math.floor(v.broad.min.z/bucketSize);z<=Math.floor(v.broad.max.z/bucketSize);z++){const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,new Set());buckets.get(key)!.add(i);}});
  function nearby(a:T.Vector3,b=a){const found=new Set<number>();for(let x=Math.floor(Math.min(a.x,b.x)/bucketSize);x<=Math.floor(Math.max(a.x,b.x)/bucketSize);x++)for(let z=Math.floor(Math.min(a.z,b.z)/bucketSize);z<=Math.floor(Math.max(a.z,b.z)/bucketSize);z++)for(const i of buckets.get(`${x},${z}`)??[])if(volumes[i].broad.max.y>=Math.min(a.y,b.y)&&volumes[i].broad.min.y<=Math.max(a.y,b.y))found.add(i);return [...found].map(i=>volumes[i]);}
  const dock=addMissionDrone(scene);scene.updateMatrixWorld(true);
  const home=dock.getObjectByName('Reference quadcopter')!.getWorldPosition(new T.Vector3());
  const cruise=Math.ceil(Math.max(...bounds.map(b=>b.max.y))+4);
  const ray=new T.Ray(),direction=new T.Vector3(),hit=new T.Vector3();
  const free=(p:T.Vector3)=>!nearby(p).some(v=>{
    const local=p.clone().applyMatrix4(v.inverse);
    return v.broad.containsPoint(p)&&v.box.containsPoint(local)&&(v.radius===undefined||Math.hypot(local.x,local.z)<=v.radius);
  });
  const clear=(a:T.Vector3,b:T.Vector3)=>{
    const distance=a.distanceTo(b);ray.set(a,direction.copy(b).sub(a).normalize());
    return !nearby(a,b).some(v=>{
      ray.set(a,direction.copy(b).sub(a).normalize());
      if(!v.broad.containsPoint(a)&&!v.broad.containsPoint(b)&&!(ray.intersectBox(v.broad,hit)!==null&&hit.distanceTo(a)<=distance))return false;
      const localA=a.clone().applyMatrix4(v.inverse),localB=b.clone().applyMatrix4(v.inverse);
      if(v.radius!==undefined){
        const delta=localB.clone().sub(localA);
        let lo=0,hi=1;
        if(Math.abs(delta.y)<1e-9){if(localA.y<v.box.min.y||localA.y>v.box.max.y)return false;}
        else {const t1=(v.box.min.y-localA.y)/delta.y,t2=(v.box.max.y-localA.y)/delta.y;lo=Math.max(0,Math.min(t1,t2));hi=Math.min(1,Math.max(t1,t2));if(lo>hi)return false;}
        const norm=delta.x*delta.x+delta.z*delta.z;
        const t=norm?T.MathUtils.clamp(-(localA.x*delta.x+localA.z*delta.z)/norm,lo,hi):lo;
        return Math.hypot(localA.x+delta.x*t,localA.z+delta.z*t)<=v.radius;
      }
      ray.set(localA,direction.copy(localB).sub(localA).normalize());
      return v.box.containsPoint(localA)||v.box.containsPoint(localB)||(ray.intersectBox(v.box,hit)!==null&&hit.distanceTo(localA)<=localA.distanceTo(localB));
    });
  };
  type Point={position:T.Vector3;photo:boolean;target:T.Vector3};
  const reports:{code:string;levels:{height:number;accepted:number;omitted:number}[];segments:number}[]=[];
  const plans=catalog.filter(a=>['SILO','SILO_FLOTANTE','CELDA'].includes(a.type)&&(!assetCodes||assetCodes.includes(a.code))).map(asset=>{
    const points:Point[]=[{position:home.clone(),photo:false,target:home.clone()}];
    const add=(p:T.Vector3,photo=false,target=p)=>{if(points[points.length-1].position.distanceTo(p)<.001&&!photo)return;points.push({position:p.clone(),photo,target:target.clone()});};
    const report={code:asset.code,levels:[] as {height:number;accepted:number;omitted:number}[],segments:0};
    const heights=asset.r?[asset.h*.8,Math.max(asset.type==='SILO_FLOTANTE'?4.5:3,asset.h*.4)]:[17,9];
    const transitFloor=(asset.r?asset.h+asset.r*.3:17)+2+plantGeoreference.groundHeight;
    for(const rawHeight of heights){
      let y=0,valid:T.Vector3[]|undefined;
      for(let attempt=0;attempt<(asset.r?7:1);attempt++){
      y=Number((rawHeight+attempt*asset.h*.05).toFixed(2))+plantGeoreference.groundHeight;
      if((asset.r&&y>asset.h*.95+plantGeoreference.groundHeight)||(report.levels.length&&y>=report.levels[0].height-.5))break;
      const candidates:T.Vector3[]=[];
      if(asset.r){for(let i=0;i<36;i++){const angle=(i+.5)*Math.PI/18;candidates.push(new T.Vector3(asset.x+Math.cos(angle)*(asset.r+1.55),y,asset.z+Math.sin(angle)*(asset.r+1.55)));}}
      else {
        const halfX=27/2+3,halfZ=43/2+3;
        for(const [sx,sz,offset] of [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,Math.PI*1.5]])for(let i=0;i<3;i++){
          const angle=offset+i*Math.PI/4,r=2;
          const x=sx*(halfX-r)+r*Math.cos(angle),z=sz*(halfZ-r)+r*Math.sin(angle);
          candidates.push(new T.Vector3(asset.x+(x+z)/Math.sqrt(2),y,asset.z+(-x+z)/Math.sqrt(2)));
        }
      }
      // Choose a closed collision-free contour, never omit blocked sides or hop over them.
      const choices=candidates.map(p=>{
        const outward=new T.Vector3(p.x-asset.x,0,p.z-asset.z).normalize();
        return Array.from({length:51},(_,i)=>p.clone().addScaledVector(outward,i<36?i*.1:3.5+(i-35)*.5)).filter(free);
      });
      let bestCost=Infinity;
      const edgeCache=new Map<string,boolean>();
      const ids=new Map(choices.flat().map((p,i)=>[p,i]));
      const edgeClear=(a:T.Vector3,b:T.Vector3)=>{
        const key=`${ids.get(a)},${ids.get(b)}`;
        if(!edgeCache.has(key))edgeCache.set(key,clear(a,b));
        return edgeCache.get(key)!;
      };
      for(const start of choices[0]){
        let paths=[{path:[start],cost:0}];
        for(let i=1;i<choices.length&&paths.length;i++){
          const next:typeof paths=[];
          for(const p of choices[i]){
            let best:typeof paths[number]|undefined;
            for(const previous of paths){
              const last=previous.path[previous.path.length-1];
              const cost=previous.cost+last.distanceTo(p)+p.distanceTo(candidates[i])*.1;
              if((!best||cost<best.cost)&&edgeClear(last,p))best={path:[...previous.path,p],cost};
            }
            if(best)next.push(best);
          }
          paths=next;
        }
        for(const p of paths){const last=p.path[p.path.length-1],cost=p.cost+last.distanceTo(start);
          if(p.path.length===candidates.length&&cost<bestCost&&edgeClear(last,start)){bestCost=cost;valid=p.path;}
        }
      }
      if(valid)break;
      }
      if(!valid)throw Error(`${asset.code}: no complete perimeter in inspection band`);
      const winding=valid.reduce((sum,p,i)=>{
        const next=valid![(i+1)%valid!.length],ax=p.x-asset.x,az=p.z-asset.z,bx=next.x-asset.x,bz=next.z-asset.z;
        return sum+Math.atan2(ax*bz-az*bx,ax*bx+az*bz);
      },0);
      if(Math.abs(Math.abs(winding)-Math.PI*2)>1e-6)throw Error(`${asset.code}: incomplete perimeter winding`);
      report.levels.push({height:y,accepted:valid.length,omitted:0});
      const last=points[points.length-1].position;
      // Enter from above; between inspection levels only descend, at one clear column.
      let entry=-1,entryHeight=last.y,entryDistance=Infinity;
      for(let i=0;i<valid.length;i++){
        const p=valid[i];
        for(let height=points.length===1?Math.ceil(transitFloor):last.y;height<=cruise;height+=1){
          if(points.length>1&&height>last.y+.001)break;
          const above=new T.Vector3(p.x,height,p.z),origin=new T.Vector3(last.x,height,last.z);
          if(clear(last,origin)&&clear(origin,above)&&clear(above,p)&&clear(p,new T.Vector3(p.x,cruise,p.z))){
            const distance=last.distanceTo(origin)+origin.distanceTo(above)+above.distanceTo(p);
            if(distance<entryDistance){entry=i;entryHeight=height;entryDistance=distance;}break;
          }
        }
      }
      if(entry<0)throw Error(`${asset.code}: no vertical entry at ${y}m`);
      valid=[...valid.slice(entry),...valid.slice(0,entry)];
      const first=valid[0];
      move(new T.Vector3(last.x,entryHeight,last.z));
      move(new T.Vector3(first.x,entryHeight,first.z));move(first);
      const target=new T.Vector3(asset.x,Math.min(asset.h,y),asset.z);
      const photoIndices=new Set(Array.from({length:Math.min(4,valid.length)},(_,i)=>Math.floor(i*valid.length/Math.min(4,valid.length))));
      for(const [index,p] of valid.entries()){
        move(p);
        if(photoIndices.has(index)){const last=points[points.length-1];last.photo=true;last.target.copy(target);}
      }
      move(first);
    }
    const last=points[points.length-1].position;
    let returnHeight=NaN;
    for(let height=Math.ceil(transitFloor);height<=cruise;height++){
      const above=new T.Vector3(last.x,height,last.z),base=new T.Vector3(home.x,height,home.z);
      if(clear(last,above)&&clear(above,base)&&clear(base,home)){returnHeight=height;break;}
    }
    if(!Number.isFinite(returnHeight))throw Error(`${asset.code}: no clear return column`);
    move(new T.Vector3(last.x,returnHeight,last.z));
    move(new T.Vector3(home.x,returnHeight,home.z));move(home);
    if(points.length>85||points.filter(p=>p.photo).length>10)throw Error(`${asset.code}: mission budget exceeded (${points.length})`);
    for(let i=1;i<points.length;i++){
      const d=points[i].position.clone().sub(points[i-1].position);
      if(Math.abs(d.y)>1e-6&&Math.hypot(d.x,d.z)>1e-6)throw Error('Non-vertical altitude change');
    }
    for(let i=1;i<points.length;i++)if(!clear(points[i-1].position,points[i].position))throw Error(`${asset.code}: blocked segment ${i}`);
    // MAVSDK consumes TAKEOFF as a destination, not a ground marker. Its altitude
    // must be the climb target (see flight-controller/docs/INTERFAZ_MQTT.md).
    // Remove the ground marker instead of duplicating the first aerial waypoint.
    points.shift();
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
      if(clear(last,p)){add(p);return;}
      throw Error(`${asset.code}: blocked perimeter segment`);
    }
  });
  return {plans,reports,clearance:CLEARANCE,cruise,home:home.toArray(),bounds:bounds.length};
}
