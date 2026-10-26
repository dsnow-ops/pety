const test = require('node:test'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readPaymentStatus } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-status');
const hash = v => createHash('sha256').update(v).digest('hex');
function setup() {
  const order = { _id: 'order', userId: 'A', plan: 'plus', durationDays:30, generationLimit:10, amountFen: 100, currency: 'CNY', paymentAttempt: { outTradeNo: 'attempt', provider: 'wxpay' } };
  const receipt = { orderId: 'order', userId: 'A', amountFen: 100, currency: 'CNY', outTradeNo: 'attempt', provider: 'wxpay', state: 'recorded', transactionId: 'tx', plan:'plus', durationDays:30, generationLimit:10, paidAt:900 };
  const cycleKey = hash('order').slice(0, 24);
  const period = { orderId: 'order', cycleKey, plan: 'plus', limit: 10, startsAt: 1000, endsAt: 3000, state: 'scheduled' };
  const schedule = { userId: 'A', periods: { [cycleKey]: period }, revocations: {} };
  const rows = new Map([['pety_payment_inbox/order', receipt], ['pety_membership_schedules/paid_' + hash('A'), schedule]]);
  const db = { collection: name => ({ doc: id => ({ get: async () => ({ data: rows.has(name + '/' + id) ? [rows.get(name + '/' + id)] : [] }) }) }) };
  return { order, receipt, cycleKey, period, schedule, rows, db, read: time => readPaymentStatus(db, order, time) };
}

test('status derives paid and pending/active/scheduled/expired/revoked from durable facts and server time', async () => {
  const s = setup();
  assert.equal((await s.read(500)).entitlementStatus, 'scheduled');
  assert.equal((await s.read(1000)).entitlementStatus, 'active');
  assert.equal((await s.read(3000)).entitlementStatus, 'expired');
  s.period.state = 'revoked';
  assert.equal((await s.read(1500)).entitlementStatus, 'revoked');
  delete s.schedule.periods[s.cycleKey];
  assert.deepEqual(await s.read(1500), { paymentStatus: 'paid', entitlementStatus: 'pending_activation' });
  s.schedule.revocations[s.cycleKey] = { orderId: 'order',receiptId:'TEST-refund',outcome:'full_refund' };
  assert.equal((await s.read(1500)).entitlementStatus, 'revoked');
});

test('no receipt is pending confirmation, not failed or paid; read errors never become free/unpaid', async () => {
  const s = setup(); s.rows.delete('pety_payment_inbox/order');
  s.order.paymentStatus = 'paid'; // This stale order flag is not accepted as evidence.
  assert.deepEqual(await s.read(1500), { paymentStatus: 'pending_confirmation', entitlementStatus: 'not_granted' });
  delete s.order.paymentAttempt;
  assert.equal((await s.read(1500)).paymentStatus, 'not_started');
  await assert.rejects(readPaymentStatus({ collection: () => ({ doc: () => ({ get: async () => { throw Error('network'); } }) }) }, s.order), {code:'PAYMENT_STATUS_UNAVAILABLE'});
});

test('foreign, mismatched and corrupt receipts or membership periods fail closed', async () => {
  for (const mutate of [s => s.receipt.userId = 'B', s => s.receipt.amountFen = 1,
    s => s.receipt.outTradeNo = 'other', s => s.receipt.state = 'unknown',
    s => s.schedule.userId = 'B', s => s.period.orderId = 'other', s => s.period.endsAt = 0]) {
    const s = setup(); mutate(s);
    await assert.rejects(s.read(1500), { code: 'PAYMENT_STATUS_UNAVAILABLE' });
  }
});
