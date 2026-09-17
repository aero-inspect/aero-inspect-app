import * as T from 'three';
import catalog from '../../data/bragado-assets.json';
import type { BackendAsset } from '../../api/types';
import type { MissionRoutePoint } from './missionPlayback';
import { toPlantPosition } from './georeference';

export type AssetSelectionData = {
  assets: BackendAsset[];
  selectedIds: number[];
  route: MissionRoutePoint[];
  onSelect: (id: number) => void;
  onHover?: (id: number | null, position?: { x: number; y: number }) => void;
};
export function createAssetSelection(scene: T.Scene, camera: T.Camera, canvas: HTMLCanvasElement) {
  const proxies = new T.Group();
  const selectedMeshes = new T.Group();
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide, transparent: true, opacity: 0 });
  const selectedMaterial = new T.MeshBasicMaterial({ color: '#3fbd68', transparent: true, opacity: .24, depthWrite: false, side: T.DoubleSide });
  const line = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: '#38c6e0', toneMapped: false}));
  scene.add(line, selectedMeshes);
  let data: AssetSelectionData | null = null;
  let down: {x:number;y:number;id:number} | null = null;
  let dragged = false;
  const ray = new T.Raycaster();
  const clear = () => {
    proxies.children.forEach(o => (o as T.Mesh).geometry.dispose());
    selectedMeshes.children.forEach(o => (o as T.Mesh).geometry.dispose());
    proxies.clear();
    selectedMeshes.clear();
  };
  const pointerDown = (e: PointerEvent) => {if(e.button!==0)return;down={x:e.clientX,y:e.clientY,id:e.pointerId};dragged=false;};
  const pick = (e: PointerEvent) => {
    const rect=canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    proxies.updateMatrixWorld(true);
    const hit=ray.intersectObjects(proxies.children,false)[0];
    if(!hit)return null;
    const surface=ray.intersectObjects(scene.children,true).find(h=>h.object instanceof T.Mesh && !(Array.isArray(h.object.material)?h.object.material:[h.object.material]).every(m=>m.transparent));
    if(surface&&surface.distance<hit.distance-.2)return null;
    return hit.object.userData.idAsset as number;
  };
  const pointerMove = (e: PointerEvent) => {
    if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)dragged=true;
    if(!data?.onHover || down)return;
    const rect=canvas.getBoundingClientRect();
    const id=pick(e);
    canvas.style.cursor=id===null?'':'pointer';
    data.onHover(id,{x:e.clientX-rect.left,y:e.clientY-rect.top});
  };
  const pointerLeave = () => {
    canvas.style.cursor='';
    data?.onHover?.(null);
  };
  const pointerUp = (e: PointerEvent) => {
    const start=down;down=null;
    if(!data||!start||start.id!==e.pointerId||dragged||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;
    const id=pick(e);
    if(id===null)return;
    data.onSelect(id);
  };
  const cancel = () => { down=null; };
  canvas.addEventListener('pointerdown',pointerDown);
  canvas.addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('pointerleave',pointerLeave);
  return {
    update(next: AssetSelectionData) {
      data=next;clear();
      for(const asset of next.assets) {
        if(!['SILO','SILO_FLOTANTE','CELDA','NORIA','SECADORA'].includes(asset.type))continue;
        const record=catalog.find(r=>r.code===asset.code&&r.type===asset.type);
        if(!record)continue;
        const height=record.h+record.r*.3;
        const size = asset.type === 'CELDA' ? [27,14,43] : asset.type === 'SECADORA' ? [4.8,11.2,4.4] : [5.5,record.h,5.5];
        const geometry=record.r?new T.CylinderGeometry(record.r,record.r,height,48):new T.BoxGeometry(size[0],size[1],size[2]);
        const mesh=new T.Mesh(geometry,material);
        mesh.position.set(record.x,height/2,record.z);
        if(asset.type==='CELDA')mesh.rotation.y=Math.PI/4;
        mesh.userData.idAsset=asset.idAsset;proxies.add(mesh);
        if(next.selectedIds.includes(asset.idAsset)){
          const selected=new T.Mesh(geometry.clone(),selectedMaterial);
          selected.position.copy(mesh.position);selected.rotation.copy(mesh.rotation);selected.scale.setScalar(1.06);
          selectedMeshes.add(selected);
        }
      }
      line.geometry.dispose();
      line.geometry=new T.BufferGeometry().setFromPoints([...next.route].sort((a,b)=>a.sequence-b.sequence).map(toPlantPosition).filter((p):p is T.Vector3=>p!==null));
    },
    destroy(){clear();material.dispose();selectedMaterial.dispose();line.geometry.dispose();line.material.dispose();line.removeFromParent();selectedMeshes.removeFromParent();canvas.style.cursor='';canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',pointerLeave);}
  };
}
