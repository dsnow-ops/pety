const test = require('node:test'), assert = require('node:assert/strict');
const { createUniPayAdapter } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/uni-pay-adapter');

function setup() {
  const rows = Array.from({ length: 5 }, (_, i) => ({ _id: 'id' + i, type: 'pety_membership', status: 1,
    out_trade_no: 'pp' + String(i).repeat(26), order_no: 'order' + i, transaction_id: 'tx' + i, original_data: { index: i } }));
  const activated = [], seen = [];
  const match = (r, q) => Object.entries(q).every(([k, v]) => v && typeof v === 'object' ?
    ('neq' in v ? r[k] !== v.neq : r[k] > v.gt) : r[k] === v);
  const payOrders = { where(q) { let limit = Infinity; return {
    orderBy(key, direction) { assert.equal(key, '_id'); assert.equal(direction, 'asc'); return this; },
    limit(n) { limit = n; return this; },
    async get() { return { data: rows.filter(r => match(r, q)).sort((a,b) => a._id.localeCompare(b._id)).slice(0, limit).map(r => ({ ...r })) }; },
    async update(patch) { let updated = 0; for (const r of rows) if (match(r,q)) { Object.assign(r,patch); updated++; } return { updated }; }
  }; } };
  const adapter = createUniPayAdapter({ payOrders,
    dbCmd: { neq: v => ({ neq: v }), gt: v => ({ gt: v }) },
    businessOrders: { doc: id => ({ get: async () => ({ data: [{ _id: id, paymentAttempt: { channelId: 'fixture', provider: 'wxpay', payType: 'app' } }] }) }) },
    getVerifier: async () => ({ verifyPaymentNotify: async original => {
      seen.push(original.index);
      if (original.index < 2) return false;
      return { mchId: 'merchant', feeType: 'CNY' };
    } }),
    inbox: { accept: async () => {}, activate: async id => { activated.push(id); } }
  });
  return { adapter, rows, activated, seen };
}

test('invalid first page does not starve later paid orders; cursor advances across failures', async () => {
  const s = setup();
  const first = await s.adapter.reconcilePage({ limit: 2 });
  assert.equal(first.nextCursor, 'id1');
  assert.ok(first.results.every(r => !r.recovered));
  const second = await s.adapter.reconcilePage({ limit: 2, afterId: first.nextCursor });
  assert.equal(second.nextCursor, 'id3');
  const third = await s.adapter.reconcilePage({ limit: 2, afterId: second.nextCursor });
  assert.equal(third.nextCursor, null);
  assert.deepEqual(s.activated, ['order2', 'order3', 'order4']);
  assert.deepEqual(s.seen, [0,1,2,3,4]);
  assert.equal(s.rows[0].user_order_success, undefined);
  assert.equal(s.rows[4].user_order_success, true);
  const nextSweep = await s.adapter.reconcilePage({ limit: 2 });
  assert.ok(nextSweep.results.every(r => !r.recovered));
});

test('bounded page validates cursor and does not claim a final page when full', async () => {
  const s = setup();
  for (const afterId of [4, {}, ' ', 'x'.repeat(129)]) await assert.rejects(s.adapter.reconcilePage({ afterId }), { code: 'PAYMENT_CURSOR_INVALID' });
  const empty = await s.adapter.reconcilePage({ afterId: 'zz' });
  assert.deepEqual(empty, { results: [], nextCursor: null });
  for (const limit of [0, 21]) await assert.rejects(s.adapter.reconcilePage({ limit }), { code: 'PAYMENT_BATCH_INVALID' });
});
