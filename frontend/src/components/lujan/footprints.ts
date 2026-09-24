import { LUJAN_FOOTPRINTS } from "../../data/lujanFootprints";
import { lujanToLocal } from "../../data/plants";

export type Point = [number, number];
export function footprintLocal(name: keyof typeof LUJAN_FOOTPRINTS): Point[] {
  return LUJAN_FOOTPRINTS[name].map(([longitude,latitude])=>lujanToLocal(latitude,longitude));
}
export function polygonCenter(points: Point[]): Point {
  let area=0,x=0,z=0;
  points.forEach(([ax,az],i)=>{
    const [bx,bz]=points[(i+1)%points.length],cross=ax*bz-bx*az;
    area+=cross;x+=(ax+bx)*cross;z+=(az+bz)*cross;
  });
  return [x/(3*area),z/(3*area)];
}
// Offset a convex ring inward by a metric distance, used for the pool coping.
export function insetConvex(points: Point[],distance: number): Point[] {
  const signed=points.reduce((sum,[x,z],i)=>{const b=points[(i+1)%points.length];return sum+x*b[1]-b[0]*z;},0);
  const lines=points.map(([x,z],i)=>{
    const b=points[(i+1)%points.length],dx=b[0]-x,dz=b[1]-z,length=Math.hypot(dx,dz);
    return {x:x-Math.sign(signed)*dz/length*distance,z:z+Math.sign(signed)*dx/length*distance,dx,dz};
  });
  return lines.map((b,i)=>{
    const a=lines[(i+lines.length-1)%lines.length],cross=a.dx*b.dz-a.dz*b.dx;
    const t=((b.x-a.x)*b.dz-(b.z-a.z)*b.dx)/cross;
    return [a.x+t*a.dx,a.z+t*a.dz];
  });
}
