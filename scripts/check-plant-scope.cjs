const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
function load(file) {
  const output = buildSync({ entryPoints:[file], bundle:true,platform:'node',format:'cjs',write:false }).outputFiles[0].text;
  const module = new Module(path.resolve(file),moduleParent);
  module.paths = moduleParent.paths;
  module._compile(output,path.resolve(file));
  return module.exports;
}
const moduleParent = module;
global.localStorage = { getItem: () => null };
const { BRAGADO_PLANT:B, LUJAN_PLANT:L } = load('frontend/src/data/plants.ts');
const api = load('frontend/src/api/client.ts');
const location = plant => ({latitude:Number(plant.center.latitude),longitude:Number(plant.center.longitude)});
const assets = [{idAsset:1,...location(B)},{idAsset:2,...location(L)}];
const plans = [
 {idFlightPlan:11,assetIds:[1],route:[location(B)]},
 {idFlightPlan:12,assetIds:[2],route:[location(L)]},
 {idFlightPlan:13,assetIds:[2],route:[]},
 {idFlightPlan:14,assetIds:[],route:[]}
];
const fixtures = {
 '/api/v1/assets':assets,
 '/api/v1/flight-plans':plans,
 '/api/v1/missions':[
  {idMission:'B',idFlightPlan:11,missionWaypoints:null},
  {idMission:'L',idFlightPlan:12,missionWaypoints:null},
  {idMission:'LW',idFlightPlan:999,missionWaypoints:[location(L)]}
 ],
 '/api/v1/mission-schedules':[{idMissionSchedule:'B',idFlightPlan:11},{idMissionSchedule:'L',idFlightPlan:12}],
 '/api/v1/reports':[{code:'B',idAsset:1},{code:'L',idAsset:2}]
};
global.fetch = async url => {
 assert.ok(url in fixtures,`Unexpected endpoint ${url}`);
 return new Response(JSON.stringify(fixtures[url]));
};
(async()=>{
 api.setApiPlant(L);
 assert.deepEqual((await api.getAssets()).map(a=>a.idAsset),[2]);
 assert.deepEqual((await api.getFlightPlans()).map(p=>p.idFlightPlan),[12,13]);
 assert.deepEqual((await api.getMissions()).map(m=>m.idMission),['L','LW']);
 assert.deepEqual((await api.getMissionSchedules()).map(m=>m.idMissionSchedule),['L']);
 assert.deepEqual((await api.getReports()).map(r=>r.code),['L']);
 api.setApiPlant(B);
 assert.deepEqual((await api.getAssets()).map(a=>a.idAsset),[1]);
 assert.deepEqual((await api.getFlightPlans()).map(p=>p.idFlightPlan),[11,14]);
 assert.deepEqual((await api.getMissions()).map(m=>m.idMission),['B']);
 // Requests keep their originating plant even if the user switches while they resolve.
 api.setApiPlant(L);
 const pending=api.getAssets();api.setApiPlant(B);
 assert.deepEqual((await pending).map(a=>a.idAsset),[2]);
 fixtures['/api/v1/assets']=[assets[0]];
 api.setApiPlant(L);
 assert.deepEqual(await api.getAssets(),[]);
 global.fetch=async()=>new Response(JSON.stringify({message:'Backend unavailable'}),{status:503});
 await assert.rejects(api.getAssets(),/Backend unavailable/);
 console.log('Plant scope: 11 assertions passed (assets, plans, missions, schedules, reports, switches, empty and error states).');
})().catch(error=>{console.error(error);process.exitCode=1;});
