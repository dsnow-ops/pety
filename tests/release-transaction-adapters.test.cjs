const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const before=process.env.PETY_TRANSACTION_BEFORE;
const quota=require(path.resolve(before?before+'/avatar-quota-ledger.js':'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-quota-ledger.js'));
const membership=require(path.resolve(before?before+'/effective-membership.js':'uniCloud-alipay/cloudfunctions/common/pety-membership-orders/effective-membership.js'));
test('transaction quota uses singleton reads and doc writes, retains ownership and consumed history',async()=>{
 let row=null;const collection={doc:()=>({get:async()=>({data:structuredClone(row)}),update:async patch=>{Object.assign(row,patch);return{updated:1};}}),add:async value=>{row=structuredClone(value);return{id:row._id};},where(){throw Error('unsupported transaction where write');}};
 const scope={owner:'isolated-A',pet:'cat',pool:'free',cycle:'free-lifetime'};
 const ledger=quota.createQuotaLedger(collection,async()=>[],v=>v,{transactional:true});
 await ledger.reserve(scope,'r');await ledger.consume(scope,'r');await ledger.release(scope,'r');
 assert.deepEqual(await ledger.read(scope),{used:1,reserved:0});
 row.owner='isolated-B';await assert.rejects(ledger.reserve(scope,'forged'),{code:'AVATAR_QUOTA_STATE_INVALID'});
});
test('transaction membership singleton verifies owner and source; invalid response never means free',async()=>{
 const cycle='a'.repeat(24);let row={userId:'A',periods:{[cycle]:{orderId:'test',cycleKey:cycle,plan:'plus',limit:10,startsAt:1000,endsAt:9000,state:'scheduled'}}};
 const db={collection:()=>({doc:()=>({get:async()=>({data:row})})})};
 assert.equal((await membership.readEffectiveMembership(db,'A',null,5000,{transactional:true})).plan,'plus');
 await assert.rejects(membership.readEffectiveMembership(db,'B',null,5000,{transactional:true}),{code:'MEMBERSHIP_STATE_INVALID'});
 row=[];await assert.rejects(membership.readEffectiveMembership(db,'A',null,5000,{transactional:true}),{code:'MEMBERSHIP_STATE_INVALID'});
});
