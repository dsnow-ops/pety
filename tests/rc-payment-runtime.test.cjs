const test = require('node:test'), assert = require('node:assert/strict');
const { createPaymentRuntime } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-runtime');
const { readEffectiveMembership } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/effective-membership');
const { readPaymentStatus } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-status');

function setup() {
  const tables = new Map(); let outage = '';
  const match = (r, q) => Object.entries(q).every(([k, v]) => v && typeof v === 'object' && 'neq' in v ? r[k] !== v.neq : r[k] === v);
  const db = { command: { set: value => value, neq: value => ({ neq: value }) }, collection(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    const rows = tables.get(name);
    return {
      async add(row) { if (rows.has(row._id)) throw Error('duplicate'); rows.set(row._id, structuredClone(row)); },
      doc(id) { return { async get() { return { data: rows.has(id) ? [structuredClone(rows.get(id))] : [] }; } }; },
      where(query) { let limit = Infinity; return {
        limit(n) { limit = n; return this; }, orderBy() { return this; },
        async get() { return { data: [...rows.values()].filter(r => match(r, query)).slice(0, limit).map(r => structuredClone(r)) }; },
        async update(patch) {
          if (outage === name) { outage = ''; throw Error('transient write failure'); }
          let updated = 0;
          for (const row of rows.values()) if (match(row, query)) { Object.assign(row, structuredClone(patch)); updated++; }
          return { updated };
        }
      }; }
    };
  } };
  const outTradeNo = 'pp' + 'b'.repeat(26);
  const order = { _id: 'order', userId: 'owner', plan: 'plus', durationDays: 30, generationLimit: 10, amountFen: 100, currency: 'CNY',
    paymentAttempt: { channelId: 'channel', provider: 'wxpay', payType: 'app', merchantId: 'merchant', appId: 'app', outTradeNo } };
  const payment = { _id: 'receipt', order_no: 'order', user_id: 'owner', out_trade_no: outTradeNo, type: 'pety_membership', status: 1,
    provider: 'wxpay', provider_pay_type: 'app', provider_appid: 'app', total_fee: 100, transaction_id: 'tx', pay_date: 1000, original_data: { body: 'test-only' } };
  db.collection('pety_membership_orders'); tables.get('pety_membership_orders').set('order', order);
  db.collection('uni-pay-orders'); tables.get('uni-pay-orders').set('receipt', payment);
  const config = { enabled: true, channels: { channel: { approved: true, provider: 'wxpay', payType: 'app', configDirectory: 'fixture' } } };
  const payService = { async initUniPayInstance(input) {
    assert.deepEqual(input, { provider: 'wxpay', provider_pay_type: 'app', config_directory: 'fixture' });
    return { async verifyPaymentNotify(original) {
      assert.deepEqual(original, payment.original_data);
      return { outTradeNo, totalFee: 100, transactionId: 'tx', appId: 'app', resultCode: 'SUCCESS', mchId: 'merchant', feeType: 'CNY' };
    } };
  } };
  return { db, tables, config, payment, outTradeNo,
    runtime: () => createPaymentRuntime({ db, payService, config, now: () => 2000 }),
    failWrite: name => { outage = name; } };
}

test('private runtime is closed before touching database or SDK when payment is disabled', () => {
  assert.throws(() => createPaymentRuntime({ db: null, payService: null }), { code: 'PAYMENT_NOT_CONFIGURED' });
});

test('real local adapters persist notification, survive activation crash, and recover one membership period', async () => {
  const s = setup();
  s.failWrite('pety_membership_schedules');
  await assert.rejects(s.runtime().settle(s.outTradeNo), /transient write failure/);
  assert.equal(s.tables.get('pety_payment_inbox').size, 1);
  assert.equal(s.tables.get('pety_membership_grants').size, 1);
  assert.equal(s.payment.user_order_success, undefined);
  const order = s.tables.get('pety_membership_orders').get('order');
  assert.deepEqual(await readPaymentStatus(s.db, order, 2000), { paymentStatus: 'paid', entitlementStatus: 'pending_activation' });
  assert.equal((await s.runtime().reconcile())[0].recovered, true);
  assert.equal(s.payment.user_order_success, true);
  await Promise.all(Array.from({ length: 5 }, () => s.runtime().settle(s.outTradeNo)));
  const schedule = [...s.tables.get('pety_membership_schedules').values()][0];
  assert.equal(Object.keys(schedule.periods).length, 1);
  const membership = await readEffectiveMembership(s.db, 'owner', null, 2000);
  assert.equal(membership.plan, 'plus');
  assert.equal(membership.orderId, 'order');
  assert.equal((await readPaymentStatus(s.db, order, 2000)).entitlementStatus, 'active');
  assert.deepEqual(await s.runtime().reconcile(), []);
});

test('ambiguous legacy membership and disabled channel do not acknowledge or create active periods', async () => {
  const s = setup(); s.db.collection('pety_memberships');
  s.tables.get('pety_memberships').set('one', { userId: 'owner' });
  s.tables.get('pety_memberships').set('two', { userId: 'owner' });
  await assert.rejects(s.runtime().settle(s.outTradeNo), { code: 'MEMBERSHIP_SERVICE_UNAVAILABLE' });
  assert.equal(s.tables.get('pety_membership_schedules').size, 0);
  assert.equal(s.payment.user_order_success, undefined);
  s.config.channels.channel.approved = false;
  await assert.rejects(s.runtime().settle(s.outTradeNo), { code: 'PAYMENT_NOT_CONFIGURED' });
});

test('installed notify hook waits for durable settlement and returns false on failure without leaking notification', async () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../uni_modules/uni-pay/uniCloud/cloudfunctions/uni-pay-co/notify/pety_membership.js'), 'utf8');
  const s = setup(), errors = [];
  const sandbox = { module: { exports: {} }, console: { error: value => errors.push(value) }, uniCloud: { database: () => s.db },
    require(id) {
      if (id === 'uni-config-center') return () => ({ hasFile: () => true, config: () => s.config });
      if (id === 'pety-membership-orders/payment-runtime') return { createPaymentRuntime: () => s.runtime() };
      if (id === '../service/pay') return {};
      throw Error('unexpected dependency');
    }
  };
  vm.runInNewContext(source, sandbox);
  const hook = sandbox.module.exports;
  s.failWrite('pety_membership_schedules');
  assert.equal(await hook({ data: { out_trade_no: s.outTradeNo }, verifyResult: { forged: true } }), false);
  assert.deepEqual(errors, ['pety_payment_settlement_pending']);
  assert.equal(await hook({ data: { out_trade_no: s.outTradeNo } }), true);
  assert.equal((await readEffectiveMembership(s.db, 'owner', null, 2000)).plan, 'plus');
  s.config.enabled = false;
  assert.equal(await hook({ data: { out_trade_no: s.outTradeNo } }), false);
});
