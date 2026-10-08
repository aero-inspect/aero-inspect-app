import assert from "node:assert/strict";
import { test } from "node:test";
import { assetInsights, evidenceFinding, groupInspections } from "../src/utils/reportInsights.ts";
import type { BackendAsset, BackendInspectionPhoto, BackendReport } from "../src/api/types.ts";
const asset={idAsset:1,name:"Silo 1",code:"S1"} as BackendAsset;
const photo=(changes:Partial<BackendInspectionPhoto>={}):BackendInspectionPhoto=>({idInspectionPhoto:"p1",idMission:"m1",idMissionWaypoint:"w1",reportCode:"r1",idAsset:1,capturedAt:"2026-10-01T12:00:00Z",rawImageUrl:"/raw.jpg",analyzedImageUrl:null,status:"ANALYZED",findings:JSON.stringify({corrosion:{status:"no_corrosion_detected",detected_area_percent:0}}),analyzedAt:null,...changes});
const report=(changes:Partial<BackendReport>={}):BackendReport=>({idReport:"r1",code:"r1",title:"Inspección",idMission:"m1",missionName:"Inspección 1",idAsset:1,assetName:"Silo 1",createdAt:"2026-10-01T12:00:00Z",updatedAt:"2026-10-01T12:00:00Z",status:"VALIDATED",validatorSignature:"Técnico",validatorComments:null,validatedAt:null,severity:"NOT_REPORTED",findingsCount:0,photos:[photo()],...changes});
test("sin inspección y resultados descartados nunca se muestran como saludables",()=>{
 assert.equal(assetInsights([asset],[])[0].category,"unknown");
 assert.equal(assetInsights([asset],[report({status:"REJECTED"})])[0].category,"unknown");
});
test("el estado usa la última inspección y no conserva una alarma histórica",()=>{
 const old=report({severity:"HIGH",createdAt:"2026-09-01T12:00:00Z",idMission:"old",photos:[photo({capturedAt:"2026-09-01T12:00:00Z",findings:'{"status":"corrosion_candidate_detected","detected_area_percent":40}'})]});
 const state=assetInsights([asset],[old,report()])[0];
 assert.equal(state.category,"clear");assert.equal(state.reports.length,1);assert.equal(state.reports[0].idMission,"m1");
});
test("análisis fallidos y datos inválidos no equivalen a ausencia de anomalías",()=>{
 assert.equal(assetInsights([asset],[report({photos:[photo({status:"ANALYSIS_FAILED",findings:"falló"})]})])[0].category,"review");
 assert.equal(assetInsights([asset],[report({photos:[photo({findings:"{}"})]})])[0].category,"unknown");
});
test("grietas sin gravedad conservan la necesidad de revisión",()=>{
 const p=photo({findings:'{"corrosion":{"status":"no_corrosion_detected"},"crack":{"status":"crack_candidate_detected"}}'});
 const state=assetInsights([asset],[report({photos:[p]})])[0];
 assert.equal(state.category,"review");assert.equal(state.severity,"NOT_REPORTED");assert.equal(state.cracks,1);
});
test("reúne todos los activos y reportes de una inspección sin perder los originales",()=>{
 const groups=groupInspections([report(),report({code:"r2",idAsset:2,assetName:"Silo 2",severity:"HIGH"}),report({code:"r3",idAsset:2,assetName:"Silo 2"})]);
 assert.equal(groups.length,1);assert.equal(groups[0].assetsCount,2);assert.equal(groups[0].reports.length,3);assert.equal(groups[0].reports[0].code,"r2");
});
test("interpreta evidencias anteriores y mantiene los resultados pendientes separados",()=>{
 assert.equal(evidenceFinding(photo({findings:'{"status":"corrosion_candidate_detected","detected_area_percent":10}'})).corrosion,true);
 assert.equal(evidenceFinding(photo({status:"PENDING_ANALYSIS"})).readable,false);
 assert.equal(assetInsights([asset],[report({status:"PENDING_VALIDATION"})])[0].pending,true);
});

test("los descartados no alteran resultados aceptados ni encabezan las prioridades",()=>{
 const rejected=report({code:"rejected",severity:"CRITICAL",status:"REJECTED",photos:[photo({idInspectionPhoto:"failed",status:"ANALYSIS_FAILED"})]});
 const state=assetInsights([asset],[report(),rejected])[0];
 assert.equal(state.category,"clear");assert.equal(state.pending,false);
 assert.equal(groupInspections([rejected,report()])[0].reports[0].code,"r1");
});
