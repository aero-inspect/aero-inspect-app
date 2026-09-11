import * as T from 'three';

// Dimensions are model metres; the reference aircraft has no measured dimensions yet.
export function addMissionDrone(scene: T.Scene, includeDock = true) {
  const dock=new T.Group();dock.name=includeDock?'Drone dock':'Drone model';
  if(includeDock) dock.position.set(-72,0,-65);
  scene.add(dock);
  const mat=(color:string,metalness=.25,roughness=.65)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const graphite=mat('#22282b'),rubber=mat('#171c1e',0,.95),black=mat('#171b1e',.4,.48),cyan=mat('#08b9e2'),silver=mat('#969fa4',.8,.3),white=mat('#e5e8e6',.05),copper=mat('#ad693e',.65),red=mat('#ad272b'),yellow=mat('#d5ad32');
  const led=new T.MeshStandardMaterial({color:'#31dcff',emissive:'#31dcff',emissiveIntensity:.6,roughness:.35});
  function mesh(g:T.BufferGeometry,m:T.Material,p:T.Object3D=dock){const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,p:T.Object3D=dock){const o=mesh(new T.BoxGeometry(w,h,d),m,p);o.position.set(x,y,z);return o;}
  function tube(a:number[],b:number[],r:number,m:T.Material,p:T.Object3D=dock){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const o=mesh(new T.CylinderGeometry(r,r,delta.length(),12),m,p);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
  function wire(points:number[][],r:number,m:T.Material,p:T.Object3D){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),24,r,6,false),m,p);}
  function chamfer(size:number,cut:number,height:number,y:number,m:T.Material){const s=size/2;const shape=new T.Shape();[[-s+cut,-s],[s-cut,-s],[s,-s+cut],[s,s-cut],[s-cut,s],[-s+cut,s],[-s,s-cut],[-s,-s+cut]].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const o=mesh(new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false}),m);o.rotation.x=-Math.PI/2;o.position.y=y;return o;}
  const surface=includeDock?.113:0;
  if(includeDock) {
  chamfer(2.8,.24,.09,.01,graphite);chamfer(2.65,.23,.012,.101,rubber);
  const ring=mesh(new T.RingGeometry(.79,.81,96),mat('#64839b',.15));ring.rotation.x=-Math.PI/2;ring.position.y=surface+.002;
  for(let i=0;i<4;i++){const angle=i*Math.PI/2;const tick=box(.025,.003,.14,Math.sin(angle)*.93,surface+.003,Math.cos(angle)*.93,white);tick.rotation.y=angle;}
  box(.045,.003,.32,-.1,surface+.003,0,white);box(.045,.003,.32,.1,surface+.003,0,white);box(.2,.003,.04,0,surface+.003,0,white);
  for(const side of [-1,1]){
    box(2.16,.006,.008,0,.073,side*1.401,led);box(.008,.006,2.16,side*1.401,.073,0,led);
    for(const z of [-1,1]){const lamp=mesh(new T.CylinderGeometry(.025,.025,.012,16),led);lamp.position.set(side*1.22,surface+.006,z*1.22);
      const light=new T.PointLight('#b2efff',.22,.7,2);light.position.set(side*1.22,surface+.045,z*1.22);light.userData.dockLight=true;dock.add(light);
    }
  }
  for(let x=-1.1;x<=1.1;x+=.16)for(let z=-1.1;z<=1.1;z+=.16)box(.05,.001,.008,x,surface+.001,z,graphite);
  box(.24,.18,.36,1.45,.1,.55,graphite);box(.21,.012,.33,1.45,.2,.55,black);
  for(let i=0;i<5;i++)box(.002,.018,.2,1.572,.05+i*.026,.55,rubber);
  box(.006,.018,.036,1.575,.16,.47,led);tube([1.48,.2,.64],[1.48,.36,.64],.008,black);
  }
  const drone=new T.Group();drone.name='Reference quadcopter';drone.position.y=surface;dock.add(drone);
  // Carbon weave gives the tubes and shell the subdued composite finish in the photos.
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#202526';ctx.fillRect(0,0,64,64);for(let x=0;x<64;x+=4)for(let y=0;y<64;y+=4){ctx.fillStyle=(x+y)%8?'#303636':'#1a1f20';ctx.fillRect(x,y,3,2);}
  const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(5,5);texture.colorSpace=T.SRGBColorSpace;
  const carbon=new T.MeshStandardMaterial({map:texture,roughness:.58,metalness:.28});
  const body=new T.Group();body.position.y=.51;drone.add(body);
  box(.32,.02,.36,0,-.065,0,carbon,body);box(.3,.02,.34,0,.018,0,carbon,body);
  const shellShape=new T.Shape();shellShape.moveTo(-.17,-.14);shellShape.lineTo(-.12,-.2);shellShape.lineTo(.12,-.2);shellShape.lineTo(.17,-.14);shellShape.lineTo(.17,.14);shellShape.lineTo(.1,.2);shellShape.lineTo(-.1,.2);shellShape.lineTo(-.17,.14);shellShape.closePath();
  const shell=mesh(new T.ExtrudeGeometry(shellShape,{depth:.065,bevelEnabled:true,bevelSize:.035,bevelThickness:.04,bevelSegments:2,steps:1}),carbon,body);shell.rotation.x=-Math.PI/2;shell.position.y=.04;
  for(const x of [-1,1])for(const z of [-1,1]){
    const end=[x*.43,0,z*.37];tube([x*.12,0,z*.12],end,.016,carbon,body);
    tube([x*.28,0,z*.24],[x*.31,0,z*.265],.017,white,body);
    box(.065,.05,.065,x*.15,0,z*.14,cyan,body);box(.094,.018,.072,end[0],-.008,end[2],cyan,body);
    const motor=mesh(new T.CylinderGeometry(.032,.03,.043,24),black,body);motor.position.set(end[0],.024,end[2]);
    for(let j=0;j<10;j++){const a=j*Math.PI/5;box(.006,.012,.006,end[0]+Math.cos(a)*.026,.017,end[2]+Math.sin(a)*.026,copper,body);}
    for(const dx of [-.035,.035])for(const dz of [-.025,.025]){const screw=mesh(new T.CylinderGeometry(.004,.004,.006,8),silver,body);screw.position.set(end[0]+dx,.004,end[2]+dz);}
    const prop=new T.Group();prop.name='Two-blade propeller';prop.position.set(end[0],.052,end[2]);prop.rotation.y=x*z*.4;body.add(prop);
    for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(.018,0);shape.bezierCurveTo(.06,.028,.18,.026,.225,.009);shape.quadraticCurveTo(.245,0,.217,-.012);shape.quadraticCurveTo(.1,-.018,.018,-.006);shape.closePath();const blade=mesh(new T.ExtrudeGeometry(shape,{depth:.002,bevelEnabled:false}),black,prop);blade.rotation.x=-Math.PI/2;blade.rotation.z=side===1?0:Math.PI;}
    tube([0,-.003,0],[0,.013,0],.008,silver,prop);
  }
  // Two long skids, with their lowest surface exactly on the dock.
  for(const side of [-1,1]){
    tube([side*.205,.013,-.24],[side*.205,.013,.24],.013,carbon,drone);
    for(const z of [-.22,.22]){const cap=mesh(new T.SphereGeometry(.014,12,8),rubber,drone);cap.position.set(side*.205,.014,z);}
    tube([side*.13,.47,0],[side*.205,.047,0],.016,carbon,drone);
    tube([side*.196,.095,0],[side*.205,.04,0],.022,white,drone);
    box(.044,.027,.075,side*.205,.037,0,silver,drone);
  }
  tube([0,.12,-.04],[.02,.44,-.06],.008,carbon,body);
  const gps=mesh(new T.SphereGeometry(1,24,12),black,body);gps.scale.set(.061,.014,.044);gps.position.set(.02,.452,-.06);
  wire([[.015,.42,-.06],[-.013,.24,-.055],[0,.13,-.04]],.003,black,body);
  box(.095,.034,.026,0,.015,.204,black,body);
  for(const x of [-.09,.09]){wire([[x,-.005,.17],[x*.5,-.04,.21],[-x*.4,-.035,.18]],.006,red,body);}
  box(.034,.015,.018,.018,-.025,.207,yellow,body);
  wire([[.08,-.055,.06],[.065,-.16,.09],[.025,-.18,.1]],.004,black,body);
  const camera=new T.Group();camera.name='Underslung gimbal camera';camera.position.set(0,.315,.045);drone.add(camera);
  box(.095,.018,.095,0,.075,0,carbon,camera);
  for(const x of [-.048,.048])box(.012,.065,.022,x,.04,0,black,camera);
  box(.077,.059,.052,0,0,.015,black,camera);
  const lens=mesh(new T.CylinderGeometry(.023,.025,.028,32),black,camera);lens.rotation.x=Math.PI/2;lens.position.set(0,0,.053);
  const glass=mesh(new T.CircleGeometry(.019,32),new T.MeshPhysicalMaterial({color:'#103d53',metalness:.5,roughness:.08,clearcoat:1}),camera);glass.position.set(0,0,.068);
  return dock;
}
