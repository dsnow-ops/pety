const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('common/sms-send-gate.js','utf8').replace(/^import[^;]+;/gm,'').replace(/export /g,'');
const {createSmsSendGate}=Function(source+';return{createSmsSendGate};')();
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{resolve,reject,promise}};
function setup(){let time=100000,calls=0;const disk=new Map(),pending=[];
 const storage={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,structuredClone(v))};
 const create=()=>createSmsSendGate({storage,now:()=>time,send:()=>{calls++;const p=deferred();pending.push(p);return p.promise}});
 return{disk,storage,pending,create,advance:n=>time+=n,calls:()=>calls};}
const options={captcha:'abcd'};
test('one send survives duplicate taps, page recreation and a background interval pause without persisting contacts or codes',async()=>{
 const s=setup(),g=s.create();const work=g.request('13800000000',options);
 await assert.rejects(g.request('13900000000',options),{errCode:'pety-sms-cooldown'});assert.equal(s.calls(),1);
 const next=s.create();assert.equal(next.snapshot().status,'unknown');s.advance(43000);assert.equal(next.snapshot().remaining,17);
 s.pending[0].resolve({errCode:0});await work;assert.equal(g.snapshot().status,'accepted');assert.equal(g.snapshot().remaining,60);
 for(const value of s.disk.values())assert.deepEqual(Object.keys(value).sort(),['deadline','status']);
 const restarted=s.create();s.advance(61000);assert.equal(restarted.snapshot().remaining,0);
});
test('transport uncertainty and invalid acknowledgements retain cooldown and never automatically resend',async()=>{
 for(const result of [null,{}, {errCode:'UNKNOWN'}]){
  const s=setup(),g=s.create(),work=g.request('13800000000',options);const reject=assert.rejects(work);s.pending[0].resolve(result);await reject;
  assert.equal(g.snapshot().status,'unknown');await assert.rejects(g.request('13800000000',options),{errCode:'pety-sms-cooldown'});assert.equal(s.calls(),1);
 }
 const s=setup(),g=s.create(),work=g.request('13800000000',options);const rejected=assert.rejects(work);s.pending[0].reject(Error('timeout'));await rejected;
 assert.equal(s.create().snapshot().remaining,60);assert.equal(g.snapshot().status,'unknown');
});
test('captcha rejection permits correction while service throttling keeps the cooldown',async()=>{
 for(const [errCode,remaining] of [['uni-captcha-verify-fail',0],['uni-id-invalid-sms-template-id',0],['uni-id-sms-send-failed',60]]){
  const s=setup(),g=s.create(),work=g.request('13800000000',options);const rejected=assert.rejects(work);s.pending[0].resolve({errCode});await rejected;assert.equal(g.snapshot().remaining,remaining);
 }
});
test('storage failure prevents dispatch; acknowledgement storage failure cannot cause another SMS',async()=>{
 const s=setup();s.storage.setStorageSync=()=>{throw Error('disk')};await assert.rejects(s.create().request('13800000000',options),{errCode:'pety-sms-cooldown-storage'});assert.equal(s.calls(),0);
 const b=setup(),g=b.create(),work=g.request('13800000000',options);b.storage.setStorageSync=()=>{throw Error('disk')};b.pending[0].resolve({errCode:0});await work;
 assert.equal(g.snapshot().status,'accepted');assert.equal(b.create().snapshot().status,'unknown');assert.equal(b.create().snapshot().remaining,60);
});
test('a request still in flight remains blocked even after local deadline elapses',async()=>{
 const s=setup(),g=s.create(),work=g.request('13800000000',options);s.advance(70000);
 await assert.rejects(g.request('13800000000',options),{errCode:'pety-sms-cooldown'});assert.equal(s.calls(),1);s.pending[0].resolve({errCode:0});await work;
});
