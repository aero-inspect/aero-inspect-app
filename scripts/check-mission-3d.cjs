// Browser checks against a running Vite server. Does not start a real mission.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/.test(m.text()))errors.push(m.text());});
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173');
    const result=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {toPlantPosition,plantGeoreference:g}=await import('/src/components/bragado/georeference.ts');
      const {createMissionPlayback}=await import('/src/components/bragado/missionPlayback.ts');
      const {addMissionDrone}=await import('/src/components/bragado/drone.ts');
      const check=(ok,message)=>{if(!ok)throw Error(message);};
      check(toPlantPosition({latitude:g.latitude,longitude:g.longitude,altitude:10}).distanceTo(new T.Vector3(0,10.113,0))<1e-8,'origin and altitude');
      check(toPlantPosition({latitude:g.latitude,longitude:g.longitude,absoluteAltitude:100})===null,'unknown AMSL');
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(),controls={target:new T.Vector3()};camera.position.set(0,80,80);
      const dock=addMissionDrone(scene),play=createMissionPlayback(scene,dock,camera,controls),id='qa-'+Date.now();
      const points=[{latitude:g.latitude,longitude:g.longitude,altitude:0,sequence:0},{latitude:g.latitude+.0001,longitude:g.longitude+.0001,altitude:12,sequence:1}];
      const data={id,status:'PLANNED',points,telemetry:null};play.update(data);
      const drone=scene.getObjectByName('Reference quadcopter');
      check(scene.children.filter(o=>o instanceof T.Line).length===1,'only planned route is displayed');
      check(drone.position.distanceTo(toPlantPosition(points[0]))<1e-8,'pending start');
      points[0].altitude=36.887;play.update(data);
      check(Math.abs(drone.position.y-g.groundHeight)<1e-8,'positive takeoff target does not lift a pending drone');
      points[0].altitude=0;play.update(data);
      const sample=(seconds,altitude)=>({missionId:id,timestamp:new Date(1700000000000+seconds*1000).toISOString(),position:{latitude:g.latitude,longitude:g.longitude,relativeAltitude:altitude,absoluteAltitude:100+altitude},velocity:{headingDegree:90}});
      data.status='IN_PROGRESS';data.telemetry=sample(1,10);play.update(data);play.animate(performance.now()+1000);
      check(Math.abs(drone.position.y-10.113)<1e-5,'first live altitude');
      const initial=drone.position.clone();data.telemetry=sample(2,20);play.update(data);play.animate(performance.now()+200);
      check(drone.position.y>initial.y&&drone.position.y<20.113,'interpolation');play.animate(performance.now()+1000);
      data.telemetry=sample(1,50);play.update(data);play.animate(performance.now()+1000);check(Math.abs(drone.position.y-20.113)<1e-5,'out of order');
      const target=controls.target.clone();play.setFollowing(true);play.animate(performance.now()+1100);check(!controls.target.equals(target),'follow');play.setFollowing(false);
      data.status='COMPLETED';play.update(data);data.telemetry=sample(3,60);play.update(data);play.animate(performance.now()+2000);check(Math.abs(drone.position.y-20.113)<1e-5,'completion frozen');
      check(scene.children.filter(o=>o.isLine).every(o=>o.geometry.attributes.position.count>=2),'planned and real lines');
      play.destroy();sessionStorage.removeItem('aeroinspect.mission-trail.'+id);
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const {BragadoPlant3DMap}=await import('/src/components/BragadoPlant3DMap.tsx');
      document.body.innerHTML='<div id="qa" style="height:85vh"></div>';
      window.qaRoot=createRoot(document.getElementById('qa'));
      window.qaRender=()=>window.qaRoot.render(React.createElement(BragadoPlant3DMap,{assets:[],playback:{...data,id:'visual-'+Date.now(),status:'PLANNED',telemetry:null}}));window.qaRender();
      return 'coordinate, initial/live positions, interpolation, ordering, completion, trails, follow: passed';
    });
    await page.getByRole('button',{name:'Seguir dron',exact:true}).waitFor();
    assert.equal(await page.getByRole('group',{name:'Capas de altura'}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Borrar selección'}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Equipos y controles'}).count(),0);
    await page.getByRole('button',{name:'Seguir dron',exact:true}).click();
    await page.getByRole('button',{name:'Centrar planta',exact:true}).click();
    await page.waitForTimeout(1800);
    assert.equal(await page.getByRole('button',{name:'Seguir dron',exact:true}).getAttribute('aria-pressed'),'false');
    await page.screenshot({path:path.join(os.tmpdir(),'mission-3d-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);
    await page.screenshot({path:path.join(os.tmpdir(),'mission-3d-mobile.png')});
    await page.evaluate(async()=>{
      window.qaRoot.unmount();
      const Native=window.EventSource,connections=[];
      class FakeSource extends EventTarget {closed=false;constructor(){super();connections.push(this);}close(){this.closed=true;}}
      window.EventSource=FakeSource;
      const R=(await import('/node_modules/.vite/deps/react.js')).default;
      const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const {useMissionTelemetry}=await import('/src/hooks/useMissionTelemetry.ts');
      const root=createRoot(document.getElementById('qa'));let latest=null;
      function Probe(){latest=useMissionTelemetry('test-stream','test-token').telemetry;return null;}
      const wait=()=>new Promise(resolve=>setTimeout(resolve,50));
      try{root.render(R.createElement(Probe));await wait();if(connections.length!==1)throw Error('duplicate subscription');
        const source=connections[0],sample={missionId:'test-stream',timestamp:'2026-01-01T00:00:02Z'};
        source.dispatchEvent(new MessageEvent('telemetry',{data:JSON.stringify(sample)}));await wait();
        source.onerror();if(source.closed)throw Error('native reconnection disabled');
        source.dispatchEvent(new MessageEvent('telemetry',{data:'invalid'}));await wait();
        source.dispatchEvent(new MessageEvent('telemetry',{data:JSON.stringify({...sample,timestamp:'2026-01-01T00:00:01Z'})}));await wait();
        if(latest.timestamp!==sample.timestamp)throw Error('last valid sample was lost');
        root.unmount();if(!source.closed)throw Error('subscription leaked');
      }finally{window.EventSource=Native;}
    });
    assert.deepEqual(errors,[]);console.log(result);console.log('read-only controls, centering, desktop/mobile, console, SSE lifecycle: passed');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
