const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const catalog=require('../frontend/src/data/bragado-assets.json');
const assets=catalog.map((a,i)=>({...a,idAsset:i+101,status:'ACTIVE',locationDetail:'Bragado'}));
const bins=catalog.filter(a=>a.r>0);
for(let i=0;i<bins.length;i++)for(let j=i+1;j<bins.length;j++){
 const a=bins[i],b=bins[j];assert(Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r>=2.5,`${a.code}/${b.code}: insufficient gap`);
}
let plans=[];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/v1/**',async route=>{
    const url=route.request().url();let value=[];
    if(url.endsWith('/assets'))value=assets;
    if(url.endsWith('/flight-plans'))value=plans;
    if(url.endsWith('/drones'))value=[{idDrone:'test-drone',name:'Dron QA',droneId:'QA'}];
    if(url.includes('/weather'))value={temp:22,description:'Despejado',icon:'01d',windKmh:5,humidity:40,visibilityKm:10};
    if(route.request().method()==='POST'){posts.push({url,payload:route.request().postDataJSON()});value={idMission:'test-only',status:'PLANNED'};}
    await route.fulfill({json:value});
  });
  await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');
  const seed=await page.evaluate(async()=> (await import('/src/components/bragado/inspectionPlans.ts')).generateInspectionPlans());
  for(const report of seed.reports){
   assert.equal(report.levels.length,2);assert(report.levels[0].height>report.levels[1].height);
   for(const level of report.levels){assert.equal(level.omitted,0);assert(level.accepted>=12);}
  }
  plans=seed.plans.map((p,i)=>({idFlightPlan:i+201,name:`Inspeccion 3D - ${p.code} - perimetral-v2`,assetIds:[assets.find(a=>a.code===p.code).idAsset],route:p.route.map((w,j)=>({...w,idPlanWaypoint:(i+1)*1000+j,cameraAngles:w.pointOfInterest?[{pitch:w.pitch,yaw:0}]:[]}))}));
  for(const p of plans){assert(p.route.length<=85);assert(p.route.filter(w=>w.pointOfInterest).length<=10);}
  await page.evaluate(async()=>{
    const React=(await import('/node_modules/.vite/deps/react.js')).default;
    const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {ConfigurarMisionView}=await import('/src/pages/ConfigurarMision.tsx');
    const {setEnvironmentMode}=await import('/src/components/bragado/timeOfDay.ts');setEnvironmentMode('day');
    document.body.innerHTML='<div id="qa" style="padding:16px;background:#f5f7fa"></div>';
    window.qaRoot=createRoot(document.getElementById('qa'));
    window.qaRoot.render(React.createElement(ConfigurarMisionView,{onBack(){},onViewMissions(){}}));
  });
  await page.getByText('Seleccioná un activo para continuar',{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Crear misión',exact:true}).isDisabled());
  assert.equal(await page.getByRole('group',{name:'Capas de altura'}).count(),0);
  const position=async code=>page.evaluate(async record=>{
    const T=await import('/node_modules/.vite/deps/three.js');
    const rect=document.querySelector('.bragado-map-stage canvas').getBoundingClientRect(),aspect=rect.width/rect.height;
    const camera=new T.PerspectiveCamera(55,aspect,.08,1600);camera.position.set(-16,Math.max(175,145/aspect),-31.99);camera.lookAt(-16,0,-32);camera.updateMatrixWorld();
    const p=new T.Vector3(record.x+record.r*.45,record.h+record.r*.165,record.z).project(camera);
    return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
  },catalog.find(a=>a.code===code));
  const select=async code=>{const p=await position(code);await page.mouse.click(p.x,p.y);};
  await select('BRA-SIL-09');await page.getByText('Activo seleccionado: Silo 9',{exact:true}).waitFor();
  await select('BRA-SIL-09');await page.getByText('Seleccioná un activo para continuar',{exact:true}).waitFor();
  await select('BRA-CEL-01');await page.getByText('Activo seleccionado: Celda 1',{exact:true}).waitFor();
  await select('BRA-SIL-10');await page.getByText('Activo seleccionado: Silo 10',{exact:true}).waitFor();
  await select('BRA-NOR-01');assert.equal(await page.getByText('Activo seleccionado: Silo 10',{exact:true}).count(),1);
  const gesture=await position('BRA-SIL-10');await page.mouse.move(gesture.x,gesture.y);await page.mouse.down();await page.mouse.move(gesture.x+12,gesture.y+8,{steps:5});await page.mouse.up();
  assert.equal(await page.getByText('Activo seleccionado: Silo 10',{exact:true}).count(),1);
  const canvasImage=await page.locator('.bragado-map-stage canvas').screenshot();
  const distinct=await page.evaluate(async data=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,colors=new Set();for(let i=0;i<pixels.length;i+=148)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);return colors.size;
  },canvasImage.toString('base64'));assert(distinct>100,'nonblank rendered plant pixels');
  await page.screenshot({path:path.join(os.tmpdir(),'inspection-mission-desktop.png'),fullPage:true});
  const types=await page.evaluate(async({assets,plans})=>{
    const {resolveInspectionPlan}=await import('/src/components/MissionAssetPicker.tsx');
    return {allowed:assets.filter(a=>resolveInspectionPlan(a,plans)).length,wrong:resolveInspectionPlan({...assets[0],type:'NORIA'},plans),duplicate:resolveInspectionPlan(assets[0],[...plans,plans.find(p=>p.assetIds[0]===assets[0].idAsset)])};
  },{assets,plans});assert.equal(types.allowed,15);assert.equal(types.wrong,null);assert.equal(types.duplicate,null);
  await page.getByPlaceholder('Ej: Inspección trimestral Q1').fill('QA sin ejecutar');
  await page.locator('.mission-drone-select > button').click();await page.getByRole('button',{name:'Dron QA (QA)',exact:true}).click();
  await page.locator('.mission-date-input > button').click();await page.locator('.mission-calendar-grid button').nth(20).click();await page.getByRole('button',{name:'Listo',exact:true}).click();
  await page.getByRole('button',{name:'Crear misión',exact:true}).click();await page.getByRole('heading',{name:'Misión creada',exact:true}).waitFor();
  assert.equal(posts.length,1);const selected=plans.find(p=>p.name==='Inspeccion 3D - BRA-SIL-10 - perimetral-v2');assert.equal(posts[0].payload.idFlightPlan,selected.idFlightPlan);assert.deepEqual(posts[0].payload.selectedPlanWaypointIds,selected.route.filter(w=>w.pointOfInterest).map(w=>w.idPlanWaypoint));assert(!posts[0].url.endsWith('/start'));
  await page.getByRole('button',{name:'Ver misiones',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(os.tmpdir(),'inspection-mission-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const spin=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js');const {addMissionDrone}=await import('/src/components/bragado/drone.ts');const {createMissionPlayback}=await import('/src/components/bragado/missionPlayback.ts');
    const scene=new T.Scene(),dock=addMissionDrone(scene),camera=new T.PerspectiveCamera(),play=createMissionPlayback(scene,dock,camera,{target:new T.Vector3()});
    const drone=scene.getObjectByName('Reference quadcopter'),prop=drone.getObjectByName('Two-blade propeller'),data={id:'prop-test',status:'PLANNED',points:[],telemetry:null};
    play.update(data);const before=prop.rotation.y;play.animate(performance.now()+100);const stopped=before===prop.rotation.y;
    data.status='IN_PROGRESS';play.update(data);play.animate(performance.now()+200);const spinning=before!==prop.rotation.y,body=drone.rotation.y===0;
    data.status='COMPLETED';play.update(data);const after=prop.rotation.y;play.animate(performance.now()+300);const finished=after===prop.rotation.y;play.destroy();return {stopped,spinning,body,finished};
  });assert(Object.values(spin).every(Boolean));assert.deepEqual(errors,[]);
  console.log('PASS: real-ID/type mapping, unique selection/toggle, preview, unchanged POST/photos, no auto-start, rotor states, desktop/mobile. Requests mocked; no flight started.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
