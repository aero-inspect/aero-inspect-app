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
  // Conservative horizontal corridors: never connect a blocked chord around a structure.
  function travel(a:T.Vector3,b:T.Vector3):T.Vector3[] {
    if(Math.abs(a.y-b.y)>.001)throw Error('Mixed-axis segment');
    if(clear(a,b))return [b];
    const y=a.y,step=3,nodes:T.Vector3[]=[a,b],grid=new Map<string,number>();
    for(let x=-120;x<=75;x+=step)for(let z=-135;z<=81;z+=step){const p=new T.Vector3(x,y,z);if(free(p)){grid.set(`${x},${z}`,nodes.length);nodes.push(p);}}
    const links=(p:T.Vector3)=>nodes.flatMap((q,i)=>i>1&&p.distanceTo(q)<=9&&clear(p,q)?[i]:[]);
    const fromLinks=links(a),toLinks=new Set(links(b));
    const cost=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1),open=new Set<number>([0]);cost[0]=0;
    while(open.size){let current=-1,best=Infinity;for(const i of open){const score=cost[i]+nodes[i].distanceTo(b);if(score<best){best=score;current=i;}}if(current===1)break;open.delete(current);
      const p=nodes[current],neighbors=current===0?fromLinks:[];
      if(current!==0){for(const dx of [-step,0,step])for(const dz of [-step,0,step]){if(!dx&&!dz)continue;const i=grid.get(`${p.x+dx},${p.z+dz}`);if(i!==undefined&&clear(p,nodes[i]))neighbors.push(i);}if(toLinks.has(current))neighbors.push(1);}
      for(const next of neighbors){const value=cost[current]+p.distanceTo(nodes[next]);if(value<cost[next]){cost[next]=value;previous[next]=current;open.add(next);}}
    }
    if(!Number.isFinite(cost[1]))return [];
    const path:T.Vector3[]=[];for(let i=1;i!==0;i=previous[i])path.unshift(nodes[i]);path.unshift(a);
    const simplified:T.Vector3[]=[];for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!clear(path[i],path[j]))j--;simplified.push(path[j]);i=j;}return simplified;
  }
  type Point={position:T.Vector3;photo:boolean;target:T.Vector3};
  const reports:{code:string;levels:{height:number;accepted:number;omitted:number}[];segments:number}[]=[];
  const plans=catalog.filter(a=>['SILO','SILO_FLOTANTE','CELDA'].includes(a.type)).map(asset=>{
    const points:Point[]=[{position:home.clone(),photo:false,target:home.clone()}];
    const add=(p:T.Vector3,photo=false,target=p)=>{if(points[points.length-1].position.distanceTo(p)<.001&&!photo)return;points.push({position:p.clone(),photo,target:target.clone()});};
    add(new T.Vector3(home.x,cruise,home.z));
    const report={code:asset.code,levels:[] as {height:number;accepted:number;omitted:number}[],segments:0};
    const heights=asset.r?[asset.type==='SILO_FLOTANTE'?2.2:asset.h*.28,asset.h*.65,asset.h+asset.r*.3+3]:[4,9,18];
    for(const rawHeight of heights){const y=Number(rawHeight.toFixed(2))+plantGeoreference.groundHeight;
      const candidates:T.Vector3[]=[];
      if(asset.r){for(let i=0;i<24;i++){const a=i*Math.PI/12; candidates.push(new T.Vector3(asset.x+Math.cos(a)*(asset.r+2.6),y,asset.z+Math.sin(a)*(asset.r+2.6)));}}
      else {
        // Rounded rectangular perimeter aligned to the actual rotated cell, not a circle.
        const halfX=27/2+3,halfZ=43/2+3,r=2;
        for(const [sx,sz,offset] of [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,Math.PI*1.5]])for(let i=0;i<=4;i++){
          const angle=offset+i*Math.PI/8,x=sx*(halfX-r)+r*Math.cos(angle),z=sz*(halfZ-r)+r*Math.sin(angle);
          candidates.push(new T.Vector3(asset.x+(x+z)/Math.sqrt(2),y,asset.z+(-x+z)/Math.sqrt(2)));
        }
      }
      const valid=candidates.filter(p=>free(p)&&clear(p,new T.Vector3(p.x,cruise,p.z)));
      report.levels.push({height:y,accepted:valid.length,omitted:candidates.length-valid.length});
      if(valid.length<3)throw Error(`${asset.code}: insufficient accessible viewpoints at ${y}`);
      const first=valid[0],highFirst=new T.Vector3(first.x,cruise,first.z);
      add(highFirst);add(first);
      const target=new T.Vector3(asset.x,Math.min(asset.h,y),asset.z);
      for(const p of [...valid,first]){
        const last=points[points.length-1].position,path=travel(last,p);
        if(!path.length&&last.distanceTo(p)>.001){
          // Disconnected low corridors must be joined above every structure, never through it.
          add(new T.Vector3(last.x,cruise,last.z));add(new T.Vector3(p.x,cruise,p.z));add(p);
        } else for(const intermediate of path)add(intermediate);
        add(p,true,target);
      }
      add(highFirst); // Vertical departure before any horizontal transit.
    }
    // A complete upper orbit remains possible even where neighboring walls block low arcs.
    if(asset.r){
      for(let i=0;i<=24;i++){const angle=i*Math.PI/12;
        add(new T.Vector3(asset.x+Math.cos(angle)*(asset.r+2.6),cruise,asset.z+Math.sin(angle)*(asset.r+2.6)),true,new T.Vector3(asset.x,asset.h+asset.r*.3,asset.z));
      }
    } else {
      // Three roof passes, aligned with the cell's long axis.
      for(let row=0;row<3;row++)for(const along of (row%2?[16,8,0,-8,-16]:[-16,-8,0,8,16])){
        const across=(row-1)*8,x=asset.x+(across+along)/Math.sqrt(2),z=asset.z+(-across+along)/Math.sqrt(2);
        add(new T.Vector3(x,cruise,z),true,new T.Vector3(x,14,z));
      }
    }
    add(new T.Vector3(home.x,cruise,home.z));add(home);
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
  });
  return {plans,reports,clearance:CLEARANCE,cruise,home:home.toArray(),bounds:bounds.length};
}
