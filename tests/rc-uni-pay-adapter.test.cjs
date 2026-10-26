const test = require('node:test');
const assert = require('node:assert/strict');
const { createUniPayAdapter } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/uni-pay-adapter');
const { validatePaidEvidence } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-evidence');

function fixture() {
  const outTradeNo = 'pp' + 'a'.repeat(26);
  const order = { _id: 'business', userId: 'owner', currency: 'CNY', amountFen: 1200,
    paymentAttempt: { channelId: 'server-channel', provider: 'wxpay', payType: 'app', merchantId: 'merchant', appId: 'app', outTradeNo } };
  const payment = { _id: 'receipt', order_no: order._id, user_id: 'owner', out_trade_no: outTradeNo,
    type: 'pety_membership', status: 1, provider: 'wxpay', provider_pay_type: 'app', provider_appid: 'app',
    total_fee: 1200, transaction_id: 'transaction', pay_date: 1000, original_data: { body: 'synthetic-signed-message' } };
  let verified = { outTradeNo, totalFee: 1200, transactionId: 'transaction', appId: 'app', resultCode: 'SUCCESS', mchId: 'merchant', feeType: 'CNY' };
  let verifyCalls = 0, accepts = 0, activations = 0, activationFails = false, realSdk;
  const match = (row, q) => Object.entries(q).every(([k, v]) => v && typeof v === 'object' && 'neq' in v ? row[k] !== v.neq : row[k] === v);
  const payOrders = { where(q) { return {
    limit() { return this; }, orderBy() { return this; },
    async get() { return { data: match(payment, q) ? [{ ...payment }] : [] }; },
    async update(patch) { if (!match(payment, q)) return { updated: 0 }; Object.assign(payment, patch); return { updated: 1 }; }
  }; } };
  const adapter = createUniPayAdapter({ payOrders, dbCmd: { neq: v => ({ neq: v }) },
    businessOrders: { doc: id => ({ get: async () => ({ data: id === order._id ? [order] : [] }) }) },
    getVerifier: async channel => {
      assert.equal(channel, 'server-channel');
      if (realSdk) return realSdk;
      return { verifyPaymentNotify: async original => { verifyCalls++; assert.equal(original, payment.original_data); return verified; } };
    },
    inbox: {
      async accept(...args) { validatePaidEvidence(...args); accepts++; },
      async activate(id) { assert.equal(id, order._id); if (activationFails) throw Error('transient'); activations++; }
    }
  });
  return { adapter, order, payment, get verified() { return verified; }, set verified(v) { verified = v; },
    set activationFails(v) { activationFails = v; }, set sdk(v) { realSdk = v; }, stats: () => ({ verifyCalls, accepts, activations }) };
}

test('stored official notification is reverified before recording; merchant/currency cannot come from order fields', async () => {
  const s = fixture();
  await s.adapter.record(s.payment.out_trade_no);
  assert.deepEqual(s.stats(), { verifyCalls: 1, accepts: 1, activations: 0 });
  for (const mutate of [s => s.verified = false, s => delete s.verified.mchId, s => delete s.verified.feeType,
    s => s.verified.mchid = 'other', s => s.verified.feeType = 'USD', s => s.payment.user_id = 'other',
    s => s.verified.totalFee = 1, s => { delete s.verified.resultCode; s.verified.returnCode = 'SUCCESS'; }]) {
    const bad = fixture(); mutate(bad);
    await assert.rejects(bad.adapter.record(bad.payment.out_trade_no));
    assert.equal(bad.stats().accepts, 0);
  }
});

test('failed activation remains recoverable; missing success flag is included and successful rows stop replaying', async () => {
  const s = fixture(); s.activationFails = true;
  assert.equal((await s.adapter.reconcile())[0].recovered, false);
  assert.equal(s.payment.user_order_success, undefined);
  s.activationFails = false;
  assert.equal((await s.adapter.reconcile())[0].recovered, true);
  assert.equal(s.payment.user_order_success, true);
  assert.deepEqual(await s.adapter.reconcile(), []);
  assert.equal(s.stats().verifyCalls, 2);
});

test('refunds and unsupported channels are rejected and recovery batches are bounded', async () => {
  const s = fixture(); s.payment.refund_fee = 1;
  await assert.rejects(s.adapter.record(s.payment.out_trade_no));
  s.order.paymentAttempt.payType = 'h5';
  await assert.rejects(s.adapter.record(s.payment.out_trade_no));
  for (const limit of [0, 21, 1.5]) await assert.rejects(s.adapter.reconcile({ limit }));
  assert.equal(s.stats().accepts, 0);
});

test('installed official SDK verifies a synthetic signed XML notification and rejects tampering offline', async () => {
  const crypto = require('node:crypto');
  const oldCloud = global.uniCloud, oldContext = global.__ctx__;
  global.uniCloud = { httpclient: { request() { throw Error('NETWORK_FORBIDDEN'); } } };
  global.__ctx__ = {};
  try {
    const official = require('../uni_modules/uni-pay/uniCloud/cloudfunctions/common/uni-pay');
    const key = 'x'.repeat(32); // Synthetic fixture key, never merchant credentials.
    const s = fixture();
    s.sdk = official.initWeixin({ appId: 'app', mchId: 'merchant', key, signType: 'MD5' });
    const fields = { appid: 'app', mch_id: 'merchant', out_trade_no: s.payment.out_trade_no,
      total_fee: '1200', transaction_id: 'transaction', fee_type: 'CNY', return_code: 'SUCCESS', result_code: 'SUCCESS', nonce_str: 'synthetic' };
    const sign = crypto.createHash('md5').update(Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('&') + '&key=' + key).digest('hex').toUpperCase();
    const body = '<xml>' + Object.entries({ ...fields, sign }).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`).join('') + '</xml>';
    s.payment.original_data = { httpMethod: 'POST', headers: { 'content-type': 'text/xml' }, body };
    await s.adapter.record(s.payment.out_trade_no);
    assert.equal(s.stats().accepts, 1);
    s.payment.original_data.body = body.replace('1200', '1201');
    await assert.rejects(s.adapter.record(s.payment.out_trade_no));
    assert.equal(s.stats().accepts, 1);
  } finally { global.uniCloud = oldCloud; global.__ctx__ = oldContext; }
});
