'use strict';
const {createHash}=require('crypto');
const {confirmedResponse,validateMembership}=require('./membership-state');
const {validatePaidSchedule}=require('./schedule-integrity');
const fail=()=>{throw Object.assign(new Error('MEMBERSHIP_STATE_INVALID'),{code:'MEMBERSHIP_STATE_INVALID'});};
function active(record,now){return record&&['plus','pro'].includes(record.plan)&&record.status==='active'&&(!record.endedAt||record.endedAt>now)&&(!record.expiresAt||record.expiresAt>now);}
async function readEffectiveMembership(db,uid,legacy,now=Date.now(),{transactional=false}={}) {
  if(typeof uid!=='string'||!uid||!Number.isSafeInteger(now)||now<0)fail();
  validateMembership(legacy,uid);
  const key='paid_'+createHash('sha256').update(uid).digest('hex');
  const response=await db.collection('pety_membership_schedules').doc(key).get();
  confirmedResponse(response);
  if(!response || (transactional
    ? !Object.prototype.hasOwnProperty.call(response,'data') || (response.data!==null && (typeof response.data!=='object'||Array.isArray(response.data)))
    : !Array.isArray(response.data) || response.data.length>1 || response.data.some(row=>!row||typeof row!=='object'||Array.isArray(row))))fail();
  const schedule=transactional?response.data:response.data[0];
  if(!schedule)return legacy;
  const paid=[];
  for(const p of validatePaidSchedule(schedule,uid,now)) {
    if(p.state==='scheduled'&&p.startsAt<=now&&p.endsAt>now)paid.push(p);
  }
  if(paid.length>1)fail();
  // A later manual extension may overlap a prepaid period. Do not silently
  // discard either pool or pick an arbitrary source; require reconciliation.
  if(paid.length&&active(legacy,now))fail();
  if(!paid.length)return legacy;
  const p=paid[0];
  return {userId:uid,plan:p.plan,status:'active',startedAt:p.startsAt,endedAt:p.endsAt,
    source:'official-payment',orderId:p.orderId,entitlementCycleKey:p.cycleKey};
}
module.exports={readEffectiveMembership};
