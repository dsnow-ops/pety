'use strict';
const {createHash}=require('crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};

// A server-only schedule preserves one independent cycle per paid order. The
// existing quota ledger remains responsible for reserved/consumed generation.
function createMembershipSchedule(accounts, { readGrant, readLegacy, readRefund, replaceObject, now=Date.now }) {
  if(typeof readGrant!=='function'||typeof readLegacy!=='function'||typeof replaceObject!=='function') fail('MEMBERSHIP_DEPENDENCY_REQUIRED');
  async function account(uid) {
    if(typeof uid!=='string'||!uid) fail('MEMBERSHIP_OWNER_REQUIRED');
    const key='paid_'+hash(uid);
    const response=await accounts.doc(key).get();
    if(!Array.isArray(response?.data)) fail('MEMBERSHIP_SERVICE_UNAVAILABLE');
    const existing=response.data[0];
    if(existing) {
      if(existing.userId!==uid||!Number.isSafeInteger(existing.version)||!existing.periods||typeof existing.periods!=='object'||Array.isArray(existing.periods)) fail('MEMBERSHIP_STATE_INVALID');
      if(!Number.isSafeInteger(existing.legacyUntil)||existing.legacyUntil<0||Object.values(existing.periods).some(p=>
        !p||!Number.isSafeInteger(p.startsAt)||!Number.isSafeInteger(p.endsAt)||p.endsAt<=p.startsAt||
        !['scheduled','revoked'].includes(p.state)||p.limit!==10)) fail('MEMBERSHIP_STATE_INVALID');
      return existing;
    }
    // Snapshot the legacy horizon once. No resetting existing pools or assuming
    // a failed lookup means free. Lifetime memberships require explicit review.
    const legacy=await readLegacy(uid);
    let legacyUntil=0;
    if(legacy?.status==='active'&&['plus','pro'].includes(legacy.plan)) {
      const ends=[legacy.endedAt,legacy.expiresAt].filter(v=>Number.isSafeInteger(v)&&v>0);
      if(!ends.length) fail('LEGACY_LIFETIME_REVIEW_REQUIRED');
      legacyUntil=Math.min(...ends);
    }
    const created={_id:key,userId:uid,version:0,periods:{},revocations:{},legacyUntil,updatedAt:now()};
    try {await accounts.add(created);return created;}
    catch(error){const retry=await accounts.doc(key).get();if(retry?.data?.[0]?.userId===uid)return retry.data[0];throw error;}
  }
  async function activate(uid,orderId) {
    const grant=await readGrant(orderId);
    if(!grant||grant.userId!==uid||grant.orderId!==orderId||grant.source!=='official-payment'||
      grant.state!=='pending_activation'||!['plus','pro'].includes(grant.plan)||grant.generationLimit!==10||
      !Number.isSafeInteger(grant.durationDays)||grant.durationDays<1||grant.durationDays>366) fail('MEMBERSHIP_GRANT_INVALID');
    const cycleKey=hash(orderId).slice(0,24);
    for(let attempt=0;attempt<16;attempt++) {
      const current=await account(uid),prior=current.periods[cycleKey];
      if(current.revocations?.[cycleKey])fail('MEMBERSHIP_ORDER_REVOKED');
      if(prior){if(prior.orderId!==orderId)fail('MEMBERSHIP_GRANT_CONFLICT');return prior;}
      if(Object.keys(current.periods).length>=1000)fail('MEMBERSHIP_HISTORY_REVIEW_REQUIRED');
      const stamp=now();
      if(!Number.isSafeInteger(stamp)||stamp<=0)fail('MEMBERSHIP_CLOCK_INVALID');
      // Retain revoked intervals too: a later refund cannot silently move other
      // orders or revive their already expired/consumed pools.
      const startsAt=Math.max(stamp,current.legacyUntil,...Object.values(current.periods).map(p=>p.endsAt));
      const period={orderId,cycleKey,plan:grant.plan,limit:10,startsAt,endsAt:startsAt+grant.durationDays*86400000,state:'scheduled'};
      const result=await accounts.where({_id:current._id,userId:uid,version:current.version}).update({
        periods:replaceObject({...current.periods,[cycleKey]:period}),version:current.version+1,updatedAt:stamp});
      if(result?.updated===1)return period;
    }
    fail('MEMBERSHIP_BUSY');
  }
  async function current(uid) {
    const state=await account(uid),stamp=now();
    return Object.values(state.periods).find(p=>p.state==='scheduled'&&p.startsAt<=stamp&&p.endsAt>stamp)||null;
  }
  async function revoke(uid,orderId) {
    // readRefund must read a server-only, verified refund/chargeback receipt;
    // neither a frontend refund claim nor a payment cancellation is sufficient.
    if(typeof readRefund!=='function')fail('REFUND_VERIFICATION_UNAVAILABLE');
    const receipt=await readRefund(orderId);
    if(!receipt||receipt.userId!==uid||receipt.orderId!==orderId||receipt.source!=='official-payment'||
      !['full_refund','chargeback'].includes(receipt.outcome)||typeof receipt.receiptId!=='string'||!receipt.receiptId)fail('REFUND_RECEIPT_INVALID');
    const cycleKey=hash(orderId).slice(0,24);
    for(let attempt=0;attempt<16;attempt++) {
      const state=await account(uid),prior=state.revocations?.[cycleKey];
      if(prior)return {orderId,revoked:true};
      const periods={...state.periods};
      if(periods[cycleKey])periods[cycleKey]={...periods[cycleKey],state:'revoked'};
      const result=await accounts.where({_id:state._id,userId:uid,version:state.version}).update({
        periods:replaceObject(periods),revocations:replaceObject({...state.revocations,[cycleKey]:{orderId,receiptId:receipt.receiptId,outcome:receipt.outcome}}),
        version:state.version+1,updatedAt:now()});
      if(result?.updated===1)return {orderId,revoked:true};
    }
    fail('MEMBERSHIP_BUSY');
  }
  return {activate,current,revoke};
}
module.exports={createMembershipSchedule};
