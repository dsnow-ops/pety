'use strict';
const { validatePaidEvidence } = require('./payment-evidence');
const failure = code => Object.assign(new Error(code), { code });
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);
async function insertOnce(collection, record, keys) {
  try { await collection.add(record); return record; }
  catch (error) {
    const response = await collection.doc(record._id).get();
    const existing = response?.data?.[0];
    if (!existing) throw error;
    if (!same(existing, record, keys)) throw failure('PAYMENT_RECEIPT_CONFLICT');
    return existing;
  }
}

// Private server workflow. Persist before acknowledging the official notify
// hook. Recovery is an explicit awaited call; there is no detached background job.
function createPaymentInbox(inbox, grants, { now = Date.now, schedule } = {}) {
  async function accept(order, paymentRecord, verified, facts) {
    const evidence = validatePaidEvidence(order, paymentRecord, verified, facts);
    if (!['plus', 'pro'].includes(order.plan) || order.generationLimit !== 10 ||
        !Number.isSafeInteger(order.durationDays) || order.durationDays <= 0 || order.durationDays > 366) {
      throw failure('PAYMENT_ORDER_INVALID');
    }
    const record = { _id: order._id, ...evidence, plan: order.plan,
      durationDays: order.durationDays, generationLimit: 10, state: 'pending', createdAt: now() };
    return insertOnce(inbox, record, ['orderId', 'userId', 'outTradeNo', 'transactionId', 'provider', 'amountFen', 'currency', 'paidAt', 'plan', 'durationDays', 'generationLimit']);
  }
  async function apply(orderId) {
    const response = await inbox.doc(orderId).get();
    const receipt = response?.data?.[0];
    if (!receipt || !['pending', 'recorded'].includes(receipt.state)) throw failure('PAYMENT_RECEIPT_NOT_READY');
    // Grant receipt is not yet the account's active membership projection.
    // One order produces one pool source, so retry cannot increase its 10 uses.
    const grant = { _id: receipt.orderId, orderId: receipt.orderId, userId: receipt.userId,
      transactionId: receipt.transactionId, provider: receipt.provider, plan: receipt.plan,
      durationDays: receipt.durationDays, generationLimit: receipt.generationLimit,
      paidAt: receipt.paidAt, source: 'official-payment', state: 'pending_activation' };
    await insertOnce(grants, grant, Object.keys(grant).filter(key => key !== 'state'));
    const changed = await inbox.where({ _id: orderId, state: 'pending' }).update({ state: 'recorded', updatedAt: now() });
    if (changed?.updated !== 1) {
      const current = await inbox.doc(orderId).get();
      if (current?.data?.[0]?.state !== 'recorded') throw failure('PAYMENT_RECEIPT_STATE_CHANGED');
    }
    return { orderId, receiptRecorded: true, membershipActivated: false };
  }
  async function activate(orderId) {
    if (!schedule || typeof schedule.activate !== 'function') throw failure('MEMBERSHIP_ACTIVATION_UNAVAILABLE');
    await apply(orderId);
    const response = await inbox.doc(orderId).get();
    const receipt = response?.data?.[0];
    if (!receipt || receipt.state !== 'recorded') throw failure('PAYMENT_RECEIPT_NOT_READY');
    const period = await schedule.activate(receipt.userId, orderId);
    return { orderId, receiptRecorded: true, cycleKey: period.cycleKey,
      startsAt: period.startsAt, endsAt: period.endsAt,
      membershipActivated: period.state === 'scheduled' && period.startsAt <= now() && period.endsAt > now() };
  }
  return { accept, apply, activate };
}
module.exports = { createPaymentInbox };
