import * as THREE from "three";
import { createStool } from "./assets";

/** Photo-based dimensions estimated in metres: two stools and an intact heater panel. */
export function createHeater() {
  const group = new THREE.Group();
  group.name = "estufa";
  for (const x of [-.205, .205]) {
    const stool = createStool();
    stool.position.x = x;
    group.add(stool);
  }
  const panel = new THREE.Shape();
  const w = .43, h = .30, r = .009;
  panel.moveTo(-w+r,-h); panel.lineTo(w-r,-h);
  panel.quadraticCurveTo(w,-h,w,-h+r); panel.lineTo(w,h-r);
  panel.quadraticCurveTo(w,h,w-r,h); panel.lineTo(-w+r,h);
  panel.quadraticCurveTo(-w,h,-w,h-r); panel.lineTo(-w,-h+r);
  panel.quadraticCurveTo(-w,-h,-w+r,-h);
  for (const x of [-w+.022,w-.022]) for (const y of [-h+.022,h-.022]) {
    const hole = new THREE.Path();
    hole.absellipse(x,y,.004,.004,0,Math.PI*2,true,0);
    panel.holes.push(hole);
  }
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(panel, {
    depth:.012, bevelEnabled:true, bevelSize:.0015, bevelThickness:.001,
    bevelSegments:3, curveSegments:16, steps:1
  }), new THREE.MeshStandardMaterial({color:0xe5e4dc,roughness:.91,metalness:0}));
  slab.rotation.x = -Math.PI/2;
  slab.position.y = .462;
  group.add(slab);
  group.traverse(object => {
    if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  return group;
}
