'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createCostBudget}=require(path.resolve(process.env.PETY_BUDGET_SOURCE||'uniCloud-alipay/cloudfunctions/common/pety-auth/cost-budget.js'));
const request={uid:'TEST-budget-owner',feature:'ai'};
function fixture(hooks={}){
 const rows=new Map(),calls={reads:0,adds:0,updates:0,provider:0};
 const db={command:{lt:n=>({lt:n}),inc:n=>({inc:n})},collection:()=>({
  doc:id=>({get:async()=>{calls.reads++;const normal={data:rows.has(id)?[{...rows.get(id)}]:[]};return hooks.read?hooks.read(normal,id,calls):normal;}}),
  add:async row=>{calls.adds++;if(rows.has(row._id))throw Object.assign(Error('duplicate key'),{code:'E11000'});if(hooks.add)return hooks.add(row,rows,calls);rows.set(row._id,{...row});return{id:row._id};},
  where:q=>({update:async patch=>{calls.updates++;const row=rows.get(q._id);if(hooks.update)return hooks.update(row,patch,calls);if(!row||row.count>=q.count.lt)return{updated:0};row.count+=patch.count.inc;return{updated:1};}})
 })};
 const budget=createCostBudget(db,{aiAccountDay:3,aiGlobalDay:5},()=>Date.UTC(2026,9,23));
 return{db,rows,calls,budget,async dispatch(){await budget.reserve(request);calls.provider++;}};
}
const unavailable=e=>e.code==='PROVIDER_BUDGET_UNAVAILABLE';
test('malformed or error-bearing budget reads never create a counter or dispatch',async()=>{
 for(const result of [{data:[],errCode:'DB_DOWN'},{data:[null]},{data:[{},{}]},{},{data:null}]){
  const h=fixture({read:()=>result});await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.adds,0);assert.equal(h.calls.provider,0);
 }
});
test('missing, mismatched and error-bearing create acknowledgements block dispatch without write retry',async()=>{
 for(const reply of [undefined,{}, {id:'wrong'}, {errCode:'DB_DOWN'}, {error:{message:'unavailable'}}]){
  const h=fixture({add:()=>reply});await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.adds,1);assert.equal(h.calls.reads,1);assert.equal(h.calls.provider,0);
 }
 const h=fixture({add:row=>({id:row._id,errCode:'DB_DOWN'})});await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.adds,1);
});
test('create committed with a lost receipt remains conservatively counted and cannot authorize a provider',async()=>{
 const h=fixture({add:(row,rows)=>{rows.set(row._id,{...row});throw Error('timeout after commit');}});
 await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.adds,1);assert.equal([...h.rows.values()][0].count,1);assert.equal(h.calls.provider,0);
});
test('ambiguous increment receipts neither dispatch nor increment again',async()=>{
 for(const reply of [undefined,{}, {updated:'1'},{updated:1,errCode:'DB_DOWN'},{updated:0,affectedDocs:1},{updated:2},{updated:-1}]){
  let fail=false;const h=fixture({update:(row,patch)=>{row.count+=patch.count.inc;return fail?reply:{updated:1};}});
  await h.dispatch();fail=true;await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.updates,1);assert.equal(h.calls.provider,1);assert.equal([...h.rows.values()].find(r=>r._id.includes('_account_')).count,2);
 }
});
test('wrong-owner and invalid counter rows block reservation',async()=>{
 for(const change of [row=>({...row,_id:'other'}),row=>({...row,count:-1}),row=>({...row,count:'1'}),row=>({...row,count:NaN})]){
  let corrupt=false;const h=fixture({read:result=>corrupt?{data:result.data.map(change)}:result});await h.dispatch();corrupt=true;
  await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.updates,0);assert.equal(h.calls.provider,1);
 }
});
test('a confirmed duplicate create may reread once; an unknown create error cannot masquerade as a duplicate',async()=>{
 const h=fixture({add:(row,rows)=>{rows.set(row._id,{...row});throw Object.assign(Error('duplicate key'),{code:'E11000'});}});
 await h.dispatch();assert.equal(h.calls.provider,1);assert.equal(h.calls.adds,2);assert.equal(h.calls.updates,2);
 const bad=fixture({add:()=>{throw Error('invalid _id format');}});await assert.rejects(bad.dispatch(),unavailable);assert.equal(bad.calls.adds,1);
});
test('confirmed zero increments reread the ceiling; persistent zero below ceiling reports unavailable',async()=>{
 let zero=false;const h=fixture({update:row=>{if(zero)return{updated:0};row.count++;return{updated:1};}});await h.dispatch();zero=true;
 await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.updates,2);assert.equal(h.calls.provider,1);
 let hit=false;const full=fixture({update:row=>{if(hit){row.count=3;return{updated:0};}row.count++;return{updated:1};}});await full.dispatch();hit=true;
 await assert.rejects(full.dispatch(),e=>e.code==='PROVIDER_BUDGET_EXCEEDED');assert.equal(full.calls.updates,1);
});
test('global admission failure retains the account reservation without refund or provider work',async()=>{
 const h=fixture({add:(row,rows)=>{if(row._id.includes('_global_'))return{};rows.set(row._id,{...row});return{id:row._id};}});
 await assert.rejects(h.dispatch(),unavailable);assert.equal(h.calls.provider,0);assert.equal([...h.rows.values()][0].count,1);
});
test('actual AI entry performs no HTTP work on an unconfirmed cost write and can recover on an explicit next request',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
 let fault=true,httpCalls=0;const logs=[];
 const h=fixture({add:(row,rows)=>{if(fault&&row._id.startsWith('ai_account_'))return{errCode:'TEST_PRIVATE_DB_FAILURE'};rows.set(row._id,{...row});return{id:row._id};}});
 const file=path.resolve('uniCloud-alipay/cloudfunctions/api_deepseek/index.js'),load=createRequire(file),module={exports:{}};
 const cloud={database:()=>h.db,httpclient:{request:async()=>{httpCalls++;return{status:200,data:{choices:[{message:{content:'TEST response'}}]}};}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),process:{env:{}},Buffer,URL,Date,uniCloud:cloud,
  console:{info:(...args)=>logs.push(args),warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
  require:name=>name==='pety-auth/cost-budget'?h.budget:name==='pety-auth'?{verifyRequest:async()=>({uid:request.uid}),authErrorResult:()=>({errCode:'pety-auth-service-unavailable'})}:name==='pety-auth/sessions'?{enabled:()=>false,admit:async()=>true}:name==='fs'?{existsSync:()=>false}:name==='uni-config-center'?()=>({config:()=>({deepseek:{apiKey:'TEST-not-a-real-key'}})}):load(name)
 });
 const event={requestType:'chat',uniIdToken:'TEST-token',userMessage:'我的猫今天食欲不好，怎样记录变化？'};
 const failed=await module.exports.main(event,{});assert.notEqual(failed.code,0);assert.equal(httpCalls,0);assert.doesNotMatch(JSON.stringify([failed,logs]),/TEST_PRIVATE_DB_FAILURE/);
 fault=false;const recovered=await module.exports.main(event,{});assert.equal(recovered.code,0);assert.equal(httpCalls,1);
});
