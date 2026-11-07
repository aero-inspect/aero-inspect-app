import * as THREE from "three";
import { UTN_FOOTPRINTS } from "../../data/utnFootprints";

/** Painted markings fitted to the supplied four-corner pitch. Dimensions are
 * a visual reconstruction, not a surveyed or certified sporting layout. */
export function buildPitchMarkings(project: (p: readonly number[]) => THREE.Vector3, second = false) {
  const group=new THREE.Group();group.name="Líneas de cancha";
  const p=UTN_FOOTPRINTS[second ? "Cancha 2" : "Cancha 1"].map(project);
  const width=(p[0].distanceTo(p[1])+p[3].distanceTo(p[2]))/2;
  const length=(p[0].distanceTo(p[3])+p[1].distanceTo(p[2]))/2;
  const paint=new THREE.MeshStandardMaterial({color:0xf4f2e8,roughness:1,depthWrite:false});
  // Coordinates in metres: x across the goal line, z from one goal to the other.
  const point=(x:number,z:number)=>p[0].clone().lerp(p[1],x/width)
    .lerp(p[3].clone().lerp(p[2],x/width),z/length).setY(.025);
  function line(ax:number,az:number,bx:number,bz:number) {
    const a=point(ax,az),b=point(bx,bz),delta=b.clone().sub(a);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(delta.length(),.008,.12),paint);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.rotation.y=-Math.atan2(delta.z,delta.x);mesh.receiveShadow=true;group.add(mesh);
  }
  function arc(cx:number,cz:number,r:number,start=0,end=Math.PI*2) {
    const steps=Math.ceil((end-start)*r/.3);
    for(let i=0;i<steps;i++) {
      const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;
      line(cx+Math.cos(a)*r,cz+Math.sin(a)*r,cx+Math.cos(b)*r,cz+Math.sin(b)*r);
    }
  }
  function spot(x:number,z:number) {
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(.13,20),paint);
    mesh.rotation.x=-Math.PI/2;mesh.position.copy(point(x,z));group.add(mesh);
  }
  line(0,0,width,0);line(width,0,width,length);
  line(width,length,0,length);line(0,length,0,0);
  line(0,length/2,width,length/2);arc(width/2,length/2,Math.min(9.15,width*.18));spot(width/2,length/2);
  const goals=second ? [UTN_FOOTPRINTS["Arco 2 cancha 2"],UTN_FOOTPRINTS["Arco 1 cancha 2"]] : [UTN_FOOTPRINTS["Arco 2 cancha 1"],UTN_FOOTPRINTS["Arco chancha 1"]];
  goals.forEach((ring,end)=>{
    const center=ring.map(project).reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25);
    const a=end===0?p[0]:p[3],b=end===0?p[1]:p[2],edge=b.clone().sub(a);
    const cx=THREE.MathUtils.clamp(center.clone().sub(a).dot(edge)/edge.lengthSq(),.3,.7)*width;
    const base=end===0?0:length,sign=end===0?1:-1;
    const boxWidth=Math.min(40.32,width*.8),depth=Math.min(16.5,length*.2);
    const smallWidth=Math.min(18.32,width*.4),smallDepth=Math.min(5.5,length*.07);
    for(const [w,d] of [[boxWidth,depth],[smallWidth,smallDepth]]) {
      line(cx-w/2,base,cx-w/2,base+sign*d);
      line(cx-w/2,base+sign*d,cx+w/2,base+sign*d);
      line(cx+w/2,base+sign*d,cx+w/2,base);
    }
    const penalty=Math.min(11,length*.13);spot(cx,base+sign*penalty);
    const radius=Math.min(9.15,width*.18);
    const angle=Math.asin(THREE.MathUtils.clamp((depth-penalty)/radius,0,1));
    if(end===0)arc(cx,base+penalty,radius,angle,Math.PI-angle);
    else arc(cx,base-penalty,radius,Math.PI+angle,2*Math.PI-angle);
  });
  arc(0,0,1,0,Math.PI/2);arc(width,0,1,Math.PI/2,Math.PI);
  arc(width,length,1,Math.PI,1.5*Math.PI);arc(0,length,1,1.5*Math.PI,2*Math.PI);
  return group;
}
