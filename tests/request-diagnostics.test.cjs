const test=require('node:test'),assert=require('node:assert/strict');
const {withRequestDiagnostics}=require('../uniCloud-alipay/cloudfunctions/api_deepseek/request-diagnostics');
const PRIVATE='TEST_PRIVATE_PROMPT_TOKEN_URL_ERROR';
test('parallel invocations receive distinct server IDs and exactly one bounded completion record each',async()=>{
 const logs=[],run=withRequestDiagnostics(async()=>({code:0,reply:'TEST reply',remaining:2}),{info:(...v)=>logs.push(v)});
 const results=await Promise.all(Array.from({length:12},()=>run({requestType:'chat',traceId:PRIVATE,userMessage:PRIVATE,uniIdToken:PRIVATE},{UID:PRIVATE})));
 assert.equal(new Set(results.map(r=>r.traceId)).size,12);assert.equal(logs.length,12);
 for(const r of results){assert.match(r.traceId,/^[a-f0-9]{24}$/);assert.equal(r.reply,'TEST reply');assert.equal(r.remaining,2);assert.equal(logs.filter(l=>l[1].traceId===r.traceId).length,1);}
 assert.doesNotMatch(JSON.stringify(logs),new RegExp(PRIVATE));assert.deepEqual(Object.keys(logs[0][1]).sort(),['code','elapsedMs','outcome','scene','service','traceId']);
});
test('unexpected rejected promises and malformed responses fail closed without automatic retries or private logs',async()=>{
 for(const value of [null,undefined,[],{code:PRIVATE},{code:Infinity},{code:-1}]){
  let calls=0;const logs=[],run=withRequestDiagnostics(async()=>{calls++;return value;},{info:(...v)=>logs.push(v)}),result=await run({requestType:PRIVATE},{});
  assert.equal(result.code,503);assert.equal(calls,1);assert.equal(logs[0][1].scene,'unsupported');assert.doesNotMatch(JSON.stringify([result,logs]),new RegExp(PRIVATE));
 }
 let calls=0;const logs=[],run=withRequestDiagnostics(async()=>{calls++;throw Object.assign(Error(PRIVATE),{code:PRIVATE,body:PRIVATE});},{info:(...v)=>logs.push(v)}),r=await run({},{});
 assert.equal(r.code,503);assert.equal(calls,1);assert.equal(logs[0][1].outcome,'unexpected_error');assert.doesNotMatch(JSON.stringify([r,logs]),new RegExp(PRIVATE));
});
test('known denial, rate limit and provider failures retain their business response and do not rerun',async()=>{
 for(const code of [400,401,403,409,422,429,500,502,503]){let calls=0;const r=await withRequestDiagnostics(async()=>{calls++;return {code,errorCode:'TEST_KNOWN_CODE',msg:'TEST safe message'};},{info(){}})({},{});assert.equal(r.code,code);assert.equal(r.errorCode,'TEST_KNOWN_CODE');assert.equal(calls,1);}
});
test('public health shape stays minimal and logging failure does not turn success into failure',async()=>{
 const run=withRequestDiagnostics(async()=>({ok:true}),{info(){throw Error('TEST log failure')}});assert.deepEqual(await run({action:'healthCheck'},{}),{ok:true});
 const ok=await withRequestDiagnostics(async()=>({code:0,reply:'TEST preserved'}),{info(){throw Error('TEST log failure')}})({},{});assert.equal(ok.code,0);assert.equal(ok.reply,'TEST preserved');
});
test('diagnostic duration is bounded even when the wall clock moves backwards or is invalid',async()=>{
 for(const end of [-100,Infinity,100000000000]){const rows=[],clock=[100,end];await withRequestDiagnostics(async()=>({code:0}),{info:(_,r)=>rows.push(r)},()=>clock.shift())({},{});assert.ok(rows[0].elapsedMs>=0&&rows[0].elapsedMs<=86400000);}
});
