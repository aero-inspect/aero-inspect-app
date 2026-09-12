// Geometry ported from the approved bragado-silos-3d prototype.
import * as T from 'three';
import assetCatalog from '../../data/bragado-assets.json';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// One triangulated pavement surface: closed circulation loop and two access branches.
function buildRoad(mesh,concrete){
const roadWidth=7;
const loop=new T.CatmullRomCurve3([[-62,-19],[-61,-32],[-46,-48],[-24,-53],[-4,-43],[1,-32],[14,-18],[24,-7],[42,10],[42,41],[28,52],[12,56],[-5,39],[-27,16],[-46,-3]].map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal');
const outer=[],inner=[],samples=320;
for(let i=0;i<samples;i++){
  const p=loop.getPoint(i/samples),t=loop.getTangent(i/samples),n=new T.Vector3(-t.z,0,t.x).multiplyScalar(roadWidth/2);
  outer.push(new T.Vector2(p.x-n.x,p.z-n.z));inner.push(new T.Vector2(p.x+n.x,p.z+n.z));
}
function accessBranch(anchor,points){
  let index=0;outer.forEach((p,i)=>{if(p.distanceToSquared(new T.Vector2(...anchor))<outer[index].distanceToSquared(new T.Vector2(...anchor)))index=i;});
  const start=outer[index],curve=new T.CatmullRomCurve3([[start.x,start.y],...points].map(([x,z])=>new T.Vector3(x,0,z))),a=[],b=[];
  for(let i=1;i<=40;i++){const p=curve.getPoint(i/40),t=curve.getTangent(i/40),n=new T.Vector3(-t.z,0,t.x).multiplyScalar(roadWidth/2);a.push(new T.Vector2(p.x+n.x,p.z+n.z));b.push(new T.Vector2(p.x-n.x,p.z-n.z));}
  const boundary=outer[index-2].distanceToSquared(a[0])<outer[index-2].distanceToSquared(b[0])?[...a,...b.reverse()]:[...b,...a.reverse()];
  outer.splice(index-1,3,...boundary);
}
accessBranch([-46,-52],[[-72,-53],[-89,-74],[-101,-94]]);
accessBranch([12,60],[[18,70],[29,85]]);
const pavement=new T.Shape(outer);pavement.holes.push(new T.Path(inner.slice().reverse()));
const roadGeometry=new T.ShapeGeometry(pavement);roadGeometry.rotateX(Math.PI/2);roadGeometry.translate(0,.025,0);
const triangles=roadGeometry.index.array;
for(let i=0;i<triangles.length;i+=3){const vertex=triangles[i];triangles[i]=triangles[i+2];triangles[i+2]=vertex;}
roadGeometry.computeVertexNormals();
concrete.side=T.DoubleSide;const road=mesh(roadGeometry,concrete);road.castShadow=false;
}

function addEquipment({mesh,box,beam,fixed,canopy,steel,frame,rust,yellow,concrete,dark}) {
  const dryer=new T.Group();dryer.position.set(-9,0,10);fixed.add(dryer);
  for(let level=0;level<3;level++) {
    box(4.2,3.1,3.6,0,level*3.2+.5,0,steel,dryer);
    box(4.4,.18,3.8,0,level*3.2+.4,0,frame,dryer);
    for(let x=-1.8;x<2;x+=.6)box(.035,3,.04,x,level*3.2+.55,1.83,frame,dryer);
    box(.35,2.6,.04,1.25,level*3.2+.7,1.85,rust,dryer);
  }
  box(4.5,.18,3.9,0,10.1,0,steel,dryer);
  for(const x of [-2.3,-1.6])beam([x,0,2.1],[x,10,2.1],.04,yellow,dryer);
  for(let y=.3;y<10;y+=.35)beam([-2.3,y,2.1],[-1.6,y,2.1],.025,yellow,dryer);
  // Side platform, handrails and suspended discharge pipes, clear of the truck lane.
  box(2.6,.65,10,7,.1,0,concrete,canopy);
  for(let z=-5;z<=5;z+=2.5)beam([5.7,.75,z],[5.7,1.8,z],.035,yellow,canopy);
  for(const y of [1.2,1.8])beam([5.7,y,-5],[5.7,y,5],.035,yellow,canopy);
  for(const z of [-3,3]) {
    
    
    const lamp=new T.PointLight('#ffb642',25,10);lamp.position.set(3,7,z);canopy.add(lamp);
    const bulb=mesh(new T.SphereGeometry(.1,8,6),new T.MeshStandardMaterial({color:'#ffe7a3',emissive:'#ffba48',emissiveIntensity:3}),canopy);bulb.position.copy(lamp.position);
  }
  box(.18,3,3,8.6,.7,1,rust,canopy);
  box(.19,1.3,1.8,8.48,1.8,1,new T.MeshStandardMaterial({color:'#a4c6bb',emissive:'#517469',emissiveIntensity:.3}),canopy);
  for(const z of [-6,0,6])for(let y=0;y<8;y+=1)beam([8.9,y,z-.25],[8.9,y+1,z+.25],.035,steel,canopy);
  return function fan(b,parent) {
    const g=new T.Group();
    const angle=Math.atan2(b.x,b.z),distance=b.r+.5;
    g.position.set(b.x+Math.sin(angle)*distance,0,b.z+Math.cos(angle)*distance);g.rotation.y=angle;parent.add(g);
    const housing=mesh(new T.CylinderGeometry(.65,.65,.5,32),frame,g);housing.rotation.x=Math.PI/2;housing.position.set(0,.85,.25);
    const motor=mesh(new T.CylinderGeometry(.24,.24,.48,20),dark,g);motor.rotation.x=Math.PI/2;motor.position.set(0,.85,.7);
    box(1.3,.12,1.2,0,.15,.35,frame,g);box(.6,.6,.4,0,.35,-.2,frame,g);
    for(let x=-.18;x<=.18;x+=.06)beam([x,.66,.95],[x,1.04,.95],.012,steel,g);
    for(let y=.7;y<=1;y+=.06)beam([-.18,y,.95],[.18,y,.95],.012,steel,g);
    for(const x of [-.5,.5])box(.08,.5,.08,x,.15,.3,frame,g);
  };
}



function addPerimeter({beam,frame,dark}){
  // Street edge retained; polygon encloses the rotated celda and the access road.
  const corners=[[-67,-15],[-69,-36],[-112,-94],[-105,-113],[-36,-119],[7,-48],[53,1],[59,44],[34,68],[8,64],[-10,43],[-31,20],[-50,1]];
  for(let edge=0;edge<corners.length;edge++){
    const a=new T.Vector2(...corners[edge]),b=new T.Vector2(...corners[(edge+1)%corners.length]);
    const count=Math.ceil(a.distanceTo(b)/3);
    for(let i=0;i<count;i++){
      const p=a.clone().lerp(b,i/count),q=a.clone().lerp(b,(i+1)/count);
      // Vehicle openings on the street and the entrance side.
      if(edge===8&&p.x>12&&p.x<26)continue;
      beam([p.x,0,p.y],[p.x,2,p.y],.065,frame);
      for(const y of [.45,1,1.55,1.95])beam([p.x,y,p.y],[q.x,y,q.y],.012,dark);
      for(let t=0;t<1;t+=.25){const v=p.clone().lerp(q,t);beam([v.x,.3,v.y],[v.x,1.9,v.y],.008,dark);}
    }
  }
}

function addOutlets({bins,numbers,mesh,box,beam,frame,rust,dark,parent,scale}){
  // Outlets face the street (-x,+z), opposite the truck-unloading canopy.
  const dx=-Math.SQRT1_2,dz=Math.SQRT1_2;
  for(const b of bins.filter(b=>[9,10,11].includes(numbers[b.id]))){
    const g=new T.Group();parent.add(g);g.position.set(b.x+dx*b.r,0,b.z+dz*b.r);g.rotation.y=Math.atan2(dx,dz);
    const h=5*scale;
    box(2.2,2.3,.1,0,h-.5,0,rust,g);
    box(1.8,.12,1.8,0,h-1,.8,dark,g);
    for(const x of [-.8,.8])beam([x,h-2.3,.05],[x,h-1,1.6],.06,rust,g);
    for(const y of [h,h+.85]){
      const tube=mesh(new T.CylinderGeometry(.25,.25,1.7,24,1,true),rust,g);tube.rotation.x=Math.PI/2;tube.position.set(0,y,.85);
      const mouth=mesh(new T.CircleGeometry(.23,24),dark,g);mouth.position.set(0,y,1.7);
      const flange=mesh(new T.TorusGeometry(.28,.035,6,24),rust,g);flange.position.set(0,y,1.7);
    }
  }
  const a=[-1,24*scale,0],b=[-21,13*scale,20];
  beam(a,b,.27,rust,parent);
  for(const t of [.3,.6,.9]){const p=new T.Vector3(...a).lerp(new T.Vector3(...b),t);const ring=mesh(new T.TorusGeometry(.31,.04,6,20),rust,parent);ring.position.copy(p);ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...b).sub(new T.Vector3(...a)).normalize());}
  const spout=mesh(new T.CylinderGeometry(.32,.32,1.2,24,1,true),rust,parent);spout.position.set(b[0],b[1]-.5,b[2]);
  beam([-1,29*scale,0],b,.025,frame,parent);
}

