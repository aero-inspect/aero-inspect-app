const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),posts=[];
  let mission={idMission:'qa-mission',idFlightPlan:1,name:'Prueba local',status:'IN_PROGRESS',completionPercentage:0,missionWaypoints:[],selectedPlanWaypointIds:[]};
  const plan={idFlightPlan:1,name:'Prueba',assetIds:[],route:[]};
  await page.route('**/api/v1/**',r=>{
   const url=r.request().url();let data=[];
   if(url.endsWith('/missions'))data=[mission];
   else if(url.includes('/missions/'))data=mission;
   else if(url.endsWith('/flight-plans'))data=[plan];
   else if(url.includes('/flight-plans/'))data=plan;
   if(r.request().method()==='POST')posts.push(url);
   return r.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(async()=>{
   window.EventSource=class extends EventTarget{constructor(){super();window.qaSource=this;}close(){}};
   const R=(await import('/node_modules/.vite/deps/react.js')).default;
   const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
   document.body.innerHTML='<div id="qa"></div>';window.qaRoot=createRoot(document.getElementById('qa'));
   const {MonitorMissionView}=await import('/src/pages/MonitorMission.tsx');
   window.qaRoot.render(R.createElement(MonitorMissionView,{missionId:'qa-mission',token:'qa',onBack(){throw Error('Cancel must not navigate');}}));
  });
  await page.getByRole('button',{name:'Cancelar',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Pausar',exact:true}).count(),0);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.waitForTimeout(300);
  assert.equal(posts.length,1);assert(posts[0].endsWith('/qa-mission/cancel'));
  await page.evaluate(()=>window.qaSource.dispatchEvent(new MessageEvent('status',{data:JSON.stringify({missionId:'qa-mission',event:'MISSION_CANCELLED',timestamp:new Date().toISOString()})})));
  await page.getByText('Cancelada',{exact:true}).waitFor();
  await page.evaluate(async()=>{
   const R=(await import('/node_modules/.vite/deps/react.js')).default;
   const {MisMisionesView}=await import('/src/pages/MisMisiones.tsx');
   window.qaRoot.render(R.createElement(MisMisionesView,{user:{role:'Jefe de Planta'},onCreateMission(){},onGeneratePlan(){},onViewMission(){}}));
  });
  await page.getByText('Prueba local',{exact:true}).first().waitFor();
  mission={...mission,status:'COMPLETED',completionPercentage:100};
  await page.getByText('Completada',{exact:true}).first().waitFor({timeout:7000});
  console.log('PASS: cancel POST, no pause, cancelled event, completed table refresh. All endpoints mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
