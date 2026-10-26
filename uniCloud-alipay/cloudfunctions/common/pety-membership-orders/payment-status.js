'use strict';
const { createHash } = require('crypto');
const {validatePaidSchedule}=require('./schedule-integrity');
const hash = value => createHash('sha256').update(value).digest('hex');
const invalid = () => { throw Object.assign(new Error('PAYMENT_STATUS_UNAVAILABLE'), { code: 'PAYMENT_STATUS_UNAVAILABLE' }); };
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
async function readOne(db,collection,id){
  let response;try{response=await db.collection(collection).doc(id).get();}catch(_){invalid();}
  if(!object(response)||response.ok===false||response.success===false||['code','errCode'].some(k=>![undefined,null,'',0,'0'].includes(response[k]))||!Array.isArray(response.data)||response.data.length>1)invalid();
  if(!response.data.length)return null;
  const row=response.data[0];if(!object(row)||row._id!==undefined&&row._id!==id)invalid();return row;
}

// Read only the private verified receipt and account projection. A client's
// payment success callback or uni-pay's transport acknowledgement is not proof.
async function readPaymentStatus(db, order, now = Date.now()) {
  if(!object(order)||typeof order._id!=='string'||!order._id||typeof order.userId!=='string'||!order.userId||!['plus','pro'].includes(order.plan)||order.currency!=='CNY'||
    !Number.isSafeInteger(order.amountFen)||order.amountFen<=0||order.amountFen>2147483647||!Number.isSafeInteger(order.durationDays)||order.durationDays<1||order.durationDays>366||order.generationLimit!==10||!Number.isSafeInteger(now)||now<0)invalid();
  if(order.paymentAttempt!==undefined&&(!object(order.paymentAttempt)||typeof order.paymentAttempt.outTradeNo!=='string'||!order.paymentAttempt.outTradeNo||!['alipay','wxpay'].includes(order.paymentAttempt.provider)))invalid();
  const receipt = await readOne(db,'pety_payment_inbox',order._id);
  if (!receipt) return { paymentStatus: order.paymentAttempt ? 'pending_confirmation' : 'not_started', entitlementStatus: 'not_granted' };
  if(!order.paymentAttempt)invalid();
  if (receipt.orderId !== order._id || receipt.userId !== order.userId ||
      receipt.outTradeNo !== order.paymentAttempt?.outTradeNo || receipt.amountFen !== order.amountFen ||
      receipt.currency !== order.currency || receipt.provider !== order.paymentAttempt?.provider ||
      !['pending', 'recorded'].includes(receipt.state) || typeof receipt.transactionId!=='string'||!receipt.transactionId||receipt.plan!==order.plan||receipt.durationDays!==order.durationDays||receipt.generationLimit!==10||!Number.isSafeInteger(receipt.paidAt)||receipt.paidAt<=0) invalid();
  const schedule = await readOne(db,'pety_membership_schedules','paid_'+hash(order.userId));
  if (!schedule) return { paymentStatus: 'paid', entitlementStatus: 'pending_activation' };
  try{validatePaidSchedule(schedule,order.userId,now);}catch(_){invalid();}
  const cycleKey = hash(order._id).slice(0, 24);
  const period = schedule.periods[cycleKey];
  if (period===undefined) return { paymentStatus: 'paid', entitlementStatus: schedule.revocations?.[cycleKey]?'revoked':'pending_activation' };
  if (period.orderId !== order._id || period.cycleKey !== cycleKey || period.plan !== order.plan || period.limit !== 10 ||
      !Number.isSafeInteger(period.startsAt) || !Number.isSafeInteger(period.endsAt) || period.endsAt <= period.startsAt ||
      !['scheduled', 'revoked'].includes(period.state)) invalid();
  if (schedule.revocations?.[cycleKey]) return { paymentStatus: 'paid', entitlementStatus: 'revoked' };
  const entitlementStatus = period.state === 'revoked' ? 'revoked' :
    now < period.startsAt ? 'scheduled' : now >= period.endsAt ? 'expired' : 'active';
  return { paymentStatus: 'paid', entitlementStatus, startsAt: period.startsAt, endsAt: period.endsAt };
}
module.exports = { readPaymentStatus };
