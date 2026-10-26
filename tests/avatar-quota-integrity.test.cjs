const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createQuotaLedger,ledgerId}=require(path.resolve(process.env.PETY_QUOTA_BEFORE||'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-quota-ledger.js'));
const scope={owner:'TEST-owner',pet:'TEST-cat',pool:'free',cycle:'free-lifetime'};
const invalid={code:'AVATAR_QUOTA_STATE_INVALID'};
function harness(faults={},transactional=false){
 let row=null,updates=0,adds=0;const copy=structuredClone;
 const collection={doc:()=>({get:async()=>faults.read?faults.read(row):{data:transactional?copy(row):row?[copy(row)]:[]},update:patch=>update(patch)}),
  add:async value=>{adds++;row=copy(value);return faults.add?faults.add(row):{id:row._id}},
  where:query=>({update:patch=>row.version!==query.version?{updated:0}:update(patch)})};
 async function update(patch){updates++;Object.assign(row,copy(patch));return faults.update?faults.update(row):{updated:1}}
 return {ledger:createQuotaLedger(collection,async()=>faults.history||[],v=>v,{transactional}),row:()=>row,counts:()=>({updates,adds})};
}
test('quota rejects errored and malformed normal or transaction reads before initialization',async()=>{
 for(const transactional of [false,true])for(const response of [{data:transactional?null:[],errCode:'TEST_DB_ERROR'},{data:transactional?null:[],error:'TEST_DB_ERROR'},{data:[null]},{data:[{},{}]}]){
  const h=harness({read:()=>response},transactional);await assert.rejects(h.ledger.read(scope),invalid);assert.deepEqual(h.counts(),{updates:0,adds:0});
 }
});
test('quota initialization requires a confirmed matching id and never reserves on unknown insert',async()=>{
 for(const transactional of [false,true])for(const response of [undefined,{}, {id:'wrong'}, {id:ledgerId(scope),errCode:'TEST_DB_ERROR'}]){
  const h=harness({add:()=>response},transactional);await assert.rejects(h.ledger.reserve(scope,'request'),invalid);assert.equal(h.counts().updates,0);assert.deepEqual(h.row().entries,{});
 }
});
test('ambiguous quota writes stop immediately and replay cannot return a fresh reservation',async()=>{
 for(const response of [undefined,{}, {updated:'1'},{updated:1,errCode:'TEST_DB_ERROR'},{updated:0,affectedDocs:1},{updated:2}]){
  const h=harness({update:()=>response});await assert.rejects(h.ledger.reserve(scope,'request'),invalid);assert.equal(h.counts().updates,1);
  assert.deepEqual(await h.ledger.reserve(scope,'request'),{fresh:false,state:'reserved'});assert.equal(h.counts().updates,1);
 }
});
test('quota validates document identity, safe version and entry object before mutation',async()=>{
 for(const patch of [{_id:'wrong'},{version:-1},{version:Number.MAX_SAFE_INTEGER},{entries:2},{entries:{constructor:'reserved'}},{entries:{bad:'unexpected'}}]){
  const h=harness();await h.ledger.read(scope);Object.assign(h.row(),patch);await assert.rejects(h.ledger.reserve(scope,'new'),invalid);assert.equal(h.counts().updates,0);
 }
});
test('quota seeding rejects unusable history instead of silently allocating a clean allowance',async()=>{
 for(const history of [[null],[{}],[{jobId:'old',status:'SUCCEEDED',resultSaved:'true'}],[{status:'PENDING'}],[{jobId:'old',status:'new-unknown-state'}]]){
  const h=harness({history});await assert.rejects(h.ledger.reserve(scope,'new'),invalid);assert.equal(h.counts().adds,0);
 }
});
test('duplicate insert recovery validates the entire reread response',async()=>{
 let reads=0;const collection={doc:()=>({get:async()=>++reads===1?{data:[]}:{data:[],errCode:'TEST_DB_ERROR'}}),add:async()=>{throw Error('E11000 duplicate')}};
 const ledger=createQuotaLedger(collection,async()=>[]);await assert.rejects(ledger.read(scope),invalid);assert.equal(reads,2);
});
test('valid aliases and transaction receipts preserve reserve, consume and release idempotency',async()=>{
 for(const transactional of [false,true]){
  const h=harness({update:()=>({updated:1,affectedDocs:1})},transactional);assert.deepEqual(await h.ledger.reserve(scope,'request'),{fresh:true,state:'reserved'});
  await h.ledger.consume(scope,'request');await h.ledger.consume(scope,'request');await h.ledger.release(scope,'request');
  assert.deepEqual(await h.ledger.read(scope),{used:1,reserved:0});assert.equal(h.counts().updates,2);
 }
});
