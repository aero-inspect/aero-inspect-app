import * as THREE from "three";
import { footprintLocal, polygonCenter, insetConvex } from "./footprints";
import { LUJAN_LOCAL_BOUNDS, LUJAN_PATIO, lujanToLocal } from "../../data/plants";

// Metric reconstruction of the user's Google Earth polygons.
// Horizontal outlines are imported; heights and facade details follow the photos.
const ANGLE = Math.atan2(0.76, 0.65);
const C = Math.cos(ANGLE), S = Math.sin(ANGLE);
export function houseToWorld(u: number, v: number, y = 0) {
  return new THREE.Vector3(C * u - S * v, y, S * u + C * v);
}

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function texture(kind: "grass" | "soil" | "stucco" | "stone" | "roof" | "water") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const random = seeded(4817);
  const colors = { grass: [105,119,71], soil: [108,87,66], stucco: [234,235,231], stone: [109,111,104], roof: [166,167,160], water: [28,133,178] };
  const base = colors[kind];
  const noiseGrids=[5,13,37].map(size=>({size,values:Array.from({length:(size+1)*(size+1)},()=>random())}));
  const noiseAt=(x:number,y:number,grid:typeof noiseGrids[number])=>{
    const gx=x/512*grid.size,gy=y/512*grid.size,ix=Math.floor(gx),iy=Math.floor(gy);
    const fx=gx-ix,fy=gy-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),n=grid.size+1;
    const a=grid.values[iy*n+ix]*(1-sx)+grid.values[iy*n+ix+1]*sx;
    const b=grid.values[(iy+1)*n+ix]*(1-sx)+grid.values[(iy+1)*n+ix+1]*sx;
    return a*(1-sy)+b*sy-.5;
  };
  const pixels = ctx.createImageData(512,512);
  for (let y=0;y<512;y++) for (let x=0;x<512;x++) {
    const i=(y*512+x)*4;
    const wave=noiseAt(x,y,noiseGrids[0])*20+noiseAt(x,y,noiseGrids[1])*14+noiseAt(x,y,noiseGrids[2])*9;
    const noise=(random()-.5)*(kind === "stucco" ? 15 : 35) + (kind === "grass" || kind === "soil" ? wave : 0);
    pixels.data[i]=base[0]+noise; pixels.data[i+1]=base[1]+noise; pixels.data[i+2]=base[2]+noise;
    pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  if (kind === "grass") {
    for (let i=0;i<16000;i++) {
      const x=random()*512,y=random()*512;
      ctx.strokeStyle=`rgba(${random()>.5 ? "156,153,92" : "58,83,39"},.35)`;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1,y-2-random()*5);ctx.stroke();
    }
  }
  if (kind === "stone") {
    ctx.fillStyle="#686962";ctx.fillRect(0,0,512,512);
    for(let row=0;row<18;row++) {
      let x=-random()*70;
      while(x<512) {
        const w=30+random()*90,h=24+random()*4,shade=95+random()*70;
        ctx.fillStyle=`rgb(${shade},${shade+2},${shade-5})`;
        ctx.fillRect(x,row*28.5,w-3,h);
        ctx.fillStyle="rgba(255,255,255,.2)";ctx.fillRect(x,row*28.5,w-3,2);
        ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillRect(x+2,row*28.5+10,w-8,1);
        x+=w;
      }
    }
  }
  if(kind === "water") {
    for(let i=0;i<75;i++) {
      ctx.strokeStyle="rgba(163,235,244,.24)";ctx.lineWidth=.7+random()*1.5;
      ctx.beginPath();const y=random()*512;
      for(let x=0;x<=512;x+=8) {const yy=y+Math.sin(x*.04+i)*4; x ? ctx.lineTo(x,yy) : ctx.moveTo(x,yy);}
      ctx.stroke();
    }
  }
  const result=new THREE.CanvasTexture(canvas);
  result.colorSpace=THREE.SRGBColorSpace;result.wrapS=result.wrapT=THREE.RepeatWrapping;
  result.anisotropy=8;
  return result;
}

