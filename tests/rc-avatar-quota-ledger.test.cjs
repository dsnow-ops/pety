const test=require('node:test'),assert=require('node:assert/strict');
const {createQuotaLedger,seedEntries}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-quota-ledger');
function harness(history=[]) {
 const rows=new Map();let outage=false;const copy=v=>JSON.parse(JSON.stringify(v));
 const collection={
  doc:id=>({get:async()=>{if(outage)throw Error('offline');return{data:rows.has(id)?[copy(rows.get(id))]:[]}}}),
  add:async row=>{if(rows.has(row._id))throw Error('E11000');rows.set(row._id,copy(row));return{id:row._id};},
  where:q=>({update:async patch=>{
   const row=rows.get(q._id);if(!row||!Object.entries(q).every(([k,v])=>row[k]===v))return{updated:0};
   Object.assign(row,copy(patch));return{updated:1};
  }})
 };
 return{ledger:createQuotaLedger(collection,async()=>history),outage:()=>outage=true};
}
const free={owner:'A',pet:'cat',pool:'free',cycle:'free-lifetime'};
test('concurrent requests reserve exactly three free slots, duplicate consumes are idempotent',async()=>{
 const {ledger:l}=harness();const result=await Promise.allSettled(Array.from({length:8},(_,i)=>l.reserve(free,`request_${i}`)));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,3);assert.deepEqual(await l.read(free),{used:0,reserved:3});
 await Promise.all([l.consume(free,'request_0'),l.consume(free,'request_0')]);await l.release(free,'request_0');assert.deepEqual(await l.read(free),{used:1,reserved:2});
});
test('free pet pools isolate while member concurrent pets share ten; owners never share',async()=>{
 const {ledger:l}=harness();for(let i=0;i<3;i++)await l.reserve(free,`r${i}`);
 await l.reserve({...free,pet:'dog'},'dog');await l.reserve({...free,owner:'B'},'r0');
 const member={...free,pool:'member',cycle:'cycle'};const r=await Promise.allSettled(Array.from({length:12},(_,i)=>l.reserve({...member,pet:`p${i}`},`m${i}`)));
 assert.equal(r.filter(v=>v.status==='fulfilled').length,10);
});
test('pending/unknown stays reserved; definitive failure releases; history never initializes at zero',async()=>{
 const history=[{jobId:'old',status:'SUCCEEDED',resultSaved:true},{jobId:'old',status:'SUCCEEDED',resultSaved:true},{jobId:'pending',status:'SUBMISSION_UNKNOWN'}];
 assert.equal(Object.keys(seedEntries(history)).length,2);
 const {ledger:l,outage}=harness(history);assert.deepEqual(await l.read(free),{used:1,reserved:1});
 await l.reserve(free,'new');assert.equal((await l.reserve(free,'new')).fresh,false);
 await assert.rejects(l.reserve(free,'extra'),e=>e.code==='AVATAR_QUOTA_EXCEEDED');
 await l.release(free,'new');await l.reserve(free,'replacement');outage();await assert.rejects(l.reserve(free,'offline'));
});
