'use strict';
const {createHash}=require('crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalid=()=>{throw Object.assign(new Error('MEMBERSHIP_STATE_INVALID'),{code:'MEMBERSHIP_STATE_INVALID'});};

// Shared by authorization and order-status display. Neither path may choose an
// arbitrary active pool or disregard contradictory refund evidence.
function validatePaidSchedule(schedule,uid,now){
 if(!object(schedule)||schedule.userId!==uid||schedule._id!==undefined&&schedule._id!=='paid_'+hash(uid)||!object(schedule.periods)||!Number.isSafeInteger(now)||now<0)invalid();
 for(const field of ['version','legacyUntil','updatedAt'])if(schedule[field]!==undefined&&(!Number.isSafeInteger(schedule[field])||schedule[field]<0))invalid();
 const revocations=schedule.revocations===undefined?{}:schedule.revocations;
 if(!object(revocations))invalid();
 let active=0;
 for(const [cycle,period] of Object.entries(schedule.periods)){
  if(!object(period)||period.cycleKey!==cycle||!/^[a-f0-9]{24}$/.test(cycle)||typeof period.orderId!=='string'||!period.orderId||!['plus','pro'].includes(period.plan)||period.limit!==10||
    !Number.isSafeInteger(period.startsAt)||period.startsAt<0||!Number.isSafeInteger(period.endsAt)||period.endsAt<=period.startsAt||!['scheduled','revoked'].includes(period.state))invalid();
  if(period.state==='scheduled'&&period.startsAt<=now&&period.endsAt>now)active++;
 }
 if(active>1)invalid();
 for(const [cycle,receipt] of Object.entries(revocations)){
  if(!/^[a-f0-9]{24}$/.test(cycle)||!object(receipt)||typeof receipt.orderId!=='string'||!receipt.orderId||hash(receipt.orderId).slice(0,24)!==cycle||
    typeof receipt.receiptId!=='string'||!receipt.receiptId||!['full_refund','chargeback'].includes(receipt.outcome))invalid();
  const period=schedule.periods[cycle];
  if(period&&(period.orderId!==receipt.orderId||period.state!=='revoked'))invalid();
 }
 return Object.values(schedule.periods);
}
module.exports={validatePaidSchedule};
