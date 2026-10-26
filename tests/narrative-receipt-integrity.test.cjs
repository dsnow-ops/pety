'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runNarrativePolish}=require('../uniCloud-alipay/cloudfunctions/api_deepseek/narrative-polish');
const config={security:{maxUserMessageChars:600},deepseek:{model:'existing-model',thinking:{type:'disabled'},maxTokens:300,temperature:.7,requestTimeoutMs:15000,baseUrl:'https://example.invalid',apiKey:'TEST-fixture'}};
const event={action:'narrative_polish',petId:'TEST-pet',userMessage:'今天窗边看见了你。',style:'preserve',draftId:'TEST-draft',revision:1,clientRequestId:'TEST-request',narrativeConsent:true};
function fixture(){
 const rows=new Map(),fault={},counts={calls:0,rates:0,adds:0,removes:0};
 const value=(key,normal)=>Object.hasOwn(fault,key)?fault[key]:normal;
 const db={collection:name=>name==='pet_avatar_jobs'?{where:q=>({limit:()=>({get:async()=>value('owned',{data:[q]})})})}:{
  doc:id=>({get:async()=>value('read',{data:rows.has(id)?[rows.get(id)]:[]})}),
  add:async row=>{counts.adds++;if(rows.has(row._id))throw Error('duplicate');rows.set(row._id,row);return value('add',{id:row._id});},
  where:q=>({
   update:async patch=>{const r=rows.get(q._id);if(!r||!Object.entries(q).every(([k,v])=>r[k]===v))return{updated:0};Object.assign(r,patch);return value(q.status==='claimed'?'start':'finish',{updated:1});},
   remove:async()=>{counts.removes++;rows.delete(q._id);return value('remove',{deleted:1});}
  })
 }};
 const deps={verify:async()=>({uid:'TEST-A'}),db:()=>db,rate:async()=>{counts.rates++;return value('rate',{allowed:true,remaining:8});},request:async()=>{counts.calls++;return{status:200,data:{choices:[{finish_reason:'stop',message:{content:'TEST候选'}}]}};}};
 return{rows,fault,counts,deps,run:()=>runNarrativePolish(event,{},config,deps)};
}
test('narrative ownership error/null/wrong-owner cannot authorize or consume rate budget',async()=>{
 for(const response of [{data:[],errCode:'TEST_PRIVATE'},{data:[null]},{data:[{quotaOwnerHash:'OTHER',petHash:'OTHER'}]},{data:[{}]},{}]){
  const h=fixture();h.fault.owned=response;const r=await h.run();assert.equal(r.code,503);assert.equal(h.counts.calls,0);assert.equal(h.counts.rates,0);assert.doesNotMatch(JSON.stringify(r),/TEST_PRIVATE/);
 }
 const empty=fixture();empty.fault.owned={data:[]};assert.equal((await empty.run()).code,403);
});
test('narrative malformed previous receipts cannot masquerade as an empty slot',async()=>{
 for(const response of [{data:[],code:5000},{data:[null]},{}]){const h=fixture();h.fault.read=response;assert.equal((await h.run()).code,503);assert.equal(h.counts.adds,0);assert.equal(h.counts.calls,0);}
});
test('an unconfirmed narrative claim never consumes rate or invokes the provider',async()=>{
 for(const response of [undefined,{}, {id:'OTHER'},{id:'ignored',errCode:'TEST_PRIVATE'}]){const h=fixture();h.fault.add=response;assert.equal((await h.run()).code,503);assert.equal(h.counts.rates,0);assert.equal(h.counts.calls,0);assert.equal(h.counts.adds,1);}
});
test('ambiguous narrative running transitions never invoke the provider',async()=>{
 for(const response of [{updated:1,affectedDocs:0},{updated:2},{updated:'1'},{updated:1,errCode:'TEST_PRIVATE'},{}]){const h=fixture();h.fault.start=response;assert.equal((await h.run()).code,503);assert.equal(h.counts.calls,0);}
 const race=fixture();race.fault.start={updated:0};assert.equal((await race.run()).code,409);assert.equal(race.counts.calls,0);
});
test('malformed rate responses cannot approve paid narrative work',async()=>{
 for(const response of [{allowed:'yes'},{allowed:1},{}]){const h=fixture();h.fault.rate=response;assert.equal((await h.run()).code,503);assert.equal(h.counts.calls,0);}
});
test('ambiguous completion remains unknown and never resubmits the model automatically',async()=>{
 for(const response of [{updated:1,affectedDocs:0},{updated:2},{updated:1,errCode:'TEST_PRIVATE'},{}]){const h=fixture();h.fault.finish=response;assert.equal((await h.run()).errorCode,'NARRATIVE_OUTCOME_UNKNOWN');assert.equal((await h.run()).code,409);assert.equal(h.counts.calls,1);}
});
test('damaged expired receipts and uncertain removal stop before a replacement claim',async()=>{
 for(const patch of [{expiresAt:NaN},{status:'unrecognized'},{ownerHash:'OTHER'},{petHash:'OTHER'},{providerCalls:'0'}]){
  const h=fixture();assert.equal((await h.run()).code,0);const row=[...h.rows.values()][0];Object.assign(row,{expiresAt:Date.now()-1},patch);assert.equal((await h.run()).code,503);assert.equal(h.counts.calls,1);assert.equal(h.counts.removes,0);
 }
 for(const response of [{deleted:1,affectedDocs:0},{deleted:2},{deleted:1,code:5000},{}]){const h=fixture();await h.run();[...h.rows.values()][0].expiresAt=Date.now()-1;h.fault.remove=response;assert.equal((await h.run()).code,503);assert.equal(h.counts.adds,1);assert.equal(h.counts.calls,1);}
});
test('valid receipts still permit one candidate and a later confirmed retry after expiry',async()=>{
 const h=fixture();assert.equal((await h.run()).code,0);assert.equal((await h.run()).code,409);[...h.rows.values()][0].expiresAt=Date.now()-1;assert.equal((await h.run()).code,0);assert.equal(h.counts.calls,2);
});
