import * as T from 'three';
import catalog from '../../data/bragado-assets.json';
import type { BackendAsset } from '../../api/types';
import type { MissionRoutePoint } from './missionPlayback';
import { toPlantPosition } from './georeference';

export type AssetSelectionData = { assets: BackendAsset[]; selectedId: number | null; route: MissionRoutePoint[]; onSelect: (id: number | null) => void };
export function createAssetSelection(scene: T.Scene, camera: T.Camera, canvas: HTMLCanvasElement) {
  const proxies = new T.Group();
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const line = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: '#38c6e0', toneMapped: false}));
  scene.add(line);
  let data: AssetSelectionData | null = null;
  let down: {x:number;y:number;id:number} | null = null;
  let dragged = false;
  const ray = new T.Raycaster();
  const clear = () => { proxies.children.forEach(o => (o as T.Mesh).geometry.dispose()); proxies.clear(); };
  const pointerDown = (e: PointerEvent) => {if(e.button!==0)return;down={x:e.clientX,y:e.clientY,id:e.pointerId};dragged=false;};
  const pointerMove = (e: PointerEvent) => { if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)dragged=true; };
  const pointerUp = (e: PointerEvent) => {
    const start=down;down=null;
    if(!data||!start||start.id!==e.pointerId||dragged||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;
    const rect=canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    proxies.updateMatrixWorld(true);
    const hit=ray.intersectObjects(proxies.children,false)[0];
    if(!hit)return;
    const surface=ray.intersectObjects(scene.children,true).find(h=>h.object instanceof T.Mesh && !(Array.isArray(h.object.material)?h.object.material:[h.object.material]).every(m=>m.transparent));
    if(surface&&surface.distance<hit.distance-.2)return;
    const id=hit.object.userData.idAsset as number;
    data.onSelect(data.selectedId===id?null:id);
  };
  const cancel = () => { down=null; };
  canvas.addEventListener('pointerdown',pointerDown);
  canvas.addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointercancel',cancel);
  return {
    update(next: AssetSelectionData) {
      data=next;clear();
      for(const asset of next.assets) {
        if(!['SILO','SILO_FLOTANTE','CELDA'].includes(asset.type))continue;
        const record=catalog.find(r=>r.code===asset.code&&r.type===asset.type);
        if(!record)continue;
        const height=record.h+record.r*.3;
        const mesh=new T.Mesh(record.r?new T.CylinderGeometry(record.r,record.r,height,48):new T.BoxGeometry(27,14,43),material);
        mesh.position.set(record.x,height/2,record.z);
        if(asset.type==='CELDA')mesh.rotation.y=Math.PI/4;
        mesh.userData.idAsset=asset.idAsset;proxies.add(mesh);
      }
      line.geometry.dispose();
      line.geometry=new T.BufferGeometry().setFromPoints([...next.route].sort((a,b)=>a.sequence-b.sequence).map(toPlantPosition).filter((p):p is T.Vector3=>p!==null));
    },
    destroy(){clear();material.dispose();line.geometry.dispose();line.material.dispose();line.removeFromParent();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',cancel);}
  };
}
