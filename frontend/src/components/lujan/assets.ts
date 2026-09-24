import * as THREE from "three";
import type { BackendAsset } from "../../api/types";
import { isInsideLujan, lujanToLocal } from "../../data/plants";
import type { MapFilters } from "../BragadoPlant3DMap";
import { BACKEND_ASSET_TYPE_LABELS } from "../../api/constants";

const statuses={ACTIVE:"Activo",MAINTENANCE:"En mantenimiento",OUT_OF_SERVICE:"Fuera de servicio",UNCONFIRMED:"Sin confirmar"};
export function savedLujanAssets(assets:BackendAsset[],filters?:MapFilters) {
  return assets.filter(asset=>{
    const [x,z]=lujanToLocal(asset.latitude,asset.longitude);
    return asset.idAsset>0 && asset.type==="BANQUETA" && isInsideLujan(x,z)
      && (!filters || filters.type==="Todos" || filters.type===BACKEND_ASSET_TYPE_LABELS[asset.type])
      && (!filters || filters.status==="Todos" || filters.status===statuses[asset.status])
      && (!filters?.search || `${asset.name} ${asset.code}`.toLocaleLowerCase().includes(filters.search.trim().toLocaleLowerCase()));
  });
}

/** Black molded plastic stool, 46 cm tall, with a hand hole and splayed legs. */
export function createStool() {
  const root=new THREE.Group();root.name="banqueta";
  const plastic=new THREE.MeshStandardMaterial({color:"#202426",roughness:.72});
  const top=new THREE.Shape();
  const w=.17,r=.025;
  top.moveTo(-w+r,-w);top.lineTo(w-r,-w);top.quadraticCurveTo(w,-w,w,-w+r);
  top.lineTo(w,w-r);top.quadraticCurveTo(w,w,w-r,w);top.lineTo(-w+r,w);
  top.quadraticCurveTo(-w,w,-w,w-r);top.lineTo(-w,-w+r);top.quadraticCurveTo(-w,-w,-w+r,-w);
  const hole=new THREE.Path();hole.absellipse(0,0,.035,.013,0,Math.PI*2,true,0);top.holes.push(hole);
  const seat=new THREE.Mesh(new THREE.ExtrudeGeometry(top,{depth:.032,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2,steps:1}),plastic);
  seat.rotation.x=-Math.PI/2;seat.position.y=.425;root.add(seat);
  const bar=(a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number)=>{
    const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.BoxGeometry(width,delta.length(),depth),plastic);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());root.add(mesh);
  };
  for(const x of [-1,1]) for(const z of [-1,1]) {
    bar(new THREE.Vector3(x*.18,.015,z*.18),new THREE.Vector3(x*.135,.425,z*.135),.055,.055);
  }
  for(const sign of [-1,1]) {
    bar(new THREE.Vector3(-.157,.18,sign*.157),new THREE.Vector3(.157,.18,sign*.157),.028,.03);
    bar(new THREE.Vector3(sign*.157,.18,-.157),new THREE.Vector3(sign*.157,.18,.157),.028,.03);
    bar(new THREE.Vector3(-.14,.39,sign*.14),new THREE.Vector3(.14,.39,sign*.14),.052,.032);
  }
  root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return root;
}
export function disposeAssetGroup(group:THREE.Group) {
  const materials=new Set<THREE.Material>();
  group.traverse(o=>{if(o instanceof THREE.Mesh || o instanceof THREE.Line){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
  materials.forEach(m=>m.dispose());group.clear();
}
