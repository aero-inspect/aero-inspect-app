const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../general-monolith/src/main/resources/database.script/bragado-inspection-plans-v4.sql'), 'utf8');
  const plans = [...sql.matchAll(/\('([^']+)', '([^']+)', '(\[.*?\])'::jsonb\)/g)].map((m, i) => ({ idFlightPlan:i+1, name:m[1], route:JSON.parse(m[3]), assetIds:[i+1] }));
  if (plans.length !== 18) throw Error('Expected 18 generated plans');
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  try {
    const page = await browser.newPage({ viewport:{width:1200,height:850} });
    await page.goto(process.env.APP_URL || 'http://localhost:5173');
    const result = await page.evaluate(async plans => {
      const { composeInspectionRoute } = await import('/src/utils/missionPlanComposer.ts');
      const { toPlantPosition } = await import('/src/components/bragado/georeference.ts');
      const assert = (ok, message) => { if (!ok) throw Error(message); };
      let pairs = 0;
      for (const first of plans) for (const second of plans) {
        if (first === second) continue;
        const route = composeInspectionRoute([first, second]);
        assert(route.filter(p=>p.action==='TAKEOFF').length===1, 'Repeated takeoff');
        assert(route.filter(p=>p.action==='LAND').length===1, 'Repeated landing');
        assert(route.filter(p=>p.pointOfInterest).length===16, 'Photo count changed');
        const home = route[0];
        assert(!route.slice(1,-2).some(p=>Math.abs(p.latitude-home.latitude)<1e-10 && Math.abs(p.longitude-home.longitude)<1e-10), 'Intermediate base visit');
        for (let i=1;i<route.length;i++) {
          const a=toPlantPosition(route[i-1]),b=toPlantPosition(route[i]);
          assert(Math.abs(a.y-b.y)<1e-6 || Math.hypot(a.x-b.x,a.z-b.z)<1e-6, 'Diagonal climb/descent');
          assert(route[i].sequence===i, 'Broken sequence');
        }
        pairs++;
      }
      assert(JSON.stringify(composeInspectionRoute([plans[0]]))===JSON.stringify(plans[0].route), 'Single plan changed');
      const ReactModule = await import('/node_modules/.vite/deps/react.js');
      const ReactDomModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const React = ReactModule.default || ReactModule;
      const createRoot = ReactDomModule.createRoot || ReactDomModule.default.createRoot;
      const {BragadoPlant3DMap} = await import('/src/components/BragadoPlant3DMap.tsx');
      const {setEnvironmentMode} = await import('/src/components/bragado/timeOfDay.ts');
      const {default:catalog} = await import('/src/data/bragado-assets.json?import');
      setEnvironmentMode('day');
      const assets = catalog.map((a,i)=>({...a,idAsset:i+1,status:'ACTIVE',locationDetail:a.name}));
      const selected = plans.filter(p=>['BRA-NOR-01','BRA-NOR-02','BRA-SEC-01'].includes(p.name));
      const host=document.createElement('div');host.id='route-test';host.style.cssText='position:fixed;inset:0;z-index:999999;background:white';document.body.append(host);
      const style=document.createElement('style');style.textContent='#route-test > * {height:100%;min-height:100%;width:100%}';document.head.append(style);
      createRoot(host).render(React.createElement(BragadoPlant3DMap,{assets,assetSelection:{assets,selectedIds:assets.filter(a=>['NORIA','SECADORA'].includes(a.type)).map(a=>a.idAsset),route:composeInspectionRoute(selected),onSelect:()=>{}}}));
      return {pairs, plans:plans.length};
    }, plans);
    await page.locator('#route-test canvas').waitFor();
    await page.waitForTimeout(2500);
    for (const [name,width,height] of [['desktop',1200,850],['mobile',390,844]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(700);
      const canvas=page.locator('#route-test canvas').first();
      const screenshot=await canvas.screenshot({path:path.join(os.tmpdir(),`aero-corridor-${name}.png`)});
      if (screenshot.length < 5000) throw Error('Blank map canvas');
    }
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
