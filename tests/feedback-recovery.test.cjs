'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./fixtures/feedback-runtime.cjs');
test('lost database acknowledgement resolves through matching persisted receipt without a second write',async()=>{
  const h=harness({ackLost:true});const first=await h.call();assert.equal(first.code,0);assert.equal(first.replayed,true);assert.equal(h.calls.add,1);
  const rateBefore=h.calls.rate;const again=await h.call();assert.equal(again.code,0);assert.equal(again.submittedAt,first.submittedAt);assert.equal(h.calls.add,1);assert.equal(h.calls.rate,rateBefore);assert.equal(h.tables.get('product_feedback').size,1);
});
test('ordinary same-content retry recovers receipt, distinct content still consumes existing limits',async()=>{
  const h=harness();const first=await h.call();assert.equal(first.code,0);const same=await h.call();assert.equal(same.code,0);assert.equal(same.replayed,true);
  for(let i=1;i<5;i++)assert.equal((await h.call({content:'TEST 第'+i+'条独立合成留言，无真实资料。'})).code,0);
  assert.equal((await h.call({content:'TEST 第六条独立合成留言，无真实资料。'})).code,429);assert.equal(h.tables.get('product_feedback').size,5);
});
test('malformed reads and update acknowledgements cannot become an empty table or a new accepted send',async()=>{
  for(const readResult of [{},{data:null},{data:[null]},{data:[[]]},{data:[{},{}]},{errCode:'db-unavailable',data:[]}]){
    const h=harness({readResult});assert.equal((await h.call()).code,503);assert.equal(h.calls.add,0);assert.equal(h.calls.rate,0);
  }
  for(const updateResult of [{},{updated:'1'},{updated:NaN},{updated:-1},{errCode:'db-unavailable',updated:1}]){
    const h=harness({updateResult});assert.equal((await h.call()).code,503);assert.equal(h.calls.add,0);assert.equal(h.calls.rate,0);
  }
});
test('unknown write and misleading _id errors never assert receipt or expose internal text',async()=>{
  for(const message of ['invalid _id database constraint','E11000 duplicate key','transport secret hostname']){
    const h=harness({addBeforeError:message});const result=await h.call();assert.equal(result.code,503);assert.equal(result.errorCode,'FEEDBACK_SUBMIT_UNCONFIRMED');assert.doesNotMatch(JSON.stringify(result),/hostname|constraint|E11000/);assert.equal(h.calls.add,1);
  }
});
test('persisted fingerprint mismatch cannot confirm or overwrite a receipt',async()=>{
  const h=harness();await h.call();const row=[...h.tables.get('product_feedback').values()][0];row.requestFingerprint='mismatched';const before=JSON.stringify(row);assert.equal((await h.call()).code,503);assert.equal(JSON.stringify(row),before);assert.equal(h.calls.add,1);
});
test('temporary authentication outage stays unavailable while known expiry remains rejected',async()=>{
  for(const authError of [Error('private hostname'),{errCode:'uni-id-upstream-private'},{errCode:'pety-session-service-unavailable'}]){
    const h=harness({authError});const result=await h.call();assert.equal(result.code,503);assert.equal(h.calls.add,0);assert.doesNotMatch(JSON.stringify(result),/private/);
  }
  assert.equal((await harness({authError:{errCode:'uni-id-token-expired'}}).call()).code,403);
});
test('concurrent same-content calls converge to one persisted receipt',async()=>{
  const h=harness();const results=await Promise.all([h.call(),h.call()]);assert.ok(results.every(r=>r.code===0));assert.equal(results[0].submittedAt,results[1].submittedAt);assert.equal(h.tables.get('product_feedback').size,1);
});
test('confirmed receipt recovery does not require an expired image upload ticket again',async()=>{
  const h=harness(),imageFileIds=['cloud://test/product-feedback/isolated.png'];assert.equal((await h.call({imageFileIds})).code,0);h.options.mediaError=true;
  assert.equal((await h.call({imageFileIds})).code,0);assert.notEqual((await h.call({imageFileIds,content:'TEST 不同的留言不能绕过图片归属验证。'})).code,0);assert.equal(h.tables.get('product_feedback').size,1);
});