export function buildLujan() {
  const root=new THREE.Group();
  const site=new THREE.Group();site.rotation.y=-ANGLE;root.add(site);
  const mat=(color:string,roughness=.85,map?:THREE.Texture)=>new THREE.MeshStandardMaterial({color,roughness,...(map ? {map} : {})});
  const stucco=texture("stucco");stucco.repeat.set(2,2);
  const white=mat("#ffffff",.93,stucco),gray=mat("#929196",.92,stucco);
  const darkGray=mat("#737476",.9,stucco),black=mat("#202525",.6);
  const stoneTex=texture("stone");stoneTex.repeat.set(1.8,1.3);
  const stone=mat("#ffffff",.95,stoneTex);
  const roofTex=texture("roof");roofTex.repeat.set(3,3);
  const roofMat=mat("#d7d5ce",.97,roofTex);
  const paving=mat("#c5bdad"),joint=mat("#96968b"),wood=mat("#45352b");
  const glass=new THREE.MeshPhysicalMaterial({color:"#688180",metalness:.22,roughness:.12,clearcoat:1,transparent:true,opacity:.56});
  const curtain=mat("#d0d1c1",1),interior=mat("#464943");
  function box(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function localBox(u:number,y:number,v:number,w:number,h:number,d:number,m:THREE.Material) {return box(site,u,y,v,w,h,d,m);}
  function rod(parent:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material) {
    const delta=b.clone().sub(a);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),m);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  function groundPolygon(points:number[][],height:number,m:THREE.Material) {
    const shape=new THREE.Shape(points.map(([u,v])=>new THREE.Vector2(u,-v)));
    const geo=new THREE.ShapeGeometry(shape);
    const pos=geo.getAttribute("position"),uv=geo.getAttribute("uv");
    for(let i=0;i<pos.count;i++) uv.setXY(i,pos.getX(i)/12,pos.getY(i)/12);
    const mesh=new THREE.Mesh(geo,m);mesh.rotation.x=-Math.PI/2;mesh.position.y=height;mesh.receiveShadow=true;site.add(mesh);
    return mesh;
  }
  const bounds=LUJAN_LOCAL_BOUNDS;
  const uvBounds=bounds.map(([x,z])=>[C*x+S*z,-S*x+C*z]);
  const grassTexture=texture("grass");
  groundPolygon(uvBounds,0,mat("#ffffff",1,grassTexture));
  // The visible fence and picking boundary share the exact supplied GPS anchors.
  const fenceBounds=uvBounds;
  const soil=mat("#e0d3bd",1,texture("soil"));
  // Bare earth around the recently completed house, as shown in the photographs.
  groundPolygon([[-7,-7.6],[12,-7.6],[12,10],[5,10],[5,14.8],[-3,14.8],[-4,8.1],[-3,4.8],[-4,-3.7],[-7,-3.7]],.012,soil);
  const patchCanvas=document.createElement("canvas");patchCanvas.width=patchCanvas.height=128;
  const patchContext=patchCanvas.getContext("2d")!;
  const patchPixels=patchContext.createImageData(128,128);const patchRandom=seeded(415);
  for(let y=0;y<128;y++) for(let x=0;x<128;x++) {
    const edge=Math.max(0,1-Math.hypot((x-64)/64,(y-64)/64));
    const shade=Math.max(0,Math.min(255,(edge*1.8-.18+Math.sin(x*.19)*Math.cos(y*.17)*.14)*255))*(.35+patchRandom()*.65);
    const i=(y*128+x)*4;patchPixels.data[i]=patchPixels.data[i+1]=patchPixels.data[i+2]=shade;patchPixels.data[i+3]=255;
  }
  patchContext.putImageData(patchPixels,0,0);
  const patchAlpha=new THREE.CanvasTexture(patchCanvas);
  const patchMaterial=new THREE.MeshStandardMaterial({color:"#b0b486",map:grassTexture,alphaMap:patchAlpha,transparent:true,depthWrite:false,roughness:1});
  const patchGeometry=new THREE.PlaneGeometry(1,1);
  const rng=seeded(981);
  for(let i=0;i<85;i++) {
    const u=-14+rng()*20,v=-4+rng()*18;
    // Uneven grass islands in the unfinished courtyard, avoiding pool and building.
    if((u>-3 && u<3 && v>-5 && v<5) || (u>0 && v>8)) continue;
    const radius=.4+rng()*1.6;
    const patch=new THREE.Mesh(patchGeometry,patchMaterial);
    patch.rotation.x=-Math.PI/2;patch.rotation.z=rng()*Math.PI;
    patch.scale.set(radius*2,radius*1.3,1);patch.position.set(u,.035,v);patch.receiveShadow=true;site.add(patch);
  }
  type Opening={at:number;width:number;height:number;bottom?:number;door?:boolean;metal?:boolean;curtains?:boolean};
  // Each facade is built around actual holes. Frames, glass, recessed curtain folds
  // and entrance door sit inside the opening rather than painted onto a solid wall.
  function facade(u:number,v:number,length:number,h:number,axis:"u"|"v",m:THREE.Material,openings:Opening[]=[],reverse=false) {
    const g=new THREE.Group();g.position.set(u,0,v);g.rotation.y=axis === "v" ? Math.PI/2 : 0;
    if(reverse) g.rotation.y+=Math.PI;site.add(g);
    const sorted=[...openings].sort((a,b)=>a.at-b.at);
    let left=-length/2;
    for(const o of sorted) {
      const a=o.at-o.width/2,b=o.at+o.width/2,bottom=o.bottom??.15,top=bottom+o.height;
      if(a>left) box(g,(left+a)/2,h/2,0,a-left,h,.22,m);
      if(bottom>0) box(g,o.at,bottom/2,0,o.width,bottom,.22,m);
      if(top<h) box(g,o.at,(top+h)/2,0,o.width,h-top,.22,m);
      const pane=o.door ? (o.metal ? darkGray : wood) : glass;
      box(g,o.at,bottom+o.height/2,0,o.width-.08,o.height-.08,.07,pane);
      for(const x of [a+.035,b-.035]) box(g,x,bottom+o.height/2,.035,.07,o.height,.12,black);
      for(const y of [bottom+.035,top-.035]) box(g,o.at,y,.035,o.width,.07,.12,black);
      if(o.door) {
        box(g,b-.19,bottom+1.05,.10,.028,.58,.03,mat("#c5c7c2",.25));
        if(o.metal) {
          // Inset steel panel, ventilated upper/lower grilles and exposed hinges.
          box(g,o.at,bottom+o.height*.48,.05,o.width-.20,o.height-.76,.025,darkGray);
          for(const y of [bottom+.16,top-.23]) {
            const grilleHeight=y>top-.5 ? .32 : .16;
            box(g,o.at,y,.06,o.width-.16,grilleHeight,.025,black);
            for(let x=a+.10;x<b-.08;x+=.075) box(g,x,y,.083,.012,grilleHeight,.015,gray);
            for(let yy=y-grilleHeight/2;yy<y+grilleHeight/2;yy+=.06) box(g,o.at,yy,.09,o.width-.16,.010,.015,gray);
          }
          for(const y of [bottom+.42,top-.58]) box(g,a+.035,y,.13,.065,.16,.06,black);
          box(g,b-.16,bottom+1.02,.13,.14,.025,.035,black);
        } else box(g,o.at,top+.17,.02,o.width,.18,.05,glass);
      } else {
        const panels=o.width>2 ? 3 : 2;
        for(let i=1;i<panels;i++) box(g,a+i*o.width/panels,bottom+o.height/2,.065,.045,o.height,.08,black);
        if(o.curtains) for(let x=a+.10;x<b-.08;x+=.11) {
          box(g,x,bottom+o.height/2,-.14,.10,o.height-.14,.035,curtain).rotation.y=Math.sin(x*20)*.16;
        }
        else box(g,o.at,bottom+o.height/2,-.32,o.width-.12,o.height-.12,.03,interior);
      }
      left=b;
    }
    if(left<length/2) box(g,(left+length/2)/2,h/2,0,length/2-left,h,.22,m);
    return g;
  }
  // Horizontal footprints come directly from the user's Google Earth polygons.
  // Height, openings and surface finishes remain interpretations of the photos.
  const toHouse=([x,z]:[number,number]):[number,number]=>[C*x+S*z,-S*x+C*z];
  const house=footprintLocal("Casa").map(toHouse);
  const pool=footprintLocal("Pileta").map(toHouse);
  const parking=footprintLocal("Estacionamiento").map(toHouse);
  const houseRoof=groundPolygon(house,3.35,roofMat);houseRoof.name="lujan-house-footprint";
  groundPolygon(house,.08,paving);
  const gallery=new THREE.Group();gallery.name="lujan-gallery";site.add(gallery);
  const courtyardEdges=new Set([15,16,17,18]);
  house.forEach(([u,v],i)=>{
    const [nu,nv]=house[(i+1)%house.length],du=nu-u,dv=nv-v;
    const length=Math.hypot(du,dv),angle=-Math.atan2(dv,du);
    const isOpenGallery=i===19 || i===20;
    // These short roof-outline edges cover the entrance porch, not solid walls.
    const isEntrancePorch=i===7 || i===8;
    const material=i===0 || i===21 ? darkGray : courtyardEdges.has(i) || (i>=6 && i<=12) ? gray : white;
    const openings:Opening[]=[];
    if(i===21) {
      // Service doors on the outer gallery face, as in the close-up photo.
      const count=Math.floor((length-.7)/1.05);
      for(let j=0;j<count;j++) openings.push({at:(j-(count-1)/2)*1.05,width:.95,height:2.55,door:true,metal:true});
    } else if(i===6) {
      openings.push({at:0,width:1.25,height:2.55,door:true});
    } else if(courtyardEdges.has(i) && length>2.8) {
      const count=Math.max(1,Math.floor(length/4.6));
      for(let j=0;j<count;j++) openings.push({at:(j-(count-1)/2)*length/count,width:Math.min(3,length/count-1),height:2.45,curtains:i===15});
    } else if([1,3,4,5,14].includes(i) && length>2.2) {
      const fullHeight=i===3 || i===14;
      openings.push({at:0,width:Math.min(i===5 ? 1.85 : 2.4,length-.8),height:fullHeight ? 2.45 : .9,bottom:fullHeight ? .15 : 1.2,curtains:true});
    }
    if(!isOpenGallery && !isEntrancePorch) {
      const wall=facade((u+nu)/2,(v+nv)/2,length,3.35,"u",material,openings);
      wall.rotation.y=angle;
      if(i===21 || i===0) gallery.attach(wall);
    } else if(isOpenGallery) {
      for(const t of [.035,.965]) {
        const column=localBox(u+du*t,1.63,v+dv*t,.25,3.26,.25,gray);
        gallery.attach(column);
      }
    }
    const edge=localBox((u+nu)/2,3.35,(v+nv)/2,length,.24,.16,white);edge.rotation.y=angle;
    const parapet=localBox((u+nu)/2,3.57,(v+nv)/2,length,.32,.16,i>=12 && i<=15 ? white : gray);parapet.rotation.y=angle;
    if(courtyardEdges.has(i)) {
      const trim=localBox((u+nu)/2,3.04,(v+nv)/2,length,.6,.24,white);trim.rotation.y=angle;
    }
    if(!isOpenGallery && !isEntrancePorch && length>2) {
      const light=localBox(u+du*.16,.8,v+dv*.16,.15,.22,.26,black);light.rotation.y=angle;
    }
  });
  // Furnish the open gallery within its newly traced footprint.
  const galleryOutline=[house[19],house[20],house[21],house[0],house[1]];
  const [gu,gv]=polygonCenter(galleryOutline);
  const timber=mat("#aea28d");
  const galleryBox=(u:number,y:number,v:number,w:number,h:number,d:number,m:THREE.Material)=>box(gallery,u,y,v,w,h,d,m);
  galleryBox(gu,.85,gv,2.8,.11,1.25,timber);
  for(const u of [gu-1.05,gu+1.05]) for(const v of [gv-.4,gv+.4]) galleryBox(u,.43,v,.10,.85,.10,timber);
  for(const v of [gv-1,gv+1]) {
    galleryBox(gu,.48,v,2.8,.1,.35,timber);
    for(const u of [gu-1.05,gu+1.05]) galleryBox(u,.24,v,.10,.48,.22,timber);
  }
  // Grill and sink sit just inside the service wall, aligned to that wall.
  const serviceA=house[21],serviceB=house[0];
  const serviceLength=Math.hypot(serviceB[0]-serviceA[0],serviceB[1]-serviceA[1]);
  const serviceAngle=-Math.atan2(serviceB[1]-serviceA[1],serviceB[0]-serviceA[0]);
  const kitchen=new THREE.Group();kitchen.position.set((serviceA[0]+serviceB[0])/2,0,(serviceA[1]+serviceB[1])/2);kitchen.rotation.y=serviceAngle;gallery.add(kitchen);
  box(kitchen,0,.87,-.65,3.5,.13,.85,paving);
  box(kitchen,-.75,1.35,-.2,1.9,.9,.08,black);
  box(kitchen,1.2,.45,-.65,1.0,.8,.8,darkGray);
  box(kitchen,1.2,.95,-.65,.6,.035,.42,black);
  box(kitchen,1.2,1.13,-.93,.03,.35,.03,black);
  // Tiled service passage is estimated, while the wall stays at the KML edge.
  const passage=box(kitchen,0,.04,.65,serviceLength,.08,1.3,paving);
  passage.name="lujan-service-passage";
  for(let x=-serviceLength/2;x<serviceLength/2;x+=.7) box(kitchen,x,.084,.65,.012,.003,1.3,joint);
  // Front approach: concrete parking on the right, gravel-separated stepping
  // slabs on the left, and a tall stone screen beside the recessed front door.
  const doorA=house[6],doorB=house[7];
  const entrance=[(doorA[0]+doorB[0])/2,(doorA[1]+doorB[1])/2];
  const entranceFrame=new THREE.Group();entranceFrame.position.set(entrance[0],0,entrance[1]);
  const driveDirection=new THREE.Vector2(parking[1][0]-parking[0][0],parking[1][1]-parking[0][1]).normalize();
  entranceFrame.rotation.y=Math.atan2(driveDirection.x,driveDirection.y);site.add(entranceFrame);
  entranceFrame.name="lujan-front-approach";
  const concreteTex=texture("stucco");concreteTex.repeat.set(5,5);
  const concrete=mat("#918c80",.76,concreteTex);
  const gravel=mat("#ddd5bf",1);
  box(entranceFrame,0,.045,1.0,3.25,.09,2.0,concrete);
  // Photo: the screen projects perpendicular to the gray facade, separating
  // pedestrians from the parking slab. Its foot is surrounded by pale stones.
  box(entranceFrame,1.4,.02,7.7,.72,.04,4.0,gravel);
  box(entranceFrame,1.4,1.7,7.7,.32,3.4,3.8,stone);
  box(entranceFrame,1.4,3.44,7.7,.38,.12,3.9,gray);
  for(const z of [6.0,9.0]) {
    box(entranceFrame,1.215,.48,z,.06,.28,.18,black);
    box(entranceFrame,1.18,.49,z,.015,.17,.10,mat("#d3c79b"));
  }
  // Long rectangular slabs with white gravel joints, at garden level.
  const walkLength=20,walkWidth=1.85;
  box(entranceFrame,0,.025,walkLength/2+1,walkWidth+.16,.05,walkLength,gravel);
  for(let z=2.1;z<walkLength;z+=1.55) {
    box(entranceFrame,0,.09,z,walkWidth,.12,1.15,concrete);
    // Sparse pebbles at exposed joints, deterministic and instanced.
  }
  const pebbleGeometry=new THREE.IcosahedronGeometry(.042,0);
  const pebbles=new THREE.InstancedMesh(pebbleGeometry,gravel,700);
  const pebbleRandom=seeded(712),pebbleMatrix=new THREE.Matrix4();
  for(let i=0;i<700;i++) {
    const jointIndex=Math.floor(pebbleRandom()*12),z=2.1+jointIndex*1.55+.61+pebbleRandom()*.30;
    pebbleMatrix.compose(new THREE.Vector3((pebbleRandom()-.5)*walkWidth,.067,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pebbleRandom(),pebbleRandom()*6,pebbleRandom())),new THREE.Vector3(1,.55+pebbleRandom()*.45,1));
    pebbles.setMatrixAt(i,pebbleMatrix);
  }
  pebbles.receiveShadow=true;entranceFrame.add(pebbles);
  // Broad gray lintel over the recessed doorway, as seen from the parking.
  const entranceLintel=localBox(entrance[0],2.98,entrance[1],Math.hypot(doorB[0]-doorA[0],doorB[1]-doorA[1]),.74,.32,gray);
  entranceLintel.rotation.y=-Math.atan2(doorB[1]-doorA[1],doorB[0]-doorA[0]);
  // Roof vents preserve the material and height cues from the photographs.
  const ventMat=mat("#494e4c",.7);
  for(const [u,v] of [[1,-11],[12,3],[gu,gv]]) {
    rod(site,new THREE.Vector3(u,3.4,v),new THREE.Vector3(u,3.95,v),.13,ventMat);
    localBox(u,3.98,v,.37,.08,.37,ventMat);
  }
  // Pool contour is the KML outer edge. Inset the liner/water by 35 cm for coping.
  const coping=mat("#e4dfc9",.9),liner=mat("#096ba2",.4);
  const copingMesh=groundPolygon(pool,.13,coping);copingMesh.name="lujan-pool-footprint";
  const inner=insetConvex(pool,.35);
  groundPolygon(inner,.14,liner);
  const waterTexture=texture("water");waterTexture.repeat.set(1,2);
  const waterMat=new THREE.MeshPhysicalMaterial({color:"#78c9dc",map:waterTexture,transparent:true,opacity:.84,roughness:.14,metalness:.15,clearcoat:1});
  const water=groundPolygon(insetConvex(pool,.43),.17,waterMat);water.name="lujan-pool-water";
  // Low vertical liner and coping seams aligned to the actual pool sides.
  pool.forEach(([u,v],i)=>{
    const [nu,nv]=pool[(i+1)%pool.length],du=nu-u,dv=nv-v,length=Math.hypot(du,dv);
    const trim=localBox((u+nu)/2,.065,(v+nv)/2,length,.13,.05,coping);trim.rotation.y=-Math.atan2(dv,du);
    for(let t=.6;t<length;t+=.6) {
      const seam=localBox(u+du*t/length,.132,v+dv*t/length,.012,.003,.38,joint);seam.rotation.y=-Math.atan2(dv,du);
    }
  });
  const [poolU,poolV]=polygonCenter(pool);
  localBox(poolU-4.4,.28,poolV+3.7,1.25,.56,.95,gray);
  localBox(poolU-4.4,.58,poolV+3.7,1.3,.05,1,black);
  // Parking deliberately extends beyond the parcel, exactly as the submitted KML.
  const parkingMesh=groundPolygon(parking,.055,concrete);parkingMesh.name="lujan-parking-footprint";
  // The KML marks the outer approach. The photos show concrete continuing right
  // up to the gray wall, so fill the small gap without moving either KML contour.
  groundPolygon([house[9],house[10],parking[3],parking[0]],.055,concrete);
  // Fine slab joints across the driveway instead of a featureless beige plane.
  for(let t=.2;t<1;t+=.2) {
    const a=new THREE.Vector3(parking[0][0]+(parking[1][0]-parking[0][0])*t,.058,parking[0][1]+(parking[1][1]-parking[0][1])*t);
    const b=new THREE.Vector3(parking[3][0]+(parking[2][0]-parking[3][0])*t,.058,parking[3][1]+(parking[2][1]-parking[3][1])*t);
    site.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:"#777569",transparent:true,opacity:.4})));
  }
  // Low rust-colored posts and wire mesh: gate openings are left on the access side.
  const fence=mat("#87513a"),wireMat=new THREE.LineBasicMaterial({color:"#777e6a",transparent:true,opacity:.48});
  fenceBounds.forEach(([u,v],index)=>{
    const [nu,nv]=fenceBounds[(index+1)%fenceBounds.length];const length=Math.hypot(nu-u,nv-v),count=Math.ceil(length/2.9);
    const gate=(t:number)=>index===2 && t>.2 && t<.79;
    for(let i=0;i<count;i++) {const t=i/count;if(gate(t)) continue;localBox(u+(nu-u)*t,.6,v+(nv-v)*t,.11,1.2,.11,fence);}
    const points:THREE.Vector3[]=[];
    for(let j=0;j<Math.ceil(length/.22);j++) {
      const t=j*.22/length,tt=Math.min(1,(j+1)*.22/length);if(gate(t))continue;
      for(const y of [.25,.55,.85]) {
        points.push(new THREE.Vector3(u+(nu-u)*t,y,v+(nv-v)*t),new THREE.Vector3(u+(nu-u)*tt,y+.26,v+(nv-v)*tt));
        points.push(new THREE.Vector3(u+(nu-u)*t,y+.26,v+(nv-v)*t),new THREE.Vector3(u+(nu-u)*tt,y,v+(nv-v)*tt));
      }
    }
    const fenceMesh=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),wireMat);
    fenceMesh.name=`lujan-fence-${index}`;site.add(fenceMesh);
  });
  // Two young, sparsely leafed trees near the garden fence.
  const bark=mat("#777464"),leaves=mat("#788365");
  for(const [u,v] of [[-11,17.8],[-6.5,15.8]]) {
    rod(site,new THREE.Vector3(u,0,v),new THREE.Vector3(u,4.7,v),.08,bark);
    const random=seeded(Math.round((u+20)*100));
    for(let i=0;i<26;i++) {
      const a=random()*Math.PI*2,y=1.4+random()*2.8,r=.3+random()*.7;
      const end=new THREE.Vector3(u+Math.cos(a)*r,y+1,v+Math.sin(a)*r);
      rod(site,new THREE.Vector3(u,y-.6,v),end,.018,bark);
      if(i%3===0){const foliage=new THREE.Mesh(new THREE.IcosahedronGeometry(.23,0),leaves);foliage.position.copy(end);foliage.scale.y=2;site.add(foliage);}
    }
  }
  const [px,pz]=lujanToLocal(LUJAN_PATIO.latitude,LUJAN_PATIO.longitude);
  return {root,landmarks:[
    {name:"Casa",position:houseToWorld(12,1,4.0)},
    {name:"Pileta",position:houseToWorld(poolU,poolV,.4)},
    {name:"Patio",position:new THREE.Vector3(px,.2,pz)},
    {name:"Entrada",position:houseToWorld(entrance[0],entrance[1],1.2)}
  ]};
}

