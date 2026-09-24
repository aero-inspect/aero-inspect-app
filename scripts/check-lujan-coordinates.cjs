const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const THREE = require('three');
function load(file) {
  const output = buildSync({entryPoints:[file],bundle:true,platform:'node',format:'cjs',external:['three'],write:false}).outputFiles[0].text;
  const compiled = new Module(path.resolve(file),module);
  compiled.paths=module.paths;compiled._compile(output,path.resolve(file));return compiled.exports;
}
const {LUJAN_POOL,LUJAN_PATIO,LUJAN_PLANT,LUJAN_LOCAL_BOUNDS,lujanToLocal,lujanToGeographic,isInsideLujan}=load('frontend/src/data/plants.ts');
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const kml=require('node:fs').readFileSync('docs/lujan-terreno.kml','utf8');
const ring=kml.match(/<coordinates>([\s\S]*?)<\/coordinates>/)[1].trim().split(/\s+/).map(p=>p.split(',').slice(0,2).map(Number));
assert.deepEqual(ring[0],ring[ring.length-1]);ring.pop();
assert.equal(LUJAN_PLANT.bounds.length,ring.length);
const expectedRing=[...ring].reverse();
LUJAN_PLANT.bounds.forEach((p,i)=>assert.deepEqual([Number(p.longitude),Number(p.latitude)],expectedRing[i]));
assert.deepEqual(lujanToLocal(LUJAN_POOL.latitude,LUJAN_POOL.longitude),[0,-0]);
for(const p of [LUJAN_POOL,LUJAN_PATIO,...LUJAN_PLANT.bounds]) {
  const [x,z]=lujanToLocal(Number(p.latitude),Number(p.longitude));
  const result=lujanToGeographic(x,z);
  close(result.latitude,Number(p.latitude));close(result.longitude,Number(p.longitude));
  assert.ok(isInsideLujan(x,z));
}
// Independent scale and axis checks at latitude 34.55 degrees south.
const east=lujanToLocal(LUJAN_POOL.latitude,LUJAN_POOL.longitude+.0001);
assert.ok(east[0]>9.17 && east[0]<9.19);close(east[1],0);
const north=lujanToLocal(LUJAN_POOL.latitude+.0001,LUJAN_POOL.longitude);
assert.ok(north[1]<-11.09 && north[1]>-11.10);close(north[0],0);
assert.equal(isInsideLujan(100,100),false);assert.equal(isInsideLujan(NaN,0),false);
// Exercise the actual scene with a minimal canvas, no WebGL required.
const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
global.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const {buildLujan}=load('frontend/src/components/lujan/geometry.ts');
const {root,landmarks}=buildLujan();root.updateMatrixWorld(true);
const {LUJAN_FOOTPRINTS}=load('frontend/src/data/lujanFootprints.ts');
const completeKml=require('node:fs').readFileSync('docs/lujan-completo.kml','utf8');
const {footprintLocal,polygonCenter}=load('frontend/src/components/lujan/footprints.ts');
for(const [name,meshName] of [['Casa','lujan-house-footprint'],['Pileta','lujan-pool-footprint'],['Estacionamiento','lujan-parking-footprint']]) {
  const placemark=[...completeKml.matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/g)].map(m=>m[0]).find(m=>m.includes(`<name>${name}</name>`));
  const coordinates=placemark.match(/<coordinates>([\s\S]*?)<\/coordinates>/)[1].trim().split(/\s+/).map(p=>p.split(',').slice(0,2).map(Number));coordinates.pop();
  assert.deepEqual(LUJAN_FOOTPRINTS[name],coordinates);
  const expected=footprintLocal(name),mesh=root.getObjectByName(meshName),positions=mesh.geometry.attributes.position;
  assert.equal(positions.count,expected.length);
  for(let i=0;i<positions.count;i++) {
    const p=mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i));
    assert.ok(expected.some(([x,z])=>Math.hypot(x-p.x,z-p.z)<1e-5),`${name} vertex deviates from KML`);
  }
}
const poolPosition=landmarks.find(p=>p.name==='Pileta').position;
const poolCenter=polygonCenter(footprintLocal('Pileta'));
close(poolPosition.x,poolCenter[0]);close(poolPosition.z,poolCenter[1]);
const patio=landmarks.find(p=>p.name==='Patio').position;
const patioGps=lujanToGeographic(patio.x,patio.z);close(patioGps.latitude,LUJAN_PATIO.latitude);close(patioGps.longitude,LUJAN_PATIO.longitude);
// The estimated gallery, its overhang and service passage fit the real parcel.
root.getObjectByName('lujan-gallery').traverse(object=>{
  if(!object.isMesh) return;
  const positions=object.geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const p=object.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i));
    assert.ok(isInsideLujan(p.x,p.z),'Gallery intersects the GPS boundary');
  }
});
// Every wire endpoint lies on the corresponding GPS boundary (no visual offset).
for(let i=0;i<LUJAN_LOCAL_BOUNDS.length;i++) {
  const fence=root.getObjectByName(`lujan-fence-${i}`),positions=fence.geometry.attributes.position;
  const [a,b]=[LUJAN_LOCAL_BOUNDS[i],LUJAN_LOCAL_BOUNDS[(i+1)%LUJAN_LOCAL_BOUNDS.length]];
  for(let j=0;j<positions.count;j++) {
    const p=fence.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,j));
    const distance=Math.abs((b[0]-a[0])*(p.z-a[1])-(b[1]-a[1])*(p.x-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);
    assert.ok(distance<.00001,`Fence ${i} off boundary by ${distance}m`);
  }
}
// Oblique picking must hit the roof itself, not the ground behind it.
const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
const roofTarget=landmarks.find(p=>p.name==='Casa').position.clone();
const origin=roofTarget.clone().add(new THREE.Vector3(15,25,30));
const ray=new THREE.Raycaster(origin,roofTarget.clone().sub(origin).normalize());
const hit=ray.intersectObjects(meshes,false)[0];
assert.ok(hit && hit.point.y>2.5 && isInsideLujan(hit.point.x,hit.point.z));
const gps=lujanToGeographic(hit.point.x,hit.point.z),local=lujanToLocal(gps.latitude,gps.longitude);
close(local[0],hit.point.x,1e-7);close(local[1],hit.point.z,1e-7);
console.log('Luján: GPS round trips, WGS84 scale, bounds, scene anchors, fence alignment and roof picking passed.');
