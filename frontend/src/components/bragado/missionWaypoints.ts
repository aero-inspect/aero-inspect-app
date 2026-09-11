import * as T from 'three';
import catalog from '../../data/bragado-assets.json';

export const LAYER_HEIGHTS = [8, 20, 38] as const;
export function createWaypointLayer(scene: T.Scene, camera: T.PerspectiveCamera, canvas: HTMLCanvasElement, bounds: T.Box3[], onChange: (ids: string[]) => void) {
  const group = new T.Group();
  scene.add(group);
  const geometry = new T.SphereGeometry(1, 20, 14);
  const available = new T.MeshBasicMaterial({color: '#31dcff', toneMapped: false});
  const selected = new T.MeshBasicMaterial({color: '#0755ee', toneMapped: false});
  const lineMaterial = new T.MeshBasicMaterial({color: '#187bff', toneMapped: false});
  let layer = 0;
  let ids: string[] = [];
  let markers: T.Mesh[] = [];
  let boxes: T.Box3[] = [];
  let graph: T.Vector3[] = [];
  let neighbors: number[][] = [];
  let hover: T.Mesh | undefined;
  const numbers = new T.Group(), lines = new T.Group();
  group.add(numbers, lines);
  const ray = new T.Ray(), direction = new T.Vector3(), hit = new T.Vector3();
  const free = (p: T.Vector3) => !boxes.some(b => b.containsPoint(p));
  const clear = (a: T.Vector3, b: T.Vector3) => {
    const length = a.distanceTo(b);
    ray.set(a, direction.copy(b).sub(a).normalize());
    return !boxes.some(box => box.containsPoint(a) || box.containsPoint(b) || (ray.intersectBox(box, hit) !== null && hit.distanceTo(a) <= length));
  };
  function disposeChildren(g: T.Group) {
    for (const child of [...g.children]) {
      if (child instanceof T.Mesh) child.geometry.dispose();
      if (child instanceof T.Sprite) { child.material.map?.dispose(); child.material.dispose(); }
      g.remove(child);
    }
  }
  function route(a: T.Vector3, b: T.Vector3): T.Vector3[] {
    if (clear(a,b)) return [a,b];
    const nodes = [a,b,...graph];
    const distance = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
    distance[0] = 0;
    const startLinks = graph.flatMap((p,i) => clear(a,p) ? [i+2] : []);
    const endLinks = new Set(graph.flatMap((p,i) => clear(b,p) ? [i+2] : []));
    for (;;) {
      let current = -1;
      for(let i=0;i<nodes.length;i++) if(!visited.has(i) && Number.isFinite(distance[i]) && (current<0 || distance[i]<distance[current])) current=i;
      if(current<0) return [];
      if(current===1) break;
      visited.add(current);
      const links = current===0 ? startLinks : [...neighbors[current-2].map(i=>i+2), ...(endLinks.has(current)?[1]:[])];
      for(const next of links) { const cost=distance[current]+nodes[current].distanceTo(nodes[next]); if(cost<distance[next]) {distance[next]=cost;previous[next]=current;} }
    }
    const path: T.Vector3[]=[];
    for(let i=1;i>=0;i=previous[i]) path.unshift(nodes[i]);
    const simplified=[path[0]];
    for(let i=0;i<path.length-1;) {let j=path.length-1;while(j>i+1&&!clear(path[i],path[j])) j--;simplified.push(path[j]);i=j;}
    return simplified;
  }
  function setLayer(next: number) {
    if(ids.length || next<0 || next>2) return;
    layer=next;
    const y=LAYER_HEIGHTS[layer];
    boxes=bounds.map(b=>b.clone().expandByScalar(2.4)).filter(b=>b.min.y<=y&&b.max.y>=y);
    markers.forEach(m=>group.remove(m)); markers=[];
    graph=[]; neighbors=[];
    const grid=new Map<string,number>();
    for(let x=-108;x<=64;x+=4) for(let z=-128;z<=76;z+=4) { const p=new T.Vector3(x,y,z);if(free(p)){grid.set(`${x},${z}`,graph.length);graph.push(p);} }
    neighbors=graph.map(p=>{const result:number[]=[];for(const dx of [-4,0,4]) for(const dz of [-4,0,4]){if(!dx&&!dz)continue;const i=grid.get(`${p.x+dx},${p.z+dz}`);if(i!==undefined&&clear(p,graph[i])) result.push(i);}return result;});
    const candidates:T.Vector3[]=[];
    if (layer !== 2) {
      const silos=catalog.filter(asset=>asset.r>0);
      // Probe the free corridor between neighboring walls, including shared inspection points.
      for(let i=0;i<silos.length;i++) for(let j=i+1;j<silos.length;j++) {
        const a=silos[i],b=silos[j],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
        if(length-a.r-b.r>18) continue;
        const along=(length+a.r-b.r)/2;
        for(const offset of [0,-4,4,-8,8]) candidates.push(new T.Vector3(a.x+dx/length*along-dz/length*offset,y,a.z+dz/length*along+dx/length*offset));
      }
      // Interleave angles so every asset gets considered before adding its next side.
      for(let step=0;step<16;step++) for(const asset of catalog) {
        const angle=step*Math.PI/8,radius=(asset.r || (asset.type==='CELDA'?27:3))+3.8;
        candidates.push(new T.Vector3(asset.x+Math.cos(angle)*radius,y,asset.z+Math.sin(angle)*radius));
      }
    }
    if (layer === 2) {
      // At the upper altitude, sample above the footprints as well as their perimeter.
      for (const asset of catalog) candidates.push(new T.Vector3(asset.x,y,asset.z));
      const cell = catalog.find(asset => asset.type === 'CELDA');
      if (cell) for (const x of [-9,0,9]) for (const z of [-16,-8,0,8,16]) {
        const angle = Math.PI / 4;
        candidates.push(new T.Vector3(cell.x+x*Math.cos(angle)+z*Math.sin(angle),y,cell.z-x*Math.sin(angle)+z*Math.cos(angle)));
      }
      for (const asset of catalog) if (asset.r >= 8) for (let step=0;step<4;step++) {
        const angle=step*Math.PI/2;
        candidates.push(new T.Vector3(asset.x+Math.cos(angle)*8,y,asset.z+Math.sin(angle)*8));
      }
    }
    for(let ring=0;ring<3;ring++) for(const asset of catalog) for(let step=0;step<12;step++) {
      const angle=step*Math.PI/6+ring*.19, radius=(asset.r || (asset.type==='CELDA'?27:5))+7+ring*9;
      candidates.push(new T.Vector3(asset.x+Math.cos(angle)*radius,y,asset.z+Math.sin(angle)*radius));
    }
    const accepted:T.Vector3[]=[];
    for(const p of candidates) {
      if(accepted.length>=70) break;
      if(p.x < -98 || p.x>54 || p.z < -117 || p.z>65 || !free(p) || accepted.some(q=>q.distanceTo(p)<8)) continue;
      if(!graph.some(q=>q.distanceTo(p)<8&&clear(p,q))) continue;
      accepted.push(p);
    }
    accepted.forEach((p,i)=>{const m=new T.Mesh(geometry,available);m.position.copy(p);m.userData.id=`L${layer+1}-${i+1}`;group.add(m);markers.push(m);});
    canvas.dataset.waypointCount=String(markers.length);
    canvas.dataset.waypointLayer=String(layer+1);
  }
  function setSelection(next: string[]) {
    ids=[...new Set(next)].filter(id=>markers.some(m=>m.userData.id===id));
    disposeChildren(numbers);disposeChildren(lines);
    markers.forEach(m=>m.material=ids.includes(m.userData.id)?selected:available);
    ids.forEach((id,index)=>{
      const marker=markers.find(m=>m.userData.id===id)!;
      const c=document.createElement('canvas');c.width=c.height=128;
      const ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.font='bold 82px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(index+1),64,68);
      const texture=new T.CanvasTexture(c);
      const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));sprite.userData.marker=marker;numbers.add(sprite);
      if(!index)return;
      const previous=markers.find(m=>m.userData.id===ids[index-1])!;
      const path=route(previous.position,marker.position);
      for(let i=1;i<path.length;i++) {const delta=path[i].clone().sub(path[i-1]);const mesh=new T.Mesh(new T.CylinderGeometry(.12,.12,delta.length(),8),lineMaterial);mesh.position.copy(path[i]).add(path[i-1]).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());lines.add(mesh);}
    });
    canvas.dataset.selectedWaypoints=JSON.stringify(ids);
  }
  const caster=new T.Raycaster();
  function pick(e:PointerEvent) {
    const rect=canvas.getBoundingClientRect();caster.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    let best:T.Mesh|undefined, nearest=Infinity;
    for(const m of markers) { const point=caster.ray.intersectSphere(new T.Sphere(m.position,m.scale.x*1.45),new T.Vector3());if(point && point.distanceTo(camera.position)<nearest){best=m;nearest=point.distanceTo(camera.position);} }
    return best;
  }
  let down:PointerEvent|null=null;
  const pointerDown=(e:PointerEvent)=>{down=e;};
  const pointerMove=(e:PointerEvent)=>{hover=pick(e);canvas.style.cursor=hover?'pointer':'';};
  const pointerUp=(e:PointerEvent)=>{if(down&&down.button===0&&Math.hypot(e.clientX-down.clientX,e.clientY-down.clientY)<5){const m=pick(e);if(m&&!ids.includes(m.userData.id)){setSelection([...ids,m.userData.id]);onChange([...ids]);}}down=null;};
  const cancel=()=>{down=null;hover=undefined;canvas.style.cursor='';};
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerleave',cancel);
  setLayer(0);
  return {setLayer,setSelection,update(){
    const h=Math.max(1,canvas.clientHeight);
    markers.forEach(m=>{const depth=m.position.clone().applyMatrix4(camera.matrixWorldInverse).z;const radius=T.MathUtils.clamp(-depth*Math.tan(T.MathUtils.degToRad(camera.fov/2))*14/h,.3,1.6);m.scale.setScalar(radius*(m===hover?1.1:1));});
    numbers.children.forEach(s=>{const m=s.userData.marker as T.Mesh;const facing=camera.position.clone().sub(m.position).normalize();s.position.copy(m.position).addScaledVector(facing,m.scale.x*1.04);s.scale.setScalar(m.scale.x*1.4);});
  },destroy(){cancel();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',cancel);disposeChildren(numbers);disposeChildren(lines);group.removeFromParent();geometry.dispose();available.dispose();selected.dispose();lineMaterial.dispose();}};
}
