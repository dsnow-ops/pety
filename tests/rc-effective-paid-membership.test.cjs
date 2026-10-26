const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const helper=require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/effective-membership');
const cycle='a'.repeat(24);
function record(now){return{userId:'A',periods:{[cycle]:{orderId:'order',cycleKey:cycle,plan:'plus',limit:10,startsAt:now-1000,endsAt:now+1000,state:'scheduled'}}};}
function dbFor(row){return{collection:name=>({doc:()=>({get:async()=>({data:name==='pety_membership_schedules'?[row]:[{nickname:'A'}]})}),where:()=>({limit:()=>({get:async()=>({data:[]})})})})};}
test('paid membership exposes its stable order cycle; expired and revoked pools never authorize',async()=>{
 const row=record(5000),db=dbFor(row);
 const active=await helper.readEffectiveMembership(db,'A',null,5000);
 assert.equal(active.entitlementCycleKey,cycle);assert.equal(active.endedAt,6000);
 assert.equal(await helper.readEffectiveMembership(db,'A',null,6000),null);
 row.periods[cycle].state='revoked';assert.equal(await helper.readEffectiveMembership(db,'A',null,5000),null);
 row.periods[cycle].state='scheduled';
 await assert.rejects(helper.readEffectiveMembership(db,'B',null,5000),{code:'MEMBERSHIP_STATE_INVALID'});
 await assert.rejects(helper.readEffectiveMembership(db,'A',{plan:'pro',status:'active',endedAt:8000},5000),{code:'MEMBERSHIP_STATE_INVALID'});
});
test('real profile and membership endpoints read paid periods only when server gate is enabled',async()=>{
 for(const name of ['membership_get','user_get_profile'])for(const enabled of [false,true]) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(`uniCloud-alipay/cloudfunctions/${name}/index.js`,'utf8'),{
   module,exports:module.exports,process:{env:{PETY_PAID_MEMBERSHIP_ENABLED:enabled?'true':'false'}},console:{error(){}},
   uniCloud:{database:()=>dbFor(record(Date.now()))},require:name=>name==='pety-auth'?{verifyRequest:async()=>({uid:'A'}),authErrorResult:e=>e}:name==='pety-membership-orders/effective-membership'?helper:require('../uniCloud-alipay/cloudfunctions/common/'+name)
  });
  const result=await module.exports.main({},{});assert.equal(result.plan,enabled?'plus':'free',name);
 }
});
