import * as THREE from 'three';
import { UTN_FOOTPRINTS } from '../../data/utnFootprints';
import { surface } from './materials';

// Footprints surveyed in the supplied KML; heights and facade details estimated
// from the October 31 photographs. Local shed +z points toward the pitch.
export function buildSpaceTwo(project: (p: readonly number[]) => THREE.Vector3) {
  const group = new THREE.Group(); group.name = 'UTN · Espacio 2';
  const white = surface(0xdadbd1, 'plaster');
  const sage = surface(0x8e9c80, 'plaster');
  const metal = new THREE.MeshStandardMaterial({color:0xd9ddd3,roughness:.65,metalness:.25});
  const green = new THREE.MeshStandardMaterial({color:0x244437,roughness:.8});
  const glass = new THREE.MeshStandardMaterial({color:0x354444,roughness:.35});
  const concrete = surface(0xa7a69b,'concrete');
  function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function tube(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material) {
    const delta=b.clone().sub(a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),m);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=true;parent.add(mesh);
  }
  const p=UTN_FOOTPRINTS['Galpon cancha 2'].map(project);
  const width=p[0].distanceTo(p[1]),depth=(p[0].distanceTo(p[3])+p[1].distanceTo(p[2]))/2;
  const shed=new THREE.Group();shed.name='Galpón del espacio 2';shed.position.copy(p[0]).add(p[1]).multiplyScalar(.5);
  const axis=p[1].clone().sub(p[0]).normalize();shed.rotation.y=-Math.atan2(axis.z,axis.x);group.add(shed);
  // The KML rear lies along negative z in this frame.
  box(shed,width,4.6,depth,0,2.3,-depth/2,white);
  const profile=new THREE.Shape();profile.moveTo(-width/2,4.6);
  for(let i=0;i<=40;i++){const x=-width/2+width*i/40;profile.lineTo(x,4.6+1.25*Math.sin(Math.PI*i/40));}
  profile.lineTo(width/2,4.6);profile.closePath();
  const vault=new THREE.Mesh(new THREE.ExtrudeGeometry(profile,{depth:depth,bevelEnabled:false,curveSegments:32}),sage);
  vault.position.z=-depth;vault.castShadow=true;vault.receiveShadow=true;shed.add(vault);
  // Shallow white entrance annex under a corrugated awning.
  box(shed,width,2.85,2.4,0,1.425,1.2,white);
  box(shed,width+.4,.09,2.85,0,2.98,1.2,metal).rotation.x=.07;
  for(let x=-width/2;x<width/2;x+=.18)box(shed,.035,.045,2.85,x,3.035,1.2,metal).rotation.x=.07;
  function barredOpening(x:number,w:number,h:number,y:number,door=false){
    box(shed,w,h,.06,x,y,2.425,door?white:glass);
    for(const dx of [-w/2,w/2])box(shed,.055,h+.12,.12,x+dx,y,2.49,metal);
    for(const dy of [-h/2,h/2])box(shed,w+.12,.055,.12,x,y+dy,2.49,metal);
    for(let dx=-w/2+.16;dx<w/2;dx+=.18)box(shed,.023,h,.07,x+dx,y,2.56,metal);
    for(const dy of [-h*.3,h*.3])box(shed,w,.028,.08,x,y+dy,2.56,metal);
    if(door)box(shed,.045,h,.09,x,y,2.58,metal);
  }
  barredOpening(0,1.8,2.3,1.15,true);
  barredOpening(-width*.32,1.5,1.45,1.7);barredOpening(width*.32,1.5,1.45,1.7);
  box(shed,width+.4,.07,1,0,.035,2.85,concrete);
  // Tall green industrial sliding door on the side visible in the references.
  box(shed,.09,3.9,2.6,-width/2-.04,1.95,-1.8,green);
  for(let z=-3.05;z<-.5;z+=.14)box(shed,.13,3.9,.025,-width/2-.07,1.95,z,metal);
  box(shed,.15,.12,3.3,-width/2-.1,4,-1.8,green);
  box(shed,.09,2.1,1,-width/2-.04,1.05,-depth*.7,green);

  const pitch=UTN_FOOTPRINTS['Cancha 2'].map(project);
  const center=pitch.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25);
  for(const name of ['Arco 1 cancha 2','Arco 2 cancha 2'] as const){
    const ring=UTN_FOOTPRINTS[name].map(project);
    const short=ring.reduce((best,a,i)=>a.distanceTo(ring[(i+1)%4])<ring[best].distanceTo(ring[(best+1)%4])?i:best,0);
    const a=ring[short].clone().add(ring[(short+1)%4]).multiplyScalar(.5);
    const b=ring[(short+2)%4].clone().add(ring[(short+3)%4]).multiplyScalar(.5);
    const middle=a.clone().add(b).multiplyScalar(.5),back=middle.clone().sub(center).normalize().multiplyScalar(1.25);
    const topA=a.clone().setY(2),topB=b.clone().setY(2);
    tube(group,a,topA,.045,metal);tube(group,b,topB,.045,metal);tube(group,topA,topB,.045,metal);
    const positions:number[]=[];
    const segment=(a:THREE.Vector3,b:THREE.Vector3)=>positions.push(...a.toArray(),...b.toArray());
    // Sagging mesh ropes, with open goal mouth and net on back/sides/top.
    const netPoint=(u:number,v:number)=>a.clone().lerp(b,u).addScaledVector(back,1-.5*v).setY(2*v-.12*Math.sin(Math.PI*u)*Math.sin(Math.PI*v));
    for(let u=0;u<=1.001;u+=.05)for(let j=0;j<12;j++)segment(netPoint(u,j/12),netPoint(u,(j+1)/12));
    for(let j=0;j<=12;j++)for(let i=0;i<20;i++)segment(netPoint(i/20,j/12),netPoint((i+1)/20,j/12));
    for(const post of [a,b]){
      const rear=post.clone().add(back);tube(group,rear,rear.clone().setY(2.15),.018,green);
      for(let y=0;y<=2;y+=.16)segment(post.clone().setY(y),post.clone().addScaledVector(back,1-y/4).setY(y));
      for(let t=.2;t<=1;t+=.2)segment(post.clone().addScaledVector(back,t),post.clone().addScaledVector(back,t*.5).setY(2));
    }
    for(let u=0;u<=1.001;u+=.05)segment(topA.clone().lerp(topB,u),netPoint(u,1));
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe2ded0,transparent:true,opacity:.8})));
  }
  const area=UTN_FOOTPRINTS['Espacio 2'].map(project);
  // Floodlights along the opposite touchline, outside the playing surface.
  for(const t of [.12,.5,.88]){
    const pos=area[0].clone().lerp(area[3],t);const pole=new THREE.Group();pole.position.copy(pos);group.add(pole);
    tube(pole,new THREE.Vector3(),new THREE.Vector3(0,1,0),.11,green);
    tube(pole,new THREE.Vector3(0,1,0),new THREE.Vector3(0,3,0),.1,metal);
    tube(pole,new THREE.Vector3(0,3,0),new THREE.Vector3(0,10,0),.075,green);
    for(const x of [-.33,.33])box(pole,.42,.55,.22,x,10,0,metal).rotation.x=-.4;
  }
  // Broad, irregular crown beside the shed; position inferred from photographs.
  const tree=new THREE.Group();tree.position.copy(shed.position);
  tree.position.add(new THREE.Vector3(-width/2-4,0,-depth*.55).applyQuaternion(shed.quaternion));group.add(tree);
  const bark=surface(0x62594a,'concrete');
  const leaves=new THREE.MeshStandardMaterial({color:0x46603a,roughness:1});
  for(let i=0;i<4;i++){
    const angle=i*2.4;
    tube(tree,new THREE.Vector3(Math.cos(angle)*.35,0,Math.sin(angle)*.35),new THREE.Vector3(Math.cos(angle)*1.5,5.8,Math.sin(angle)*1.5),.28,bark);
  }
  for(let i=0;i<14;i++){
    const angle=i*2.4,r=1.4+(i%3)*.7;
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.5,2),leaves);
    crown.position.set(Math.cos(angle)*r,5.6+(i%4)*.65,Math.sin(angle)*r);crown.scale.set(1,.85,1);
    crown.castShadow=true;tree.add(crown);
  }
  return group;
}