export function buildPlant(scene,heightScale,siloNumbers,tubeConnections,inspectionVolumes){
const material=(color,metalness=0,roughness=.8)=>new T.MeshStandardMaterial({color,metalness,roughness});
const steel=material('#a6afb0',.6,.55),frame=material('#505f43',.4),rust=material('#8a6956',.35),yellow=material('#c0aa54'),concrete=material('#97978f'),dark=material('#343b37');
const fixed=new T.Group(),dynamic=new T.Group();scene.add(fixed,dynamic);const labels=[];
function mesh(geometry,mat,parent=fixed){const m=new T.Mesh(geometry,mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,x,y,z,mat=steel,parent=fixed){const m=mesh(new T.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y+h/2,z);return m;}
function beam(a,b,r=.09,mat=frame,parent=fixed){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const m=mesh(new T.CylinderGeometry(r,r,delta.length(),6),mat,parent);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;}
function label(text,x,y,z,parent=fixed){const c=document.createElement('canvas');c.width=256;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,256,80);ctx.fillStyle='#28312d';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,52);const s=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c)}));s.position.set(x,y,z);s.material.sizeAttenuation=false;s.scale.set(.055,.014,1);parent.add(s);labels.push(s);}
// Deterministic ground texture; roads follow continuous curves rather than platforms.
const tile=document.createElement('canvas');tile.width=tile.height=256;const ctx=tile.getContext('2d');let seed=17;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};ctx.fillStyle='#6d8052';ctx.fillRect(0,0,256,256);
for(let i=0;i<22000;i++){const v=Math.floor(rand()*40);ctx.fillStyle=`rgb(${75+v},${91+v},${47+v})`;ctx.fillRect(rand()*256,rand()*256,1+rand()*3,1);}
const grassMap=new T.CanvasTexture(tile);grassMap.wrapS=grassMap.wrapT=T.RepeatWrapping;grassMap.repeat.set(90,90);grassMap.colorSpace=T.SRGBColorSpace;
const ground=mesh(new T.PlaneGeometry(900,900),new T.MeshStandardMaterial({map:grassMap,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.castShadow=false;
buildRoad(mesh,concrete);
function gabled(w,d,h,rise,x,z,open=false){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=-Math.PI/4;fixed.add(g);if(!open)box(w,h,d,0,0,0,steel,g);const angle=Math.atan2(rise,w/2),slope=Math.hypot(w/2,rise);
for(const side of [-1,1]){const panel=box(slope+.4,.16,d+.7,side*w/4,h+rise/2,0,steel,g);panel.rotation.z=-side*angle;for(let zz=-d/2;zz<=d/2;zz+=3){beam([side*w/2,0,zz],[side*w/2,h,zz],.13,frame,g);if(!open)beam([side*(w/2+1.7),0,zz],[side*w/2,h*.65,zz],.1,frame,g);beam([side*w/2,h,zz],[0,h+rise,zz],.09,frame,g);}if(!open)for(let y=1;y<h;y+=1.6)box(.12,.12,d,side*(w/2+.08),y,0,frame,g);}
if(!open)for(const end of [-1,1]){const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,rise);shape.closePath();const wall=mesh(new T.ShapeGeometry(shape),steel,g);wall.material.side=T.DoubleSide;wall.position.set(0,h,end*d/2);for(let xx=-w/2;xx<=w/2;xx+=.5)box(.035,h,.03,xx,0,end*(d/2+.02),frame,g);}return g;}
gabled(27,43,8,6,-51,-77).rotation.y+=Math.PI/2;
const canopy=gabled(18,13,9,1.5,17,-21,true);
box(.12,4,13,-9,5,0,steel,canopy);box(.12,3,13,9,6,0,steel,canopy);
for(const z of [-6.5,6.5])box(18,2.3,.12,0,6.7,z,steel,canopy);
box(8,.12,12,0,.05,0,concrete,canopy);for(let z=-2;z<2;z+=.2)box(5,.05,.08,0,.19,z,dark,canopy);
const lamp=new T.PointLight('#ffc36c',45,15,2);lamp.position.set(0,7,0);canopy.add(lamp);label('Descarga',17,12,-21);
addPerimeter({beam,frame,dark});
// Shared centers keep rendered assets and inspection coordinates aligned.
const addFan=addEquipment({mesh,box,beam,fixed,canopy,steel,frame,rust,yellow,concrete,dark});
const binIds={G1:'silo-10',G2:'silo-11',G3:'silo-9',M1:'silo-5',M2:'silo-3',M3:'silo-6',M4:'silo-4',M5:'silo-2',M6:'silo-1',M7:'silo-8',M8:'silo-7',P1:'F1',P2:'F2',P3:'F3'};
const bins=Object.entries(binIds).map(([id,assetId])=>({...assetCatalog.find(a=>a.id===assetId),id}));
function rebuild(){for(const child of [...dynamic.children]){dynamic.remove(child);child.traverse(o=>{o.geometry?.dispose();if(o.isSprite){o.material.map.dispose();o.material.dispose();}});}labels.splice(2);const scale=heightScale;
for(const b of bins){const h=b.h*scale,small=b.id[0]==='P',base=small?3:.35,profile=[];
for(let y=0;y<=h-base;y+=.055)profile.push(new T.Vector2(b.r+Math.sin(y*Math.PI*2/.16)*.027,y+base));const silo=mesh(new T.LatheGeometry(profile,80),steel,dynamic);silo.position.set(b.x,0,b.z);
const foundation=mesh(new T.CylinderGeometry(b.r+.05,b.r+.06,.4,64),concrete,dynamic);foundation.position.set(b.x,.2,b.z);
const rise=b.r*.3,roof=mesh(new T.ConeGeometry(b.r,rise,64),b.id[0]==='M'?rust:steel,dynamic);roof.position.set(b.x,h+rise/2,b.z);
for(let i=0;i<16;i++){const a=i*Math.PI/8;beam([b.x,h+rise,b.z],[b.x+Math.cos(a)*b.r,h,b.z+Math.sin(a)*b.r],.025,frame,dynamic);}
for(let i=0;i<12;i++){const a=i*Math.PI/6;beam([b.x+Math.cos(a)*(b.r+.04),base,b.z+Math.sin(a)*(b.r+.04)],[b.x+Math.cos(a)*(b.r+.04),h,b.z+Math.sin(a)*(b.r+.04)],.014,dark,dynamic);}
if(small){const hopper=mesh(new T.CylinderGeometry(b.r,.3,2.6,40),frame,dynamic);hopper.position.set(b.x,1.9,b.z);for(const dx of [-1,1])for(const dz of [-1,1])beam([b.x+dx*b.r*.7,0,b.z+dz*b.r*.7],[b.x+dx*b.r*.7,base+1,b.z+dz*b.r*.7],.08,frame,dynamic);}else{for(const dx of [-.35,.35])beam([b.x+dx,.5,b.z+b.r+.2],[b.x+dx,h,b.z+b.r+.2],.035,yellow,dynamic);for(let y=.6;y<h;y+=.35)beam([b.x-.35,y,b.z+b.r+.2],[b.x+.35,y,b.z+b.r+.2],.025,yellow,dynamic);box(.65,.9,.3,b.x,.5,b.z+b.r,frame,dynamic);addFan(b,dynamic);}}
const towers=[[-1,0,31],[12,5,25]];towers.forEach(([x,z,height])=>{const h=height*scale;for(const dx of [-.45,.45]){box(.38,h,.35,x+dx,0,z,frame,dynamic);for(let y=0;y<h;y+=2)box(.48,.08,.45,x+dx,y,z,rust,dynamic);}box(3.4,.15,3.4,x,h-1.3,z,dark,dynamic);for(const side of [-1,1]){beam([x-1.7,h,z+side*1.7],[x+1.7,h,z+side*1.7],.04,frame,dynamic);beam([x+side*1.7,h,z-1.7],[x+side*1.7,h,z+1.7],.04,frame,dynamic);}for(let y=1;y<h;y+=2){const ring=mesh(new T.TorusGeometry(.45,.025,6,20),frame,dynamic);ring.rotation.x=Math.PI/2;ring.position.set(x+1.2,y,z);}for(const dx of [-.8,.8])for(const dz of [-.8,.8])beam([x+dx,0,z+dz],[x+dx,h,z+dz],.1,frame,dynamic);for(let y=1;y<h-2;y+=2)for(const side of [-1,1]){beam([x-.8,y,z+side*.8],[x+.8,y+2,z+side*.8],.045,frame,dynamic);beam([x+side*.8,y,z-.8],[x+side*.8,y+2,z+.8],.045,frame,dynamic);}box(2.6,1.6,2.6,x,h-1,z,frame,dynamic);});
for(const tube of tubeConnections){const {a,b}=tubeEnds(tube,scale);beam(a,b,.16,frame,dynamic);beam([a[0],a[1]+1,a[2]],[b[0],b[1]+.4,b[2]],.018,dark,dynamic);}
addOutlets({bins,numbers:siloNumbers,mesh,box,beam,frame,rust,dark,parent:dynamic,scale});
updateLabels();}
function tubeEnds(tube,scale){
  const find=id=>bins.find(b=>String(siloNumbers[b.id]||('F'+b.id.slice(1)))===String(id));
  const roof=b=>[b.x,b.h*scale+b.r*.3,b.z];
  const towers=[[-1,30*scale,0],[12,24*scale,5]];
  return {a:tube.from?roof(find(tube.from)):towers[tube.noria-1],b:roof(find(tube.to))};
}
const collisionBounds=[];
function batch(group){
  group.updateMatrixWorld(true);
  group.traverse(o=>{
    if(!o.isMesh || o===ground)return;
    const bounds=new T.Box3().setFromObject(o);
    if(o.geometry.type==='LatheGeometry') {
      // Circumscribed strips preserve the curved silo footprint without blocking its square corners.
      const center=bounds.getCenter(new T.Vector3()),radius=(bounds.max.x-bounds.min.x)/2;
      for(let i=0;i<16;i++) {
        const left=-radius+i*radius/8,right=left+radius/8;
        const closest=left<=0&&right>=0?0:Math.min(Math.abs(left),Math.abs(right));
        const halfDepth=Math.sqrt(Math.max(0,radius*radius-closest*closest));
        const strip=new T.Box3(new T.Vector3(center.x+left,bounds.min.y,center.z-halfDepth),new T.Vector3(center.x+right,bounds.max.y,center.z+halfDepth));
        collisionBounds.push(strip);
      }
      inspectionVolumes?.push({box:o.geometry.boundingBox.clone(),matrix:o.matrixWorld.clone(),radius});
    } else if(o.geometry.type==='ConeGeometry'&&inspectionVolumes){
      collisionBounds.push(bounds);
      const {radius,height}=o.geometry.parameters;
      for(let i=0;i<16;i++){
        const r=radius*(1-i/16),bottom=-height/2+i*height/16;
        inspectionVolumes.push({box:new T.Box3(new T.Vector3(-r,bottom,-r),new T.Vector3(r,bottom+height/16,r)),matrix:o.matrixWorld.clone(),radius:r});
      }
    } else {
      collisionBounds.push(bounds);
      if(inspectionVolumes){o.geometry.computeBoundingBox();inspectionVolumes.push({box:o.geometry.boundingBox.clone(),matrix:o.matrixWorld.clone()});}
    }
  });
  const batches=new Map(),originals=[];
  group.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);originals.push(o);});
  for(const o of originals){o.removeFromParent();o.geometry.dispose();}
  for(const [mat,geometries] of batches){const g=mergeGeometries(geometries);mesh(g,mat,group);geometries.forEach(g=>g.dispose());}
}
function updateLabels(){labels.forEach(l=>l.visible=false);}
batch(fixed);rebuild();batch(dynamic);
return collisionBounds;

}
