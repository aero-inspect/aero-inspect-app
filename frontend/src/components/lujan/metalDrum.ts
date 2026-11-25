import * as THREE from "three";

/** Low drum from the reference photos, restored finish; approximate dimensions in metres. */
export function createMetalDrum() {
  const root = new THREE.Group();
  root.name = "tambor-metalico";
  const blue = new THREE.MeshStandardMaterial({color:0x0879bf, metalness:.45, roughness:.3});
  const cream = new THREE.MeshStandardMaterial({color:0xd8dbd2, metalness:.4, roughness:.36});
  const steel = new THREE.MeshStandardMaterial({color:0xb7c2c8, metalness:.78, roughness:.32});
  const radius = .29;
  const cylinder = (r:number, height:number, y:number, material:THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,height,96),material);
    mesh.position.y=y; root.add(mesh);
  };
  const ring = (y:number, r:number, thickness:number, material:THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r,thickness,12,96),material);
    mesh.rotation.x=Math.PI/2; mesh.position.y=y; root.add(mesh);
  };
  cylinder(radius,.23,.115,blue);
  cylinder(radius,.10,.28,cream);
  for (const y of [.055,.105,.155,.205]) ring(y,radius-.002,.006,blue);
  ring(.009,radius,.006,blue);
  cylinder(radius-.004,.005,.329,steel);
  ring(.337,radius,.005,steel);
  // Raised rolled rim surrounding the slightly recessed lid.
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.015,96,1,true),steel);
  rim.position.y=.331; root.add(rim);
  root.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  return root;
}
