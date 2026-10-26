'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fs,path,PNG,sha,inspect,composites,writeJson}=require('./lib.cjs');
const {gate,reservationGate}=require('./run.cjs');
function freePlan(){const p=JSON.parse(fs.readFileSync(path.join(__dirname,'plan.json'),'utf8'));p.costs.paidBudgetCny=0;return p;}
function fixture(kind){
 const im=new PNG({width:64,height:64});
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const i=(y*64+x)*4,d=Math.hypot(x-31.5,y-31.5);
  const c=kind==='checker'?(Math.floor(x/8)+Math.floor(y/8))%2?180:255:210;
  im.data[i]=c;im.data[i+1]=130;im.data[i+2]=80;
  im.data[i+3]=kind==='empty'?0:kind==='alpha'?Math.round(Math.min(1,Math.max(0,20-d))*255):255;
 }
 return PNG.sync.write(im);
}
test('opaque PNG and painted checkerboard cannot pass true background alpha',()=>{
 for(const kind of ['opaque','checker'])assert.equal(inspect(fixture(kind)).pixelTransparencyPassed,false);
});
test('transparent empty canvas is rejected; synthetic foreground alpha is recognized only as pixels',()=>{
 assert.equal(inspect(fixture('empty')).pixelTransparencyPassed,false);
 const m=inspect(fixture('alpha'));assert.equal(m.pixelTransparencyPassed,true);
 assert.equal(m.identity,'NOT_SCORED');assert.match(m.nativeOrigin,/REQUIRES/);
});
test('display composition cannot alter original output bytes',()=>{
 const b=fixture('alpha'),before=sha(b);
 composites(b,path.join(__dirname,'evidence/selftest-only'),'synthetic-calibration-not-model-output');
 assert.equal(sha(b),before);
});
test('real low-alpha haze cannot be mistaken for strictly zero background',()=>{
 const im=PNG.sync.read(fixture('alpha'));
 for(let y=1;y<12;y++)for(let x=1;x<63;x++)im.data[(y*64+x)*4+3]=1;
 const bytes=PNG.sync.write(im),before=sha(bytes),m=inspect(bytes);
 assert.equal(m.pixelTransparencyPassed,true);
 assert.equal(m.outsideAlpha8BoundingBox.strictAllZero,false);
 assert.ok(m.lowAlphaOneThroughEightRatio>0);
 assert.equal(m.productionReady,false);
 assert.equal(sha(bytes),before);
});
test('real historical master is correctly rejected as opaque, not repaired',()=>{
 const m=inspect(fs.readFileSync(path.join(__dirname,'baseline/assets/historical-wan-master.png')));
 assert.equal(m.pixelTransparencyPassed,false);assert.equal(m.fullyTransparentRatio,0);
});
test('unknown quota and unsafe budgets prevent generation before any network path',()=>{
 const p=freePlan();
 const c={apiKey:'selftest-placeholder-not-a-real-key',workspaceId:'selftest-workspace'};
 assert.ok(gate(p,null,c).includes('FREE_QUOTA_AND_FREE_TIER_ONLY_UNVERIFIED'));
 const changed=structuredClone(p);changed.costs.paidBudgetCny=1;
 assert.ok(gate(changed,null,c).includes('ZERO_PAID_BUDGET_REQUIRED'));
 const endpoint=structuredClone(p);endpoint.endpointPath='/unverified';
 assert.ok(gate(endpoint,null,c).includes('UNVERIFIED_REGION_OR_ENDPOINT'));
});
test('free-tier-only, enough quota, fresh account binding and matching proof are all required',()=>{
 const p=freePlan();
 const c={apiKey:'selftest-placeholder-not-a-real-key',workspaceId:'selftest-workspace'};
 const proof=path.join(__dirname,'evidence/selftest-only/proof.txt');fs.mkdirSync(path.dirname(proof),{recursive:true});fs.writeFileSync(proof,'SYNTHETIC UNIT TEST PROOF. NOT ACCOUNT AUTHORIZATION.');
 const now=Date.now(),a={status:'VERIFIED',verifiedAt:new Date(now).toISOString(),region:'cn-beijing',workspaceSha256:sha(Buffer.from(c.workspaceId)),evidenceFile:path.relative(__dirname,proof),evidenceSha256:sha(fs.readFileSync(proof)),models:{}};
 for(const m of p.models)a.models[m]={enabled:true,freeTierOnly:true,remainingFreeImages:4,expiresAt:new Date(now+86400000).toISOString()};
 assert.deepEqual(gate(p,a,c,now),[]);
 const paid=structuredClone(a);paid.models[p.models[0]].freeTierOnly=false;assert.ok(gate(p,paid,c,now).length);
 const expired=structuredClone(a);expired.verifiedAt=new Date(now-31*60000).toISOString();assert.ok(gate(p,expired,c,now).includes('ACCOUNT_EVIDENCE_NOT_FRESH'));
 const short=structuredClone(a);short.models[p.models[0]].remainingFreeImages=3;assert.ok(gate(p,short,c,now).length);
 const mismatch=structuredClone(a);mismatch.workspaceSha256='wrong';assert.ok(gate(p,mismatch,c,now).includes('ACCOUNT_WORKSPACE_MISMATCH'));
});
test('paid route requires exact user scope, plan binding, prices and total limit',()=>{
 const p=freePlan();p.costs.paidBudgetCny=1.4;
 const c={apiKey:'selftest-placeholder-not-a-real-key',workspaceId:'selftest-workspace'};
 assert.ok(gate(p,null,c).includes('PAID_AUTHORIZATION_REQUIRED'));
 const a={status:'USER_APPROVED',scope:'THIS_EXPERIMENT_IMAGES_ONLY',maxCostCny:1.4,maxSubmissions:8,planSha256:sha(Buffer.from(JSON.stringify(p)))};
 assert.deepEqual(gate(p,null,c,Date.now(),a),[]);
 const wrong=structuredClone(p);wrong.costs.listPricePerOutput[p.models[0]]=0.5;
 assert.ok(gate(wrong,null,c,Date.now(),a).length);
 assert.ok(gate(p,null,c,Date.now(),{...a,maxCostCny:2}).length);
});
test('reservations count failed or uncertain attempts and block duplicate spending',()=>{
 const pro='qwen-image-2.1-pro',turbo='qwen-image-2.1-turbo';
 const complete=Array.from({length:4},()=>({model:pro,status:'PIXEL_ALPHA_PASSED_VISUAL_REVIEW_PENDING'})).concat(Array.from({length:4},()=>({model:turbo,status:'PIXEL_ALPHA_PASSED_VISUAL_REVIEW_PENDING'})));
 assert.ok(reservationGate(complete,turbo).includes('MAX_SUBMISSIONS_REACHED'));
 assert.ok(reservationGate(complete,pro).includes('BUDGET_RESERVATION_EXCEEDED'));
 assert.ok(reservationGate([{model:pro,status:'SUBMISSION_UNCERTAIN_DO_NOT_RESUBMIT'}],turbo).includes('UNRESOLVED_PRIOR_SUBMISSION'));
 assert.deepEqual(reservationGate([{model:pro,status:'PROVIDER_REJECTED'}],turbo),[]);
});
