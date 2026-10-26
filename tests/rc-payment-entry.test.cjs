const test = require('node:test');
const assert = require('node:assert/strict');
const { createPaymentEntry } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-entry');

function setup(enabled = true) {
  const calls = [];
  const order = { _id: 'owned-order', skuId: 'monthly', amountFen: 1234, currency: 'CNY', paymentStatus: 'prepared', entitlementStatus: 'not_granted', paymentAttempt: { provider: 'wxpay', outTradeNo: 'persisted-attempt' } };
  const orders = {
    async create(uid, input) { calls.push(['create', uid, input]); return order; },
    async preparePayment(uid, id, channel) { calls.push(['prepare', uid, id, channel]); return order; },
    async read(uid, id) { if (uid !== 'owner' || id !== order._id) throw Object.assign(Error('not found'), { code: 'ORDER_NOT_FOUND' }); return order; }
  };
  const payService = { async createOrder(input) { calls.push(['provider', input]); return { order: 'provider-payload' }; } };
  return { calls, api: createPaymentEntry({ orders, payService, enabled, readStatus: async () => ({ paymentStatus: 'paid', entitlementStatus: 'pending_activation' }), channels: { approved: { approved: true, configDirectory: 'production' } } }) };
}
const input = { skuId: 'monthly', requestId: 'request_12345678', channelId: 'approved' };
const client = { platform: 'app', osName: 'android' };

test('closed, unauthenticated, unsupported and injected payment requests never reach provider', async () => {
  const closed = setup(false);
  await assert.rejects(closed.api.create('owner', input, client), { code: 'PAYMENT_NOT_CONFIGURED' });
  assert.equal(closed.calls.length, 0);
  const s = setup();
  await assert.rejects(s.api.create('', input, client), { code: 'ORDER_LOGIN_REQUIRED' });
  await assert.rejects(s.api.create('owner', input, { platform: 'app', osName: 'ios' }), { code: 'PAYMENT_PLATFORM_UNSUPPORTED' });
  for (const extra of [{ total_fee: 1 }, { user_id: 'other' }, { config_directory: 'evil' }, { clientInfo: client }]) {
    await assert.rejects(s.api.create('owner', { ...input, ...extra }, client), { code: 'ORDER_INPUT_INVALID' });
  }
  assert.equal(s.calls.length, 0);
});

test('entry passes only server pricing and persisted identity after preparing attempt', async () => {
  const s = setup();
  const cloud = { spaceId: 'isolated-test' };
  await s.api.create('owner', input, client, cloud);
  assert.deepEqual(s.calls.map(c => c[0]), ['create', 'prepare', 'provider']);
  const sent = s.calls[2][1];
  assert.equal(sent.total_fee, 1234);
  assert.equal(sent.user_id, 'owner');
  assert.equal(sent.order_no, 'owned-order');
  assert.equal(sent.out_trade_no, 'persisted-attempt');
  assert.equal(sent.type, 'pety_membership');
  assert.equal(sent.config_directory, 'production');
  assert.equal(sent.clientInfo, client);
  assert.equal(sent.cloudInfo, cloud);
});

test('order reads preserve owner checks and disclose neither provider payload nor merchant facts', async () => {
  const s = setup();
  await assert.rejects(s.api.read('other', { orderId: 'owned-order' }), { code: 'ORDER_NOT_FOUND' });
  await assert.rejects(s.api.read('owner', { orderId: 'owned-order', userId: 'other' }), { code: 'ORDER_INPUT_INVALID' });
  const result = await s.api.read('owner', { orderId: 'owned-order' });
  assert.equal(result.paymentStatus, 'paid');
  assert.equal(result.entitlementStatus, 'pending_activation');
  assert.deepEqual(Object.keys(result).sort(), ['orderId', 'skuId', 'amountFen', 'currency', 'paymentStatus', 'entitlementStatus'].sort());
  assert.equal(s.calls.length, 0);
});
