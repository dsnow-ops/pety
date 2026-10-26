'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
function harness(hooks={}){
 const file=path.resolve('uniCloud-alipay/cloudfunctions/api_deepseek/index.js'),load=createRequire(file),module={exports:{}},rows=new Map(),logs=[];
 const calls={reads:0,adds:0,updates:0,http:0,cost:0};
 const db={command:{lt:lt=>({lt}),inc:inc=>({inc})},collection:name=>({
  doc:id=>({get:async()=>{calls.reads++;const normal={data:rows.has(id)?[structuredClone(rows.get(id))]:[]};return hooks.read?hooks.read(normal,{name,id,calls}):normal;}}),
  add:async row=>{calls.adds++;if(rows.has(row._id))throw Error('E11000 duplicate');rows.set(row._id,structuredClone(row));return hooks.add?hooks.add(row,calls):{id:row._id}},
  where:q=>({update:async patch=>{calls.updates++;const row=rows.get(q._id);if(hooks.update)return hooks.update(row,patch,calls);if(!row||row.count>=q.count.lt)return{updated:0};row.count+=patch.count.inc;return{updated:1}}})
 })};
 vm.runInNewContext(fs.readFileSync(process.env.PETY_AI_RATE_BEFORE||file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),process:{env:{}},Buffer,URL,Date,
  console:{info:(...args)=>logs.push(args),warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
  uniCloud:{database:()=>db,httpclient:{request:async()=>{calls.http++;return{status:200,data:{choices:[{message:{content:'TEST response'}}]}}}}},
  require:n=>n==='fs'?{existsSync:()=>false}:n==='pety-auth'?{verifyRequest:async()=>({uid:'TEST-rate-owner'})}:n==='pety-auth/sessions'?{admit:async()=>true}:n==='pety-auth/cost-budget'?{reserve:async()=>{calls.cost++;}}:n==='uni-config-center'?()=>({config:()=>({deepseek:{apiKey:'TEST-not-a-real-key'},rateLimit:{membershipLookupEnabled:hooks.membership===true}})}):load(n)
 });
 return{calls,rows,logs,run:()=>module.exports.main({requestType:'chat',uniIdToken:'TEST-token',userMessage:'我的猫今天食欲不好，怎样记录变化？'},{} )};
}
const unavailable=result=>assert.equal(result.code,500);
test('AI malformed and errored quota reads cannot create a fresh counter or call a provider',async()=>{
 for(const response of [{},{data:[],errCode:'TEST_PRIVATE_DB_ERROR'},{data:null},{data:[null]},{data:[{},{}]}]){
  const h=harness({read:()=>response});unavailable(await h.run());assert.equal(h.calls.adds,0);assert.equal(h.calls.http,0);assert.equal(h.calls.cost,0);
  assert.doesNotMatch(JSON.stringify(h.logs),/TEST_PRIVATE_DB_ERROR/);
 }
});
test('AI quota insert requires matching id acknowledgement and unknown insert never retries',async()=>{
 for(const response of [undefined,{}, {id:'wrong'},{errCode:'TEST_PRIVATE_DB_ERROR'}]){
  const h=harness({add:()=>response});unavailable(await h.run());assert.equal(h.calls.adds,1);assert.equal(h.calls.updates,0);assert.equal(h.calls.http,0);assert.equal([...h.rows.values()][0].count,1);
 }
});
test('AI ambiguous quota increments retain conservative count without a second increment or paid work',async()=>{
 for(const response of [undefined,{}, {updated:'1'},{updated:1,errCode:'TEST_PRIVATE_DB_ERROR'},{updated:0,affectedDocs:1},{updated:2}]){
  const h=harness({update:(row,patch)=>{row.count+=patch.count.inc;return response;}});assert.equal((await h.run()).code,0);
  unavailable(await h.run());assert.equal(h.calls.updates,1);assert.equal(h.calls.http,1);assert.equal(h.calls.cost,1);assert.equal([...h.rows.values()][0].count,2);
 }
});
test('AI wrong owner, period, identity and invalid counts never increment',async()=>{
 for(const patch of [{_id:'wrong'},{identityHash:'wrong'},{date:'2001-01-01'},{period:'2001-01-01'},{scope:'month'},{plan:'plus'},{count:'1'},{count:-1},{count:NaN}]){
  const h=harness();assert.equal((await h.run()).code,0);Object.assign([...h.rows.values()][0],patch);unavailable(await h.run());assert.equal(h.calls.updates,0);assert.equal(h.calls.http,1);
 }
});
test('AI post-increment read failure cannot guess a remaining count and dispatch',async()=>{
 for(const response of [{data:[]},{data:[],errCode:'TEST_PRIVATE_DB_ERROR'},{}]){
  const h=harness({read:(normal,{calls})=>calls.updates?response:normal});assert.equal((await h.run()).code,0);unavailable(await h.run());assert.equal(h.calls.updates,1);assert.equal(h.calls.http,1);assert.equal([...h.rows.values()][0].count,2);
 }
});
test('AI optional membership lookup outage cannot silently switch to a free quota',async()=>{
 for(const response of [{data:[],errCode:'TEST_PRIVATE_DB_ERROR'},{}]){
  const h=harness({membership:true,read:(normal,{name})=>name==='pety_memberships'?response:normal});unavailable(await h.run());assert.equal(h.calls.adds,0);assert.equal(h.calls.http,0);
 }
});
test('AI concurrent verified requests obey the existing three-call ceiling',async()=>{
 const h=harness();const results=await Promise.all(Array.from({length:16},()=>h.run()));assert.equal(results.filter(r=>r.code===0).length,3);assert.equal(h.calls.http,3);assert.equal(h.calls.cost,3);assert.equal([...h.rows.values()][0].count,3);assert.ok(results.every(r=>[0,429].includes(r.code)));
});
test('AI confirmed zero increments may retry but never grant a request below the ceiling',async()=>{
 const h=harness({update:()=>({updated:0})});assert.equal((await h.run()).code,0);assert.equal((await h.run()).code,429);assert.equal(h.calls.updates,2);assert.equal(h.calls.http,1);
});
test('AI legacy counters without optional window fields retain the original ceiling',async()=>{
 const h=harness();assert.equal((await h.run()).code,0);const row=[...h.rows.values()][0];delete row.period;delete row.scope;delete row.plan;
 assert.equal((await h.run()).code,0);assert.equal((await h.run()).code,0);assert.equal((await h.run()).code,429);assert.equal(h.calls.http,3);
});

test('AI valid plus lookup retains monthly quota and concurrent calls cannot exceed 300',async()=>{
 const h=harness({membership:true,read:(normal,{name,id})=>name==='pety_memberships'?{data:[{_id:id,userId:'TEST-rate-owner',plan:'plus',status:'active',expiresAt:Date.now()+60000}]}:normal});
 const first=await h.run();assert.equal(first.code,0);assert.equal(first.plan,'plus');assert.equal(first.scope,'month');assert.equal(first.remaining,299);
 const row=[...h.rows.values()][0];row.count=299;const results=await Promise.all(Array.from({length:8},()=>h.run()));
 assert.equal(results.filter(r=>r.code===0).length,1);assert.equal(row.count,300);assert.equal(h.calls.http,2);assert.ok(results.every(r=>[0,429].includes(r.code)));
});

test('AI successful increment receipt with an unchanged reread does not authorize a model',async()=>{
 const h=harness({update:()=>({updated:1})});assert.equal((await h.run()).code,0);unavailable(await h.run());assert.equal(h.calls.updates,1);assert.equal(h.calls.http,1);assert.equal([...h.rows.values()][0].count,1);
});
