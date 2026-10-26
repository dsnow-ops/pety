const test = require('node:test'), assert = require('node:assert/strict');
const { createMembershipOrders } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders');
function setup(enabled = true) {
  const rows = new Map(); let lostAck = false;
  const collection = { doc: key => ({ get: async () => ({ data: rows.has(key) ? [structuredClone(rows.get(key))] : [] }) }),
    where: query => ({ update: async patch => {
      const row = rows.get(query._id);
      if (!row || !Object.entries(query).every(([k,v]) => row[k] === v)) return { updated: 0 };
      rows.set(query._id, { ...row, ...structuredClone(patch) }); return { updated: 1 };
    } }),
    add: async row => { if (rows.has(row._id)) throw Error('duplicate'); rows.set(row._id, structuredClone(row)); if (lostAck) throw Error('response lost'); return {id:row._id}; } };
  const catalog = { fixture: { approved: true, plan: 'plus', currency: 'CNY', amountFen: 1234, durationDays: 30, generationLimit: 10 } };
  const channels = { fixture: { approved: true, provider: 'alipay', payType: 'app', currency: 'CNY', appId: 'fixture-app', merchantId: 'fixture-merchant' } };
  return { rows, catalog, channels, loseAck: () => lostAck = true, api: createMembershipOrders(collection, { enabled, catalog, channels, now: () => 100000 }) };
}
const request = { skuId: 'fixture', requestId: 'intent_12345678' };
test('orders are closed by default; client pricing/status and unapproved SKUs cannot create orders', async () => {
  const closed = createMembershipOrders({});
  await assert.rejects(closed.create('A', request), { code: 'PAYMENT_NOT_CONFIGURED' });
  const s = setup();
  for (const injected of [{ amountFen: 1 }, { paid: true }, { userId: 'B' }, { durationDays: 999 }]) {
    await assert.rejects(s.api.create('A', { ...request, ...injected }), { code: 'ORDER_INPUT_INVALID' });
  }
  s.catalog.fixture.approved = false;
  await assert.rejects(s.api.create('A', request), { code: 'SKU_NOT_AVAILABLE' });
  assert.equal(s.rows.size, 0);
});
test('concurrent retries and lost acknowledgements create one immutable server-priced order', async () => {
  const s = setup(); s.loseAck();
  const results = await Promise.all(Array.from({ length: 12 }, () => s.api.create('A', request)));
  assert.equal(s.rows.size, 1);
  assert.equal(new Set(results.map(r => r._id)).size, 1);
  assert.equal(results[0].amountFen, 1234);
  assert.equal(results[0].entitlementStatus, 'not_granted');
  s.catalog.fixture.amountFen = 9999;
  assert.equal((await s.api.create('A', request)).amountFen, 1234);
  await assert.rejects(s.api.create('A', { ...request, skuId: 'other' }), { code: 'ORDER_REQUEST_CONFLICT' });
});
test('same request in another account stays separate and foreign order reads are rejected', async () => {
  const s = setup(), a = await s.api.create('A', request), b = await s.api.create('B', request);
  assert.notEqual(a._id, b._id);
  await assert.rejects(s.api.read('B', a._id), { code: 'ORDER_NOT_FOUND' });
  assert.equal((await s.api.read('A', a._id)).userId, 'A');
});

test('payment preparation fixes one server-owned attempt before dispatch and survives catalog rotation', async () => {
  const s = setup(), order = await s.api.create('A', request);
  const prepared = await Promise.all(Array.from({length: 8}, () => s.api.preparePayment('A', order._id, 'fixture')));
  assert.equal(new Set(prepared.map(p => p.paymentAttempt.outTradeNo)).size, 1);
  assert.equal(prepared[0].paymentAttempt.merchantId, 'fixture-merchant');
  s.channels.fixture.merchantId = 'rotated-merchant';
  assert.equal((await s.api.preparePayment('A', order._id, 'fixture')).paymentAttempt.merchantId, 'fixture-merchant');
  await assert.rejects(s.api.preparePayment('B', order._id, 'fixture'), {code:'ORDER_NOT_FOUND'});
  s.channels.other = {...s.channels.fixture};
  await assert.rejects(s.api.preparePayment('A', order._id, 'other'), {code:'PAYMENT_ATTEMPT_CONFLICT'});
  s.rows.get(order._id).status = 'paid';
  await assert.rejects(s.api.preparePayment('A', order._id, 'fixture'), {code:'ORDER_NOT_PAYABLE'});
});
