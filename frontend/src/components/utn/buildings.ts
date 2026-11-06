import * as THREE from "three";
import { surface } from "./materials";
import { UTN_FOOTPRINTS } from "../../data/utnFootprints";

type Projection = (point: readonly number[]) => THREE.Vector3;
// Photo-based draft: horizontal building outlines from KML; vertical dimensions
// and the uncharted stair tower are estimates, awaiting corridor references.
export function buildUtnBuildings(project: Projection) {
  const group = new THREE.Group(); group.name = "UTN · arquitectura provisional";
  const plaster = surface(0xc9c4af,"plaster");
  const concrete = surface(0xb7b7ae,"concrete");
  const roof = new THREE.MeshStandardMaterial({color:0x858780,roughness:.95});
  const glass = new THREE.MeshStandardMaterial({color:0x42535b,roughness:.27,metalness:.35});
  const frame = new THREE.MeshStandardMaterial({color:0xc2c6c4,roughness:.45,metalness:.45});
  const brick = new THREE.MeshStandardMaterial({color:0x955b42,roughness:1});
  const joint = new THREE.MeshStandardMaterial({color:0x96998f,roughness:1});
  const mortar = new THREE.MeshStandardMaterial({color:0xbbb3a2,roughness:1});
  function box(parent: THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function prism(points:THREE.Vector3[],height:number,material:THREE.Material,base=0) {
    const shape = new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false}),material);
    mesh.rotation.x=-Math.PI/2;mesh.position.y=base;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  function edge(a:THREE.Vector3,b:THREE.Vector3) {
    const axis=b.clone().sub(a).normalize();
    const wall=new THREE.Group();wall.position.copy(a);
    wall.rotation.y=-Math.atan2(axis.z,axis.x);group.add(wall);
    return {wall,length:a.distanceTo(b)};
  }
  const lab=UTN_FOOTPRINTS["Lab fisica"].map(project);
  prism(lab,7.3,plaster);prism(lab,.22,roof,7.3);
  // Two long facades: repeated aluminium window frames on both floors.
  for (const [i,j] of [[1,2],[3,0]]) {
    const {wall,length}=edge(lab[i],lab[j]);
    for (const y of [2,5.35]) {
      const count=Math.floor((length-3)/4.2), bay=(length-3)/count;
      for(let n=0;n<count;n++) {
        const x=1.5+(n+.5)*bay,w=bay-.42;
        // Faces on both sides of the wall plane keep details on the exterior
        // regardless of the source ring winding.
        box(wall,w,1.65,.14,x,y,0,glass);
        for(const dx of [-w/2,-w/4,0,w/4,w/2])box(wall,.065,1.76,.2,x+dx,y,0,frame);
        for(const dy of [-.85,.85])box(wall,w+.12,.07,.2,x,y+dy,0,frame);
      }
    }
    for(const y of [.4,3.6,6.9])box(wall,length,.045,.075,length/2,y,0,concrete);
    box(wall,length,.28,.22,length/2,7.52,0,concrete);
  }
  // The tall concrete end wall/tower and two open connecting landings are
  // absent from Earth. Position/width are deliberately isolated for revision.
  const {wall:end,length:width}=edge(lab[0],lab[1]);
  end.scale.z=-1; // Tower extends beyond the lab end, not into its roof.
  // From the pitch the narrow end faces the viewer, while the long solid
  // panel runs along the passage, parallel to the full shed frontage.
  const panelLength=width, towerDepth=3.2, towerZ=-3.7;
  for(const z of [towerZ-towerDepth/2,towerZ+towerDepth/2])
    box(end,panelLength,10.2,.22,panelLength/2,5.1,z,concrete);
  box(end,panelLength,.22,towerDepth,panelLength/2,10.09,towerZ,concrete);
  box(end,.22,10.2,towerDepth,panelLength,5.1,towerZ,concrete);
  // Openings are on the narrow, pitch-facing end (x=0).
  for(const [y,h] of [[1.65,3.3],[5.4,1.5],[8.7,3]])
    box(end,.22,h,towerDepth,0,y,towerZ,concrete);
  for(const y of [3.3,4.8,6.15,7.2])box(end,.28,.07,2.8,-.04,y,towerZ,frame);
  for(let y=3.55;y<4.8;y+=.25)box(end,.28,.035,2.8,-.04,y,towerZ,frame);
  box(end,.28,1.5,.04,-.04,4.05,towerZ,frame);
  box(end,.28,2.05,1.05,-.04,1.025,towerZ-.45,frame);
  box(end,.3,1.8,.9,-.06,1.025,towerZ-.45,glass);
  for(const y of [3.35,6.65]) {
    box(end,panelLength,.3,2.1,panelLength/2,y,-1.05,concrete);
    box(end,.08,.85,2.1,.12,y+.55,-1.05,concrete);
    box(end,.055,.055,2.1,.12,y+1,-1.05,frame);
  }
  for(let y=1.5;y<10;y+=1.5)
    box(end,panelLength,.025,.025,panelLength/2,y,towerZ-towerDepth/2-.12,joint);
  for(let x=1.5;x<panelLength;x+=1.5)
    box(end,.018,10,.025,x,5,towerZ-towerDepth/2-.12,joint);
  box(end,.04,2,.04,1.5,11.2,towerZ,frame);

  // Galpon/Galpon2 are duplicate annotations of a single building.
  const outline=UTN_FOOTPRINTS.Galpon.map(project);
  // The photographed facade faces the passage from its western side.
  // Galpon2 sits beside the lab and was the wrong footprint for this shed.
  const shed=[outline[2],outline[3],outline[0],outline[1]];
  const {wall:front,length:sw}=edge(shed[0],shed[3]);
  const axis=shed[3].clone().sub(shed[0]).normalize();
  const inward=new THREE.Vector3(-axis.z,0,axis.x);
  const sign=Math.sign(shed[1].clone().sub(shed[0]).dot(inward));
  const depth=Math.abs(shed[1].clone().sub(shed[0]).dot(inward));
  // Work in an inward-positive frame for the recessed entrance.
  const shell=new THREE.Group();shell.scale.z=sign;
  // Cement at the pitch end (x=0); exposed brick continues toward the back.
  shell.position.x=sw;shell.scale.x=-1;front.add(shell);
  const white=surface(0xd4d1c4,"plaster");
  const ochre=new THREE.MeshStandardMaterial({color:0x958166,roughness:1});
  const rust=new THREE.MeshStandardMaterial({color:0x634334,roughness:1});
  const door=new THREE.MeshStandardMaterial({color:0xd0d3c9,roughness:.8});
  const split=sw*.65, opening=Math.min(2.9,sw-split-.55), start=split+.15;
  const rear=1.7;
  box(shell,sw,3.25,depth-rear,sw/2,1.625,(depth+rear)/2,white);
  box(shell,split,2.9,rear,split/2,1.45,rear/2,brick);
  box(shell,sw-start-opening,3.65,rear,(sw+start+opening)/2,1.825,rear/2,white);
  box(shell,sw-split,1,rear,(sw+split)/2,3.15,rear/2,white);
  // True entrance recess: floor, two-tone side walls and recessed doors.
  box(shell,opening,.06,rear,start+opening/2,.03,rear/2,plaster);
  box(shell,.12,2.65,rear,start,1.325,rear/2,white);
  box(shell,.13,1.05,rear,start,.525,rear/2,ochre);
  box(shell,.13,1.05,rear,start+opening,.525,rear/2,ochre);
  box(shell,opening,1.05,.05,start+opening/2,.525,rear-.02,ochre);
  box(shell,1.45,2.05,.09,start+opening*.45,1.025,rear-.07,ochre);
  box(shell,1.45,.35,.1,start+opening*.45,2.25,rear-.07,glass);
  box(shell,.025,2.05,.13,start+opening*.45,1.025,rear-.1,rust);
  box(shell,.08,2.1,.8,start+opening-.04,1.05,rear*.5,ochre);
  for(let x=start+.4;x<start+opening;x+=.4)box(shell,.008,.006,rear,x,.064,rear/2,mortar);
  for(let z=.4;z<rear;z+=.4)box(shell,opening,.006,.008,start+opening/2,.064,z,mortar);
  // Hollow ceramic blocks and white sheet-metal doors with rusty braces.
  for(let y=.2;y<2.9;y+=.2) {
    box(shell,split,.025,.025,split/2,y,-.018,mortar);
    for(let x=(Math.round(y/.2)%2)*.2;x<split;x+=.4)
      box(shell,.025,.175,.025,x,y-.1,-.018,mortar);
  }
  for(const x of [split*.25,split*.78]) {
    box(shell,.8,2.05,.08,x,1.025,-.07,door);
    for(let dx=-.36;dx<.4;dx+=.08)box(shell,.018,2,.05,x+dx,1.025,-.12,frame);
    for(const dx of [-.43,.43])box(shell,.045,2.15,.08,x+dx,1.075,-.15,rust);
    for(const y of [.08,.8,1.5,2.1])box(shell,.9,.045,.08,x,y,-.15,rust);
  }
  box(shell,.85,.35,.08,split-.65,2.5,-.05,glass);
  for(let x=split-1.05;x<split-.2;x+=.12)box(shell,.025,.35,.1,x,2.5,-.1,rust);
  // Slightly pitched corrugated roof behind the taller plaster parapet.
  const roofGeometry=new THREE.PlaneGeometry(sw+.2,depth+.45,Math.ceil(sw/.055),1);
  const vertices=roofGeometry.attributes.position;
  for(let i=0;i<vertices.count;i++) {
    const x=vertices.getX(i),z=vertices.getY(i);
    vertices.setXYZ(i,x,3.12+Math.sin(x/.22*Math.PI*2)*.028-z*.035,z);
  }
  roofGeometry.computeVertexNormals();
  const sheetMaterial=roof.clone();sheetMaterial.side=THREE.DoubleSide;
  const sheet=new THREE.Mesh(roofGeometry,sheetMaterial);
  sheet.position.set(sw/2,0,depth/2);sheet.castShadow=true;sheet.receiveShadow=true;shell.add(sheet);
  box(shell,.34,.2,.25,start+opening,2.9,-.18,roof);
  box(shell,.025,.8,.025,start+opening,3.4,-.15,rust);
  // Small barred window in the cement end wall, visible from the pitch.
  box(shell,.08,.65,.8,sw+.02,2.35,depth*.52,glass);
  for(const z of [-.4,0,.4])box(shell,.11,.7,.025,sw+.06,2.35,depth*.52+z,rust);
  for(const y of [2.02,2.35,2.68])box(shell,.11,.025,.85,sw+.06,y,depth*.52,rust);
  // Concrete strips beside the grassy passage, as seen in the references.
  for(const [a,b] of [[shed[0],shed[3]],[lab[0],lab[1]]]) {
    const {wall,length}=edge(a,b);box(wall,length,.045,.85,length/2,.023,-.4,concrete);
  }
  // Simple concrete benches, deliberately spaced along the rest-area strip.
  // Distribution is illustrative, authorized by the user without measured positions.
  const rest=UTN_FOOTPRINTS["Zona con bancos, descanso"].map(project);
  const from=rest[0].clone().add(rest[1]).multiplyScalar(.5);
  const to=rest[2].clone().add(rest[3]).multiplyScalar(.5);
  const direction=to.clone().sub(from).normalize();
  const count=6;
  // Keep the passage exit clear: omit the first bench, preserve all others.
  for(let i=1;i<count;i++) {
    const bench=new THREE.Group();bench.name=`Banco de cemento ${i+1}`;
    bench.position.copy(from).lerp(to,(i+1)/(count+1));
    bench.rotation.y=-Math.atan2(direction.z,direction.x);group.add(bench);
    box(bench,1.8,.12,.5,0,.42,0,concrete);
    for(const x of [-.6,.6])box(bench,.18,.36,.44,x,.18,0,concrete);
  }
  return group;
}
