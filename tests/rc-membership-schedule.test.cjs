const test=require('node:test'),assert=require('node:assert/strict');
const {createMembershipSchedule}=require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/membership-schedule');
function setup(legacy=null){const rows=new Map(),grants=new Map();let time=1000;
 const table={doc:k=>({get:async()=>({data:rows.has(k)?[structuredClone(rows.get(k))]:[]})}),add:async r=>{if(rows.has(r._id))throw Error('duplicate');rows.set(r._id,structuredClone(r))},
 where:q=>({update:async p=>{const r=rows.get(q._id);if(!r||r.userId!==q.userId||r.version!==q.version)return{updated:0};rows.set(q._id,{...r,...structuredClone(p)});return{updated:1}}})};
 const options={readGrant:async id=>grants.get(id),readLegacy:async()=>legacy,replaceObject:v=>v,now:()=>time};
 return{rows,grants,clock:v=>time=v,options,table,api:createMembershipSchedule(table,options),grant:id=>grants.set(id,{orderId:id,userId:'A',source:'official-payment',state:'pending_activation',plan:'plus',generationLimit:10,durationDays:30})};}
test('concurrent renewals produce separate consecutive pools; retry and restart do not reset periods',async()=>{
 const s=setup({status:'active',plan:'plus',endedAt:5000});s.grant('one');s.grant('two');
 const result=await Promise.all(['one','two','one','two'].map(id=>s.api.activate('A',id)));
 const periods=Object.values([...s.rows.values()][0].periods).sort((a,b)=>a.startsAt-b.startsAt);
 assert.equal(periods.length,2);assert.equal(periods[0].startsAt,5000);assert.equal(periods[0].endsAt,periods[1].startsAt);
 s.clock(6000);const restarted=createMembershipSchedule(s.table,s.options);
 assert.deepEqual(await restarted.activate('A','one'),result[0]);assert.equal((await restarted.current('A')).cycleKey,periods[0].cycleKey);
 s.clock(periods[1].startsAt);assert.equal((await restarted.current('A')).cycleKey,periods[1].cycleKey);
});
test('foreign grants, legacy lifetime and lookup failures cannot silently reset or create membership',async()=>{
 const s=setup({status:'active',plan:'pro'});s.grant('one');
 await assert.rejects(s.api.activate('B','one'),{code:'MEMBERSHIP_GRANT_INVALID'});
 await assert.rejects(s.api.activate('A','one'),{code:'LEGACY_LIFETIME_REVIEW_REQUIRED'});assert.equal(s.rows.size,0);
 const api=createMembershipSchedule(s.table,{...s.options,readLegacy:async()=>{throw Error('DB unavailable')}});
 await assert.rejects(api.activate('A','one'),/DB unavailable/);assert.equal(s.rows.size,0);
});
