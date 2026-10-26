'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
function harness(mode='ok'){
 const file=path.resolve('uniCloud-alipay/cloudfunctions/api_deepseek/index.js'),load=createRequire(file),m={exports:{}},rows=new Map();let calls=0,verifies=0;
 const col={doc:id=>({get:async()=>{if(mode==='lookup-outage')throw Error('TEST_PRIVATE_DATABASE_FAILURE');return {data:rows.has(id)?[{...rows.get(id)}]:[]};}}),add:async row=>{if(rows.has(row._id))throw Error('duplicate');rows.set(row._id,{...row});return{id:row._id};},where:q=>({update:async p=>{const r=rows.get(q._id);if(!r||r.count>=q.count.lt)return{updated:0};r.count+=p.count.inc;return{updated:1};}})};
 const logs=[];
 const cloud={database:()=>({command:{lt:lt=>({lt}),inc:inc=>({inc})},collection:()=>col}),httpclient:{request:async()=>{calls++;if(mode==='transport-error')throw Error('__PRIVATE_MARKER__');if(mode==='http-error')return{status:401,data:{error:{message:'__PRIVATE_MARKER__'}}};return{status:200,data:{choices:[{message:{content:'宠物最近食欲变化建议记录观察并联系兽医。'}}]}}}}};
 const auth={verifyRequest:async e=>{verifies++;if(mode==='auth-outage')throw{errCode:'TEST_PRIVATE_MARKER',message:'TEST_PRIVATE_MARKER'};if(e.uniIdToken==='expired')throw{errCode:'uni-id-token-expired'};return e.uniIdToken==='synthetic-A'?{uid:'account-A'}:{uid:null};},authErrorResult:e=>({errCode:e.errCode==='uni-id-token-expired'?e.errCode:'pety-auth-service-unavailable'})};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,__dirname:path.dirname(file),require:n=>n==='pety-auth/cost-budget'?{reserve:async input=>{assert.equal(input.uid,'account-A');assert.equal(input.feature,'ai');}}:n==='fs'?{existsSync:()=>false}:n==='pety-auth/sessions'?{enabled:()=>false,admit:async()=>true}:n==='pety-auth'?auth:n==='uni-config-center'?()=>({config:()=>({deepseek:{apiKey:'synthetic-key'}})}):load(n),process:{env:{}},Buffer,URL,Date,console:{info(...args){logs.push(args);},warn(...args){logs.push(args);},error(...args){logs.push(args);}},uniCloud:cloud});
 return{main:m.exports.main,logs,stats:()=>({calls,verifies,rows:rows.size})};
}
test('AI entry rejects unverified identity for chat and legacy jobs before any provider or quota writes',async()=>{
 const h=harness();for(const requestType of ['chat','createSimilarCaseSearch','processSimilarCaseSearch','getSimilarCaseSearchStatus','memorial_persona_builder','memorial_daily_reflection']){
  const r=await h.main({requestType,userMessage:'我的猫今天食欲不好，怎样记录变化？',uid:'account-A',dev:true},{UID:'account-A',DEVICEID:'claimed-device'});assert.equal(r.code,403,requestType);
 }assert.equal(h.stats().calls,0);assert.equal(h.stats().rows,0);assert.equal(h.stats().verifies,6);
});
test('verified user keeps one quota pool when changing device, IP, OPENID and ambient token claims',async()=>{
 const h=harness(),codes=[];for(let i=0;i<5;i++)codes.push((await h.main({requestType:'chat',uniIdToken:'synthetic-A',userMessage:'我的猫今天食欲不好，怎样记录变化？',isMember:true},{UID:'victim',OPENID:'claim-'+i,UNI_ID_TOKEN:'claim-'+i,DEVICEID:'device-'+i,CLIENTIP:'ip-'+i})).code);
 assert.deepEqual(codes,[0,0,0,429,429]);assert.deepEqual(h.stats(),{calls:3,verifies:5,rows:1});
});
test('public health response contains only liveness and never loads runtime configuration',async()=>{
 const h=harness(),r=await h.main({action:'healthCheck'},{});assert.deepEqual(JSON.parse(JSON.stringify(r)),{ok:true});assert.equal(h.stats().calls,0);
});

test('AI authentication outage returns 503 and only the sanitized error code before any paid work',async()=>{
 const h=harness('auth-outage'),result=await h.main({requestType:'chat',uniIdToken:'synthetic-A',userMessage:'TEST question'},{});
 assert.equal(result.code,503);assert.equal(result.errorCode,'pety-auth-service-unavailable');assert.doesNotMatch(JSON.stringify(result),/TEST_PRIVATE_MARKER/);assert.equal(h.stats().calls,0);assert.equal(h.stats().rows,0);
 const expired=harness(),denied=await expired.main({uniIdToken:'expired'},{});assert.equal(denied.code,403);assert.equal(denied.errorCode,'uni-id-token-expired');
});

test('provider and transport failure details do not enter user responses or cloud logs',async()=>{
 for(const mode of ['http-error','transport-error']){
  const h=harness(mode),result=await h.main({requestType:'chat',uniIdToken:'synthetic-A',userMessage:'我的猫今天食欲不好，怎样记录变化？'},{});
  assert.equal(result.code,502);assert.doesNotMatch(JSON.stringify(result),/__PRIVATE_MARKER__/);assert.doesNotMatch(JSON.stringify(h.logs),/__PRIVATE_MARKER__/);assert.ok(h.logs.length>0);
 }
});
test('unexpected job lookup outage returns a safe correlated response without retry or paid calls',async()=>{
 const h=harness('lookup-outage');const result=await h.main({requestType:'getSimilarCaseSearchStatus',searchJobId:'search_'+'a'.repeat(40),uniIdToken:'synthetic-A'},{});
 assert.equal(result.code,503);assert.equal(result.errorCode,'AI_SERVICE_UNAVAILABLE');assert.match(result.traceId,/^[a-f0-9]{24}$/);assert.doesNotMatch(JSON.stringify([result,h.logs]),/TEST_PRIVATE_DATABASE_FAILURE/);assert.equal(h.stats().calls,0);assert.equal(h.stats().verifies,1);
 const completed=h.logs.filter(row=>row[0]==='pety_api_completed');assert.equal(completed.length,1);assert.equal(completed[0][1].traceId,result.traceId);assert.equal(completed[0][1].outcome,'unexpected_error');
});
